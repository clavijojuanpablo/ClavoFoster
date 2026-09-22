import 'server-only';

import { obtenerCatalogoReservable, obtenerDisponibilidad } from '@/lib/booking/disponibilidad';
import type { ServicioReservable } from '@/lib/booking/tipos';
import { env } from '@/lib/env';
import { relojLocal } from '@/lib/fechas';
import { fechaLarga, hora, pesos } from '@/lib/formato';
import { notificar } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/server';
import type { ContextoNegocio } from '@/lib/tenant';

/**
 * Crear una cita desde el panel (tarea G3).
 *
 * Es el caso que más pasa en un local de verdad: alguien llama, o llega sin
 * cita y hay un hueco. Por eso acá el negocio puede cosas que el cliente final
 * no puede:
 *
 *   - **Agendar a cualquier hora**, aunque el motor no la ofrezca. Un walk-in
 *     llega a las 3:07, no a las 3:00, y un domingo cerrado el dueño igual
 *     puede atender a su primo. Los cupos se ofrecen como ayuda, no como
 *     barrera.
 *   - **Sin código de verificación.** El negocio responde por lo que agenda.
 *
 * Lo que NO cambia: la restricción `appointments_sin_solapamiento` sigue ahí.
 * Ni el dueño puede poner dos citas encima en la misma persona, porque eso no
 * es una regla de producto sino la realidad de que nadie corta dos cabezas a la
 * vez. Ver `docs/06-motor-de-agendamiento.md`.
 */

/** El código que usa Postgres para una violación de restricción de exclusión. */
const CONFLICTO = '23P01';

/** Violación de `unique (business_id, phone)` en `customers`. */
const DUPLICADO = '23505';

export type ClienteConocido = {
  id: string;
  nombre: string;
  telefono: string;
  bloqueado: boolean;
  /** Cuántas veces no se ha presentado. Se le avisa al dueño antes de agendar. */
  noAsistio: number;
};

export type ResultadoCitaManual =
  | { ok: true; citaId: string }
  | { ok: false; error: string; cupoOcupado?: true };

/**
 * Busca al cliente por su celular dentro de ESTE negocio.
 *
 * Los clientes no son globales: el mismo número puede existir en otra barbería
 * y acá ser desconocido. Ver `docs/05-arquitectura-multitenant.md`.
 */
export async function buscarClientePorTelefono(
  { negocio }: ContextoNegocio,
  telefono: string,
): Promise<ClienteConocido | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone, is_blocked, no_show_count')
    .eq('business_id', negocio.id)
    .eq('phone', telefono)
    .maybeSingle();

  if (error) {
    console.error('[nueva cita] no se pudo buscar el cliente:', { code: error.code, message: error.message });
    throw new Error('No pudimos buscar ese cliente');
  }

  if (!data) return null;

  return {
    id: data.id,
    nombre: data.name,
    telefono: data.phone,
    bloqueado: data.is_blocked,
    noAsistio: data.no_show_count,
  };
}

export async function crearCitaManual(input: {
  contexto: ContextoNegocio;
  servicio: ServicioReservable;
  staffId: string;
  /** Instante de inicio, ya convertido a UTC con la zona del negocio. */
  inicio: Date;
  /** El celular ya normalizado a E.164. */
  cliente: { telefono: string; nombre: string };
  notaInterna: string | null;
  /** `walk_in` es el que llegó sin avisar; `manual`, el que llamó. */
  origen: 'manual' | 'walk_in';
  ahora: Date;
}): Promise<ResultadoCitaManual> {
  const { contexto, servicio, staffId, inicio, notaInterna, origen, ahora } = input;
  const { negocio } = contexto;

  // El trabajador agenda en su propia columna. Es de producto, como su vista
  // de la agenda: RLS le deja escribir en todo el negocio.
  if (contexto.rol === 'staff' && contexto.staffId !== staffId) {
    return { ok: false, error: 'Solo puedes agendar citas contigo' };
  }

  const trabajador = servicio.trabajadores.find((t) => t.id === staffId);
  if (!trabajador) return { ok: false, error: 'Esa persona no presta este servicio' };

  const customerId = await buscarOCrearCliente(contexto, input.cliente);
  if (!customerId) return { ok: false, error: 'No pudimos guardar los datos del cliente' };

  const termina = new Date(inicio.getTime() + trabajador.duracionMinutos * 60_000);
  const supabase = await createClient();

  const { data: cita, error } = await supabase
    .from('appointments')
    .insert({
      business_id: negocio.id,
      customer_id: customerId,
      staff_id: staffId,
      service_id: servicio.id,
      start_at: inicio.toISOString(),
      end_at: termina.toISOString(),
      // Copiados al agendar, con el número propio de esa persona si lo tiene.
      // Regla 4 de CLAUDE.md
      price_cop: trabajador.precioCop,
      duration_minutes: trabajador.duracionMinutos,
      buffer_before_minutes: servicio.bufferAntesMinutos,
      buffer_after_minutes: servicio.bufferDespuesMinutos,
      // Va directo a confirmada: la agendó el negocio, no hay nada que esperar.
      status: 'confirmed',
      source: origen,
      internal_note: notaInterna,
    })
    .select('id, manage_token')
    .single();

  if (error) {
    if (error.code === CONFLICTO) {
      return { ok: false, error: 'Esa persona ya tiene una cita a esa hora', cupoOcupado: true };
    }

    console.error('[nueva cita] no se pudo crear:', {
      businessId: negocio.id,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'No pudimos guardar la cita. Intenta de nuevo.' };
  }

  // Al que llamó le sirve la confirmación: le llega su link para mover o
  // cancelar, igual que si hubiera reservado en línea. Al que está sentado en
  // la silla, no: un mensaje de "tu cita quedó" en ese momento es ruido. Una
  // cita que se registra ya pasada tampoco: no hay nada que confirmar.
  if (origen === 'manual' && inicio > ahora) {
    await notificar({
      businessId: negocio.id,
      appointmentId: cita.id,
      para: input.cliente.telefono,
      plantilla: 'booking_confirmed',
      variables: [
        negocio.name,
        servicio.nombre,
        `${fechaLarga(negocio.timezone, inicio)} a las ${hora(negocio.timezone, inicio)}`,
        trabajador.nombre,
        pesos(trabajador.precioCop),
        `${env.NEXT_PUBLIC_APP_URL}/cita/${cita.manage_token}`,
      ],
    });
  }

  return { ok: true, citaId: cita.id };
}

/**
 * El id del cliente de ESTE negocio, creándolo si es la primera vez.
 *
 * Al que ya existe no se le pisa el nombre: si el negocio lo tiene guardado
 * como "Camila R. (la del flequillo)", esa nota se queda.
 */
async function buscarOCrearCliente(
  contexto: ContextoNegocio,
  cliente: { telefono: string; nombre: string },
): Promise<string | null> {
  const existente = await buscarClientePorTelefono(contexto, cliente.telefono);
  if (existente) return existente.id;

  const nombre = cliente.nombre.trim();
  if (!nombre) return null;

  const supabase = await createClient();

  // Sin `last_visit_at`: la visita todavía no pasó. La marca la cita cumplida.
  const { data, error } = await supabase
    .from('customers')
    .insert({ business_id: contexto.negocio.id, phone: cliente.telefono, name: nombre })
    .select('id')
    .single();

  if (!error) return data.id;

  // Otro miembro del equipo, o el mismo cliente reservando en línea, lo acaba
  // de crear. Es el mismo cliente: se usa el que quedó.
  if (error.code === DUPLICADO) {
    return (await buscarClientePorTelefono(contexto, cliente.telefono))?.id ?? null;
  }

  console.error('[nueva cita] no se pudo crear el cliente:', {
    businessId: contexto.negocio.id,
    code: error.code,
    message: error.message,
  });
  return null;
}

/**
 * Los servicios que se pueden agendar desde el panel, con quién los presta.
 *
 * El mismo catálogo de la página pública, pero leído con la sesión: RLS sigue
 * protegiendo y no hace falta la llave maestra. El trabajador solo se ve a sí
 * mismo, porque solo agenda en su columna.
 */
export async function catalogoParaAgendar(contexto: ContextoNegocio): Promise<ServicioReservable[]> {
  const catalogo = await obtenerCatalogoReservable(contexto.negocio, await createClient());

  if (contexto.rol !== 'staff') return catalogo;

  return catalogo.map((s) => ({ ...s, trabajadores: s.trabajadores.filter((t) => t.id === contexto.staffId) }));
}

export type CupoSugerido = {
  /** 'HH:MM' en la zona del negocio: lo que se pone en el campo de hora. */
  reloj: string;
  /** "3:30 p. m.", ya formateada en el servidor. */
  etiqueta: string;
};

/**
 * Las horas libres de una persona en un día, como sugerencia.
 *
 * Sale del mismo motor que la página pública —horario, bloqueos y citas—, pero
 * sin su anticipación mínima y con la ventana estirada. Es una ayuda y no un
 * límite: lo que el motor no ofrece, el dueño lo puede escribir a mano.
 */
export async function cuposSugeridos(input: {
  contexto: ContextoNegocio;
  servicio: ServicioReservable;
  staffId: string;
  fecha: string;
  ahora: Date;
}): Promise<CupoSugerido[]> {
  const { contexto, servicio, staffId, fecha, ahora } = input;
  const { timezone } = contexto.negocio;

  const dias = await obtenerDisponibilidad({
    // Sin la anticipación mínima ni la ventana del flujo público: el panel sí
    // puede agendar para dentro de cinco minutos o para dentro de un año, y
    // esas son justo las horas que el dueño busca. Lo que ya pasó el motor lo
    // descarta igual.
    negocio: { ...contexto.negocio, min_notice_minutes: 0, max_advance_days: 366 },
    servicio,
    staffId,
    desde: fecha,
    hasta: fecha,
    ahora,
    cliente: await createClient(),
  });

  return (dias[0]?.cupos ?? []).map((c) => {
    const inicio = new Date(c.inicio);
    return { reloj: relojLocal(timezone, inicio), etiqueta: hora(timezone, inicio) };
  });
}
