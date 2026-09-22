import 'server-only';

import { fechaLarga, hora } from '@/lib/formato';
import { notificar } from '@/lib/notifications';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Gestión de la cita por link (tarea F6).
 *
 * El link lleva el `manage_token` aleatorio de la cita, nunca su id: con el id,
 * cualquiera podría recorrer identificadores y cancelarle las citas a otros.
 * El token muestra **solo esa cita** y nada más del negocio.
 *
 * No hay sesión de por medio. Quien tenga el link puede cancelar, y eso es a
 * propósito: el link le llegó al WhatsApp del cliente, que es donde lo va a
 * buscar.
 */

export type CitaDelCliente = {
  token: string;
  negocio: { nombre: string; slug: string; telefono: string | null; direccion: string | null; timezone: string };
  servicioId: string;
  servicio: string;
  staffId: string;
  trabajador: string;
  /** ISO 8601 en UTC. */
  inicio: string;
  duracionMinutos: number;
  precioCop: number;
  estado: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  nota: string | null;
  /** Hasta cuándo se puede cancelar solo, según `cancel_notice_minutes`. */
  puedeCancelarHasta: string;
};

export async function obtenerCitaPorToken(token: string): Promise<CitaDelCliente | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('appointments')
    // Una sola cadena literal: los tipos de Supabase se deducen del texto del
    // select y una concatenación los rompe.
    .select(
      'manage_token, service_id, staff_id, start_at, duration_minutes, price_cop, status, customer_note, services(name), staff(name), businesses(name, slug, phone, address, timezone, cancel_notice_minutes)',
    )
    .eq('manage_token', token)
    .maybeSingle();

  if (error) {
    console.error('[gestion] no se pudo leer la cita:', { code: error.code, message: error.message });
    throw new Error('No pudimos cargar tu cita');
  }

  if (!data?.businesses) return null;

  const negocio = data.businesses;

  return {
    token: data.manage_token,
    negocio: {
      nombre: negocio.name,
      slug: negocio.slug,
      telefono: negocio.phone,
      direccion: negocio.address,
      timezone: negocio.timezone,
    },
    servicioId: data.service_id,
    servicio: data.services?.name ?? 'Servicio',
    staffId: data.staff_id,
    trabajador: data.staff?.name ?? '',
    // Normalizado a ISO con Z: Postgres devuelve '+00:00' y esto viaja al
    // navegador, donde se compara con los cupos que sí salen en ISO.
    inicio: new Date(data.start_at).toISOString(),
    duracionMinutos: data.duration_minutes,
    precioCop: data.price_cop,
    estado: data.status,
    nota: data.customer_note,
    puedeCancelarHasta: new Date(
      new Date(data.start_at).getTime() - negocio.cancel_notice_minutes * 60_000,
    ).toISOString(),
  };
}

export type ResultadoCancelacion = { ok: true } | { ok: false; error: string };

export type ResultadoReprogramacion = { ok: true } | { ok: false; error: string; cupoOcupado?: true };

/** El código que usa Postgres para una violación de restricción de exclusión. */
const CONFLICTO = '23P01';

/**
 * Mueve la cita a otra hora, y eventualmente a otra persona.
 *
 * No se cancela y se vuelve a crear: es la MISMA cita, con su mismo token y su
 * mismo precio. Cancelar y recrear le cambiaría el link al cliente —el que ya
 * tiene en su chat— y le pondría el precio de hoy a una cita de la semana
 * pasada, que es justo lo que prohíbe la regla 4 de CLAUDE.md.
 *
 * El cupo viejo queda libre en el mismo `update`, y que el nuevo esté de verdad
 * libre lo garantiza la restricción de solapamiento, no una consulta previa.
 */
export async function reprogramarPorToken(input: {
  token: string;
  /** Instante de inicio nuevo, ISO 8601 en UTC. */
  inicio: string;
  staffId: string;
  ahora?: Date;
}): Promise<ResultadoReprogramacion> {
  const ahora = input.ahora ?? new Date();

  const cita = await obtenerCitaPorToken(input.token);
  if (!cita) return { ok: false, error: 'No encontramos esa cita' };

  if (cita.estado !== 'pending' && cita.estado !== 'confirmed') {
    return { ok: false, error: 'Esa cita ya no se puede mover' };
  }

  // El mismo plazo que para cancelar: mover una cita a última hora le deja al
  // negocio un hueco que ya no alcanza a vender.
  if (new Date(cita.puedeCancelarHasta) <= ahora) {
    const contacto = cita.negocio.telefono ? ` Llama al ${cita.negocio.telefono}.` : '';
    return { ok: false, error: `Ya es muy tarde para mover la cita por acá.${contacto}` };
  }

  const comienza = new Date(input.inicio);
  if (Number.isNaN(comienza.getTime())) return { ok: false, error: 'Esa hora no es válida' };
  if (comienza <= ahora) return { ok: false, error: 'Esa hora ya pasó. Escoge otra.' };

  const supabase = createAdminClient();

  const { data: movida, error } = await supabase
    .from('appointments')
    .update({
      start_at: comienza.toISOString(),
      // La duración es la que se copió al reservar, no la que tenga hoy el
      // servicio: la cita conserva lo suyo.
      end_at: new Date(comienza.getTime() + cita.duracionMinutos * 60_000).toISOString(),
      staff_id: input.staffId,
    })
    .eq('manage_token', input.token)
    .in('status', ['pending', 'confirmed'])
    .select('id, business_id, start_at, staff(name), customers(phone)')
    .maybeSingle();

  if (error) {
    if (error.code === CONFLICTO) {
      return { ok: false, error: 'Alguien acaba de tomar esa hora. Escoge otra.', cupoOcupado: true };
    }

    console.error('[gestion] no se pudo reprogramar:', { code: error.code, message: error.message });
    return { ok: false, error: 'No pudimos mover tu cita. Intenta de nuevo.' };
  }

  if (!movida) return { ok: false, error: 'Esa cita ya no se puede mover' };

  if (movida.customers?.phone) {
    await notificar({
      businessId: movida.business_id,
      appointmentId: movida.id,
      para: movida.customers.phone,
      plantilla: 'booking_rescheduled',
      variables: [
        cita.negocio.nombre,
        cita.servicio,
        `${fechaLarga(cita.negocio.timezone, new Date(movida.start_at))} a las ${hora(cita.negocio.timezone, movida.start_at)}`,
        movida.staff?.name ?? '',
      ],
    });
  }

  return { ok: true };
}

/**
 * Cancela la cita. El cupo queda libre en el mismo instante: la restricción de
 * solapamiento solo cuenta las citas `pending` y `confirmed`, así que basta con
 * cambiar el estado para que el motor vuelva a ofrecer esa hora.
 */
export async function cancelarPorToken(token: string, ahora = new Date()): Promise<ResultadoCancelacion> {
  const cita = await obtenerCitaPorToken(token);
  if (!cita) return { ok: false, error: 'No encontramos esa cita' };

  if (cita.estado === 'cancelled') return { ok: true };
  if (cita.estado !== 'pending' && cita.estado !== 'confirmed') {
    return { ok: false, error: 'Esa cita ya no se puede cancelar' };
  }

  if (new Date(cita.puedeCancelarHasta) <= ahora) {
    const contacto = cita.negocio.telefono ? ` Llama al ${cita.negocio.telefono}.` : '';
    return { ok: false, error: `Ya es muy tarde para cancelar por acá.${contacto}` };
  }

  const supabase = createAdminClient();

  const { data: cancelada, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: ahora.toISOString(), cancelled_by: 'customer' })
    .eq('manage_token', token)
    // Que no se pueda cancelar dos veces, ni cancelar una que el negocio ya
    // marcó como cumplida entre que se cargó la página y se tocó el botón.
    .in('status', ['pending', 'confirmed'])
    .select('id, business_id, customers(phone)')
    .maybeSingle();

  if (error) {
    console.error('[gestion] no se pudo cancelar:', { code: error.code, message: error.message });
    return { ok: false, error: 'No pudimos cancelar tu cita. Intenta de nuevo.' };
  }

  // Otro lo alcanzó a cambiar. No es un error del cliente: su cita ya no está activa.
  if (!cancelada) return { ok: true };

  if (cancelada.customers?.phone) {
    await notificar({
      businessId: cancelada.business_id,
      appointmentId: cancelada.id,
      para: cancelada.customers.phone,
      plantilla: 'booking_cancelled',
      variables: [cita.negocio.nombre, cita.servicio],
    });
  }

  return { ok: true };
}
