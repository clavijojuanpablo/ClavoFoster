'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { instanteLocal } from '@/lib/fechas';
import {
  buscarClientePorTelefono,
  catalogoParaAgendar,
  crearCitaManual,
  cuposSugeridos,
  type ClienteConocido,
  type CupoSugerido,
} from '@/lib/panel/nueva-cita';
import { createClient } from '@/lib/supabase/server';
import { requireNegocio } from '@/lib/tenant';
import { erroresPorCampo } from '@/lib/validation/negocio';
import {
  esquemaBuscarCliente,
  esquemaCuposPanel,
  esquemaNuevaCita,
  type PeticionDeCuposPanel,
  type PeticionDeNuevaCita,
} from '@/lib/validation/nueva-cita';
import { normalizarCelular } from '@/lib/validation/telefono';

/**
 * Lo que el negocio hace con una cita desde la agenda (G5).
 *
 * Con sesión: el negocio sale de la sesión y RLS vuelve a exigirlo en la
 * consulta, así que un id de cita de otro negocio no actualiza nada.
 *
 * Marcar **cumplida** es lo que disparará el asiento de ingreso de la épica H.
 * Por eso el `update` exige que la cita todavía no esté cumplida: marcar dos
 * veces no puede terminar en dos ingresos.
 */

const esquema = z.object({
  citaId: z.uuid(),
  estado: z.enum(['completed', 'no_show', 'confirmed', 'cancelled']),
});

export type RespuestaEstado = { ok: true } | { ok: false; error: string };

export async function cambiarEstadoDeCita(peticion: {
  citaId: string;
  estado: 'completed' | 'no_show' | 'confirmed' | 'cancelled';
}): Promise<RespuestaEstado> {
  const datos = esquema.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender el cambio' };

  const { negocio } = await requireNegocio();
  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { citaId, estado } = datos.data;

  const cambios = {
    status: estado,
    // Cada estado limpia las marcas de los otros: una cita que vuelve a
    // confirmarse no puede seguir teniendo fecha de cancelación.
    completed_at: estado === 'completed' ? ahora : null,
    cancelled_at: estado === 'cancelled' ? ahora : null,
    cancelled_by: estado === 'cancelled' ? 'business' : null,
  };

  const { data, error } = await supabase
    .from('appointments')
    .update(cambios)
    .eq('id', citaId)
    .eq('business_id', negocio.id)
    // Idempotencia: si ya está en ese estado, no se vuelve a escribir.
    .neq('status', estado)
    .select('id')
    .maybeSingle();

  if (error) {
    // Devolver una cita cancelada a confirmada puede chocar con otra que ya
    // tomó el cupo. Es un resultado normal del negocio, no una falla.
    if (error.code === '23P01') {
      return { ok: false, error: 'Esa hora ya está ocupada por otra cita' };
    }

    console.error('[agenda] no se pudo cambiar el estado:', {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'No pudimos guardar el cambio. Intenta de nuevo.' };
  }

  // `data` nulo significa que ya estaba así. Para quien lo pidió, está hecho.
  if (data) revalidatePath('/panel/agenda');

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cita manual (G3)
// ---------------------------------------------------------------------------

/**
 * Lo que la hoja de "Nueva cita" le pide al servidor.
 *
 * Ids de servicio y persona llegan del navegador, así que se cruzan siempre con
 * el catálogo del negocio de la sesión: uno de otro negocio no aparece ahí y no
 * se agenda. La zona horaria para leer la hora escrita también sale del
 * negocio, nunca del navegador.
 */

export type RespuestaCuposPanel = { ok: true; cupos: CupoSugerido[] } | { ok: false; error: string };

export async function cuposParaNuevaCita(peticion: PeticionDeCuposPanel): Promise<RespuestaCuposPanel> {
  const datos = esquemaCuposPanel.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender la búsqueda' };

  const contexto = await requireNegocio();
  const { serviceId, staffId, fecha } = datos.data;

  try {
    const servicio = (await catalogoParaAgendar(contexto)).find((s) => s.id === serviceId);
    if (!servicio) return { ok: false, error: 'Ese servicio ya no está disponible' };

    const cupos = await cuposSugeridos({ contexto, servicio, staffId, fecha, ahora: new Date() });
    return { ok: true, cupos };
  } catch (error) {
    console.error('[nueva cita] no se pudieron calcular los cupos:', {
      businessId: contexto.negocio.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: 'No pudimos cargar las horas libres' };
  }
}

export type RespuestaCliente =
  | { ok: true; cliente: ClienteConocido | null; telefono: string }
  | { ok: false; error: string };

/** Si el celular ya es cliente de este negocio, se muestra quién es antes de agendar. */
export async function buscarClienteParaCita(peticion: { telefono: string }): Promise<RespuestaCliente> {
  const datos = esquemaBuscarCliente.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'Escribe un celular' };

  const telefono = normalizarCelular(datos.data.telefono);
  if (!telefono) return { ok: false, error: 'Ese celular no parece válido. Revisa los números.' };

  const contexto = await requireNegocio();

  try {
    return { ok: true, cliente: await buscarClientePorTelefono(contexto, telefono), telefono };
  } catch {
    return { ok: false, error: 'No pudimos buscar ese cliente. Intenta de nuevo.' };
  }
}

export type RespuestaNuevaCita =
  | { ok: true }
  | { ok: false; error: string; campos: Record<string, string>; cupoOcupado?: true };

export async function crearCitaDesdePanel(peticion: PeticionDeNuevaCita): Promise<RespuestaNuevaCita> {
  const datos = esquemaNuevaCita.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'Revisa los datos de la cita', campos: erroresPorCampo(datos.error) };

  const telefono = normalizarCelular(datos.data.telefono);
  if (!telefono) {
    return { ok: false, error: 'Revisa los datos de la cita', campos: { telefono: 'Ese celular no parece válido' } };
  }

  const contexto = await requireNegocio();
  const { serviceId, staffId, fecha, hora, nombre, nota, origen } = datos.data;

  const servicio = (await catalogoParaAgendar(contexto)).find((s) => s.id === serviceId);
  if (!servicio) return { ok: false, error: 'Ese servicio ya no está disponible', campos: {} };

  const r = await crearCitaManual({
    contexto,
    servicio,
    staffId,
    inicio: instanteLocal(contexto.negocio.timezone, fecha, hora),
    cliente: { telefono, nombre },
    notaInterna: nota,
    origen,
    ahora: new Date(),
  });

  if (!r.ok) {
    return { ok: false, error: r.error, campos: {}, ...(r.cupoOcupado ? { cupoOcupado: true as const } : {}) };
  }

  revalidatePath('/panel/agenda');
  return { ok: true };
}
