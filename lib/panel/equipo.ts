import type { TurnoSemanal } from '@/lib/scheduling/types';
import { createClient } from '@/lib/supabase/server';

export type TrabajadorDelPanel = {
  id: string;
  nombre: string;
  celular: string | null;
  perfil: string | null;
  /** Ruta dentro del bucket de fotos, no URL. Ver lib/fotos.ts. */
  foto: string | null;
  activo: boolean;
  /** Ids de los servicios que presta, activos o no. */
  servicios: string[];
  /** Horario semanal, en hora local del negocio. */
  turnos: TurnoSemanal[];
};

/**
 * Todo el equipo del negocio, activos y desactivados, con los servicios que
 * presta cada uno y su horario. Una sola consulta.
 *
 * El businessId sale de requireDueno() en la página que llama. El filtro es
 * explícito aunque RLS ya lo imponga: el dueño también puede leer el equipo
 * público de otros negocios publicados.
 */
export async function obtenerEquipo(businessId: string): Promise<TrabajadorDelPanel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, phone, bio, photo_url, is_active, staff_services(service_id), working_hours(weekday, starts_at, ends_at)')
    .eq('business_id', businessId)
    .order('display_order')
    .order('created_at');

  if (error) {
    console.error('[equipo] no se pudo leer:', { businessId, code: error.code, message: error.message });
    throw new Error('No pudimos cargar el equipo');
  }

  return data.map((t) => ({
    id: t.id,
    nombre: t.name,
    celular: t.phone,
    perfil: t.bio,
    foto: t.photo_url,
    activo: t.is_active,
    servicios: t.staff_services.map((s) => s.service_id),
    // La base devuelve 'HH:MM:SS'; el motor y el formulario trabajan con 'HH:MM'.
    turnos: t.working_hours.map((h) => ({ weekday: h.weekday, desde: h.starts_at.slice(0, 5), hasta: h.ends_at.slice(0, 5) })),
  }));
}

/**
 * Cuántas citas tiene la persona desde ahora. Se le muestra al dueño antes de
 * desactivarla: esas citas no se cancelan solas.
 */
export async function contarCitasProximas(businessId: string, staffId: string, ahora: Date): Promise<number | null> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('staff_id', staffId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_at', ahora.toISOString());

  if (error) {
    // No es crítico: el editor funciona sin el aviso. null y no 0, para no
    // decirle al dueño que no hay citas cuando no se pudo saber.
    console.error('[equipo] no se pudieron contar las citas:', { businessId, code: error.code, message: error.message });
    return null;
  }

  return count ?? 0;
}

export type CitaAgendada = {
  id: string;
  inicio: string;
  cliente: string;
  servicio: string;
  /** Rango que de verdad ocupa, con buffers: es el que tiene que caber en el horario. */
  ocupa: { inicio: Date; fin: Date };
};

/**
 * Citas de la persona desde ahora, para revisar cuáles quedan por fuera de un
 * horario nuevo. No se mueven ni se cancelan: solo se le muestran al dueño.
 */
export async function obtenerCitasProximas(businessId: string, staffId: string, ahora: Date): Promise<CitaAgendada[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_at, end_at, buffer_before_minutes, buffer_after_minutes, customers(name), services(name)')
    .eq('business_id', businessId)
    .eq('staff_id', staffId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_at', ahora.toISOString())
    .order('start_at');

  if (error) {
    console.error('[equipo] no se pudieron leer las citas próximas:', { businessId, code: error.code, message: error.message });
    throw new Error('No pudimos revisar las citas próximas');
  }

  return data.map((c) => ({
    id: c.id,
    inicio: c.start_at,
    cliente: c.customers?.name ?? 'Cliente',
    servicio: c.services?.name ?? 'Servicio',
    ocupa: {
      inicio: new Date(new Date(c.start_at).getTime() - c.buffer_before_minutes * 60_000),
      fin: new Date(new Date(c.end_at).getTime() + c.buffer_after_minutes * 60_000),
    },
  }));
}
