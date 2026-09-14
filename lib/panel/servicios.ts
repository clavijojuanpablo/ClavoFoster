import { colorDeServicio } from '@/lib/colores';
import { createClient } from '@/lib/supabase/server';

export type ServicioDelPanel = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  precioCop: number;
  /** Siempre un color: el escogido o el de su posición en la paleta. */
  color: string;
  activo: boolean;
};

/**
 * Todos los servicios del negocio, activos y desactivados, en el orden en que
 * los ve el cliente.
 *
 * El businessId sale de requireDueno() en la página que llama. El filtro por
 * negocio es explícito aunque RLS ya lo imponga: el dueño también puede leer
 * los servicios públicos de otros negocios publicados.
 */
export async function obtenerServicios(businessId: string): Promise<ServicioDelPanel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price_cop, color, display_order, is_active')
    .eq('business_id', businessId)
    .order('display_order')
    .order('created_at');

  if (error) {
    console.error('[servicios] no se pudieron leer:', { businessId, code: error.code, message: error.message });
    throw new Error('No pudimos cargar los servicios');
  }

  return data.map((s) => ({
    id: s.id,
    nombre: s.name,
    descripcion: s.description,
    duracionMinutos: s.duration_minutes,
    precioCop: s.price_cop,
    color: colorDeServicio(s.color, s.display_order),
    activo: s.is_active,
  }));
}
