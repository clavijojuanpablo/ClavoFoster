'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { obtenerCatalogoReservable, obtenerVentanaDeCupos, type VentanaDeCupos } from '@/lib/booking/disponibilidad';
import { reprogramarPorToken } from '@/lib/booking/gestion';
import { solicitarCodigo, verificarCodigo } from '@/lib/booking/otp';
import { crearCita } from '@/lib/booking/reservar';
import { getNegocioPublico } from '@/lib/tenant';
import { normalizarCelular } from '@/lib/validation/telefono';
import {
  esquemaConfirmarCodigo,
  esquemaCupos,
  esquemaMovida,
  esquemaPedirCodigo,
  esquemaReserva,
  type PeticionDeCodigo,
  type PeticionDeConfirmacion,
  type PeticionDeCupos,
  type PeticionDeMovida,
  type PeticionDeReserva,
} from '@/lib/validation/reserva';

/**
 * La reserva pública entera (tareas F2 a F5).
 *
 * Sin sesión: las llama un desconocido desde el navegador, así que todo lo que
 * entra se valida y el negocio se deriva siempre del slug — nunca se acepta un
 * `business_id`. Lo único que sale de acá son horas libres y, al final, el link
 * de gestión de SU cita.
 */

export type RespuestaCupos = { ok: true; ventana: VentanaDeCupos } | { ok: false; error: string };

export async function cuposDisponibles(peticion: PeticionDeCupos): Promise<RespuestaCupos> {
  const datos = esquemaCupos.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender la búsqueda' };

  const { slug, serviceId, staffId, desde } = datos.data;

  // Acá se deriva el negocio, y es lo único que autoriza la consulta: si el
  // slug no está publicado, RLS no devuelve nada y no hay cupos que dar.
  const negocio = await getNegocioPublico(slug);
  if (!negocio) return { ok: false, error: 'Este negocio no está disponible' };

  const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === serviceId);
  if (!servicio) return { ok: false, error: 'Ese servicio ya no está disponible' };

  try {
    const ventana = await obtenerVentanaDeCupos({ negocio, servicio, staffId, desde, ahora: new Date() });
    return { ok: true, ventana };
  } catch (error) {
    console.error('[reservar] no se pudieron calcular los cupos:', {
      negocio: slug,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: 'No pudimos cargar los horarios. Intenta de nuevo.' };
  }
}

export type RespuestaCodigo =
  | { ok: true; enmascarado: string; puedeReenviarEnSegundos: number }
  | { ok: false; error: string };

/** Manda el código de seis dígitos al WhatsApp del cliente (F4). */
export async function pedirCodigo(peticion: PeticionDeCodigo): Promise<RespuestaCodigo> {
  const datos = esquemaPedirCodigo.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'Escribe tu celular' };

  const telefono = normalizarCelular(datos.data.telefono);
  if (!telefono) return { ok: false, error: 'Ese celular no parece válido' };

  const negocio = await getNegocioPublico(datos.data.slug);
  if (!negocio) return { ok: false, error: 'Este negocio no está disponible' };

  return solicitarCodigo({ negocio, telefono, ip: await ipDeQuienLlama() });
}

export type RespuestaVerificacion =
  | { ok: true; token: string; esClienteNuevo: boolean; nombre: string | null }
  | { ok: false; error: string };

/** Revisa el código y devuelve el permiso para terminar de reservar (F4 y F5). */
export async function confirmarCodigo(peticion: PeticionDeConfirmacion): Promise<RespuestaVerificacion> {
  const datos = esquemaConfirmarCodigo.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'El código son seis números' };

  const telefono = normalizarCelular(datos.data.telefono);
  if (!telefono) return { ok: false, error: 'Ese celular no parece válido' };

  const negocio = await getNegocioPublico(datos.data.slug);
  if (!negocio) return { ok: false, error: 'Este negocio no está disponible' };

  return verificarCodigo({ negocio, telefono, codigo: datos.data.codigo });
}

export type RespuestaReserva =
  | { ok: true; linkDeGestion: string }
  | { ok: false; error: string; cupoOcupado?: true };

/** Guarda la cita (F5). El teléfono sale del token, no del formulario. */
export async function reservar(peticion: PeticionDeReserva): Promise<RespuestaReserva> {
  const datos = esquemaReserva.safeParse(peticion);
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos de la reserva' };
  }

  const negocio = await getNegocioPublico(datos.data.slug);
  if (!negocio) return { ok: false, error: 'Este negocio no está disponible' };

  const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === datos.data.serviceId);
  if (!servicio) return { ok: false, error: 'Ese servicio ya no está disponible' };

  const resultado = await crearCita({
    negocio,
    servicio,
    staffId: datos.data.staffId,
    inicio: datos.data.inicio,
    token: datos.data.token,
    nombre: datos.data.nombre,
    nota: datos.data.nota,
  });

  if (!resultado.ok) return resultado;

  return { ok: true, linkDeGestion: resultado.cita.linkDeGestion };
}

/**
 * La IP de quien llama, para el límite de envíos del OTP.
 *
 * Detrás de Vercel la IP real viene en `x-forwarded-for`, y el primer valor de
 * la lista es el cliente. En local no hay ninguna y el límite por conexión
 * simplemente no aplica.
 */
async function ipDeQuienLlama(): Promise<string | null> {
  const cabeceras = await headers();
  const reenviada = cabeceras.get('x-forwarded-for');

  return reenviada?.split(',')[0]?.trim() || cabeceras.get('x-real-ip') || null;
}

export type RespuestaMover = { ok: true } | { ok: false; error: string; cupoOcupado?: true };

/**
 * Mueve una cita existente a otra hora (F6).
 *
 * El permiso es el `manage_token` de la cita, el mismo del link que le llegó al
 * cliente: no hace falta pedirle otro código, ya probó quién es cuando reservó.
 */
export async function moverCita(peticion: PeticionDeMovida): Promise<RespuestaMover> {
  const datos = esquemaMovida.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender el cambio' };

  const resultado = await reprogramarPorToken(datos.data);

  if (resultado.ok) revalidatePath(`/cita/${datos.data.token}`);

  return resultado;
}
