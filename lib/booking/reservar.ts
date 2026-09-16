import 'server-only';

import { env } from '@/lib/env';
import { fechaLarga, hora, pesos } from '@/lib/formato';
import { notificar } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NegocioPublico } from '@/lib/tenant';

import { telefonoDelToken } from './otp';
import type { ServicioReservable } from './tipos';

/**
 * Crear la cita desde la página pública (tarea F5).
 *
 * Lo que garantiza que dos personas no se queden con el mismo cupo NO está
 * acá: es la restricción `appointments_sin_solapamiento` de Postgres. Por
 * muchas peticiones simultáneas que lleguen, la base deja pasar una sola y a la
 * otra le responde un error de conflicto. Revisar disponibilidad en la
 * aplicación antes de insertar sería una carrera perdida.
 *
 * Ver `docs/06-motor-de-agendamiento.md`.
 */

/** El código que usa Postgres para una violación de restricción de exclusión. */
const CONFLICTO = '23P01';

export type CitaCreada = {
  /** El token aleatorio de la cita, para el link de gestión. Nunca su id. */
  token: string;
  linkDeGestion: string;
};

export type ResultadoReserva =
  | { ok: true; cita: CitaCreada }
  | { ok: false; error: string; cupoOcupado?: true };

export async function crearCita(input: {
  negocio: NegocioPublico;
  servicio: ServicioReservable;
  staffId: string;
  /** Instante de inicio, ISO 8601 en UTC. */
  inicio: string;
  /** El token que devolvió `verificarCodigo`. Es lo único que prueba quién es. */
  token: string;
  /** Obligatorio si es cliente nuevo; si ya existe, se ignora. */
  nombre: string | null;
  nota: string | null;
  ahora?: Date;
}): Promise<ResultadoReserva> {
  const { negocio, servicio, staffId, inicio, token, nota } = input;
  const ahora = input.ahora ?? new Date();

  // El teléfono sale del token firmado, jamás del formulario: si viniera del
  // navegador, cualquiera podría agendar a nombre de otro.
  const telefono = telefonoDelToken(token, negocio.id, ahora);
  if (!telefono) return { ok: false, error: 'Tu sesión venció. Vuelve a pedir el código.' };

  const trabajador = servicio.trabajadores.find((t) => t.id === staffId);
  if (!trabajador) return { ok: false, error: 'Esa persona ya no presta este servicio' };

  const comienza = new Date(inicio);
  if (Number.isNaN(comienza.getTime())) return { ok: false, error: 'Esa hora no es válida' };
  if (comienza <= ahora) return { ok: false, error: 'Esa hora ya pasó. Escoge otra.' };

  const supabase = createAdminClient();

  const cliente = await buscarOCrearCliente({
    businessId: negocio.id,
    telefono,
    nombre: input.nombre,
    ahora,
  });
  if (!cliente) return { ok: false, error: 'No pudimos guardar tus datos. Intenta de nuevo.' };
  if (cliente.bloqueado) {
    return { ok: false, error: 'No pudimos continuar con este número. Comunícate con el negocio.' };
  }

  const termina = new Date(comienza.getTime() + trabajador.duracionMinutos * 60_000);

  const { data: cita, error } = await supabase
    .from('appointments')
    .insert({
      business_id: negocio.id,
      customer_id: cliente.id,
      staff_id: staffId,
      service_id: servicio.id,
      start_at: comienza.toISOString(),
      end_at: termina.toISOString(),
      // Copiados al reservar: si mañana sube el precio, esta cita no cambia de
      // valor. Regla 4 de CLAUDE.md
      price_cop: trabajador.precioCop,
      duration_minutes: trabajador.duracionMinutos,
      buffer_before_minutes: servicio.bufferAntesMinutos,
      buffer_after_minutes: servicio.bufferDespuesMinutos,
      status: 'confirmed',
      source: 'online',
      customer_note: nota,
    })
    .select('id, manage_token, start_at')
    .single();

  if (error) {
    if (error.code === CONFLICTO) {
      return { ok: false, error: 'Alguien acaba de tomar esa hora. Escoge otra.', cupoOcupado: true };
    }

    console.error('[reservar] no se pudo crear la cita:', {
      negocio: negocio.slug,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'No pudimos guardar tu cita. Intenta de nuevo.' };
  }

  const linkDeGestion = `${env.NEXT_PUBLIC_APP_URL}/cita/${cita.manage_token}`;

  // El aviso va después de que la cita existe, y si falla no la tumba: la cita
  // es el hecho, el mensaje es el aviso.
  await notificar({
    businessId: negocio.id,
    appointmentId: cita.id,
    para: telefono,
    plantilla: 'booking_confirmed',
    variables: [
      negocio.name,
      servicio.nombre,
      `${fechaLarga(negocio.timezone, new Date(cita.start_at))} a las ${hora(negocio.timezone, cita.start_at)}`,
      trabajador.nombre,
      pesos(trabajador.precioCop),
      linkDeGestion,
    ],
  });

  return { ok: true, cita: { token: cita.manage_token, linkDeGestion } };
}

/**
 * El cliente de ESE negocio, creándolo si es la primera vez.
 *
 * Los clientes no son globales: el mismo número puede ser nuevo en una
 * barbería y de toda la vida en otra. Ver `docs/05-arquitectura-multitenant.md`.
 *
 * Al que vuelve no se le pisa el nombre con lo que escriba ahora: si el negocio
 * lo tiene guardado como "Camila R. (la del flequillo)", esa nota se queda.
 */
async function buscarOCrearCliente(input: {
  businessId: string;
  telefono: string;
  nombre: string | null;
  ahora: Date;
}): Promise<{ id: string; bloqueado: boolean } | null> {
  const supabase = createAdminClient();

  const { data: existente } = await supabase
    .from('customers')
    .select('id, is_blocked')
    .eq('business_id', input.businessId)
    .eq('phone', input.telefono)
    .maybeSingle();

  if (existente) {
    await supabase
      .from('customers')
      .update({ last_visit_at: input.ahora.toISOString() })
      .eq('id', existente.id);

    return { id: existente.id, bloqueado: existente.is_blocked };
  }

  const nombre = input.nombre?.trim();
  if (!nombre) return null;

  const { data: nuevo, error } = await supabase
    .from('customers')
    .insert({
      business_id: input.businessId,
      phone: input.telefono,
      name: nombre,
      last_visit_at: input.ahora.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[reservar] no se pudo crear el cliente:', { code: error.code, message: error.message });
    return null;
  }

  return { id: nuevo.id, bloqueado: false };
}
