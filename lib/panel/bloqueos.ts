import { createClient } from '@/lib/supabase/server';

export type BloqueoDelPanel = {
  id: string;
  /** null: todo el local. */
  staffId: string | null;
  quien: string;
  inicio: Date;
  fin: Date;
  motivo: string | null;
};

export type CitaAfectada = {
  id: string;
  inicio: string;
  cliente: string;
  servicio: string;
  trabajador: string;
};

/**
 * Bloqueos que todavía no terminan, en orden. Los pasados no se muestran: ya no
 * cambian nada.
 */
export async function obtenerBloqueosProximos(businessId: string, ahora: Date): Promise<BloqueoDelPanel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('time_off')
    .select('id, staff_id, starts_at, ends_at, reason, staff(name)')
    .eq('business_id', businessId)
    .gt('ends_at', ahora.toISOString())
    .order('starts_at');

  if (error) {
    console.error('[bloqueos] no se pudieron leer:', { businessId, code: error.code, message: error.message });
    throw new Error('No pudimos cargar los bloqueos');
  }

  return data.map((b) => ({
    id: b.id,
    staffId: b.staff_id,
    quien: b.staff_id ? (b.staff?.name ?? 'Persona') : 'Todo el local',
    inicio: new Date(b.starts_at),
    fin: new Date(b.ends_at),
    motivo: b.reason,
  }));
}

/**
 * Citas agendadas que se cruzan con un rango: las de una persona, o las de
 * todos si el bloqueo es del local entero. Se le muestran al dueño antes de
 * bloquear; no se cancelan.
 *
 * Cruzarse es empezar antes de que termine el bloqueo y terminar después de que
 * empiece. Una cita que termina justo cuando empieza el bloqueo no se cruza.
 */
export async function citasQueSeCruzan(
  businessId: string,
  staffId: string | null,
  inicio: Date,
  fin: Date,
): Promise<CitaAfectada[]> {
  const supabase = await createClient();

  let consulta = supabase
    .from('appointments')
    .select('id, start_at, customers(name), services(name), staff(name)')
    .eq('business_id', businessId)
    .in('status', ['pending', 'confirmed'])
    .lt('start_at', fin.toISOString())
    .gt('end_at', inicio.toISOString())
    .order('start_at');

  if (staffId) consulta = consulta.eq('staff_id', staffId);

  const { data, error } = await consulta;

  if (error) {
    console.error('[bloqueos] no se pudieron revisar las citas:', { businessId, code: error.code, message: error.message });
    throw new Error('No pudimos revisar las citas de ese rango');
  }

  return data.map((c) => ({
    id: c.id,
    inicio: c.start_at,
    cliente: c.customers?.name ?? 'Cliente',
    servicio: c.services?.name ?? 'Servicio',
    trabajador: c.staff?.name ?? '',
  }));
}
