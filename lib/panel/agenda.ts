import 'server-only';

import { lunesDeLaSemana, type DatosAgenda, type TrabajadorEnAgenda, type VistaAgenda } from '@/lib/agenda/tipos';
import { colorDeServicio } from '@/lib/colores';
import { fechasEntre, rangoDelDia, sumarDias } from '@/lib/fechas';
import { createClient } from '@/lib/supabase/server';
import type { ContextoNegocio } from '@/lib/tenant';

/**
 * Los datos del calendario del panel (tarea G1).
 *
 * Todo pasa por RLS con la sesión del usuario: no se filtra por `business_id`
 * porque la base ya solo devuelve lo de su negocio. El filtro por trabajador
 * que sí hay es de producto, no de seguridad — ver el flujo 5 de
 * `docs/02-usuarios-y-flujos.md`.
 */

export type {
  BloqueoEnAgenda,
  CitaEnAgenda,
  DatosAgenda,
  TrabajadorEnAgenda,
  TurnoEnAgenda,
  VistaAgenda,
} from '@/lib/agenda/tipos';

export async function obtenerAgenda(
  { negocio, rol, staffId }: ContextoNegocio,
  opciones: { fecha: string; vista: VistaAgenda; trabajador?: string | null },
): Promise<DatosAgenda> {
  const supabase = await createClient();
  const { vista, fecha } = opciones;

  const dias =
    vista === 'semana'
      ? fechasEntre(lunesDeLaSemana(fecha), sumarDias(lunesDeLaSemana(fecha), 6))
      : [fecha];

  const desde = rangoDelDia(negocio.timezone, dias[0]).desde;
  const hasta = rangoDelDia(negocio.timezone, dias[dias.length - 1]).hasta;

  // El trabajador solo ve su agenda. Es de producto: RLS le deja ver todo el
  // negocio, pero su pantalla es la suya.
  const propio = rol === 'staff' ? staffId : null;

  let consultaCitas = supabase
    .from('appointments')
    .select(
      'id, start_at, end_at, status, price_cop, duration_minutes, customer_note, internal_note, staff_id, customers(name, phone), staff(name), services(name, color, display_order)',
    )
    .lt('start_at', hasta.toISOString())
    .gt('end_at', desde.toISOString())
    // Una cancelada ya no ocupa el cupo y llenaría la pantalla de ruido. El
    // historial de la cita sigue existiendo; acá se muestra lo que va a pasar.
    .neq('status', 'cancelled')
    .order('start_at');

  if (propio) consultaCitas = consultaCitas.eq('staff_id', propio);

  const [citas, equipo, turnos, bloqueos] = await Promise.all([
    consultaCitas,
    supabase.from('staff').select('id, name, photo_url').eq('is_active', true).order('display_order'),
    supabase.from('working_hours').select('staff_id, weekday, starts_at, ends_at'),
    supabase
      .from('time_off')
      .select('id, staff_id, starts_at, ends_at, reason')
      .lt('starts_at', hasta.toISOString())
      .gt('ends_at', desde.toISOString()),
  ]);

  const error = citas.error ?? equipo.error ?? turnos.error ?? bloqueos.error;
  if (error) {
    console.error('[agenda] no se pudo cargar:', { code: error.code, message: error.message });
    throw new Error('No pudimos cargar la agenda');
  }

  const todos: TrabajadorEnAgenda[] = (equipo.data ?? []).map((t) => ({
    id: t.id,
    nombre: t.name,
    fotoUrl: t.photo_url,
  }));

  const visibles = propio ? todos.filter((t) => t.id === propio) : todos;

  // En vista de semana las columnas son los siete días, así que solo cabe una
  // persona a la vez. En vista de día se ven todas, salvo que se filtre.
  const escogido = opciones.trabajador
    ? (visibles.find((t) => t.id === opciones.trabajador) ?? null)
    : null;
  const trabajadores =
    vista === 'semana' ? [escogido ?? visibles[0]].filter(Boolean) : escogido ? [escogido] : visibles;

  return {
    vista,
    fecha,
    dias,
    trabajadores,
    equipo: visibles,
    citas: (citas.data ?? []).map((c) => ({
      id: c.id,
      inicio: c.start_at,
      fin: c.end_at,
      estado: c.status,
      cliente: c.customers?.name ?? 'Cliente',
      telefono: c.customers?.phone ?? null,
      servicio: c.services?.name ?? 'Servicio',
      color: colorDeServicio(c.services?.color ?? null, c.services?.display_order ?? 0),
      staffId: c.staff_id,
      trabajador: c.staff?.name ?? '',
      precioCop: c.price_cop,
      duracionMinutos: c.duration_minutes,
      notaDelCliente: c.customer_note,
      notaInterna: c.internal_note,
    })),
    turnos: (turnos.data ?? []).map((t) => ({
      staffId: t.staff_id,
      weekday: t.weekday,
      desde: t.starts_at,
      hasta: t.ends_at,
    })),
    bloqueos: (bloqueos.data ?? []).map((b) => ({
      id: b.id,
      staffId: b.staff_id,
      inicio: b.starts_at,
      fin: b.ends_at,
      motivo: b.reason,
    })),
  };
}
