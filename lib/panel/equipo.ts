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
};

/**
 * Todo el equipo del negocio, activos y desactivados, con los servicios que
 * presta cada uno. Una sola consulta.
 *
 * El businessId sale de requireDueno() en la página que llama. El filtro es
 * explícito aunque RLS ya lo imponga: el dueño también puede leer el equipo
 * público de otros negocios publicados.
 */
export async function obtenerEquipo(businessId: string): Promise<TrabajadorDelPanel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('staff')
    .select('id, name, phone, bio, photo_url, is_active, staff_services(service_id)')
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
