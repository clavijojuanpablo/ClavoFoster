import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/types/database';

/**
 * Resolución de tenant.
 *
 * REGLA CENTRAL: el `business_id` se deriva SIEMPRE acá — del slug público
 * verificado o de la sesión del usuario. Jamás se acepta desde el navegador.
 * Si alguna función recibe un business_id por parámetro desde una ruta o un
 * formulario, está mal.
 *
 * Ver regla 2 de CLAUDE.md y docs/05-arquitectura-multitenant.md
 */

export type Rol = 'owner' | 'staff';

/** Lo que cualquiera puede ver de un negocio, sin sesión. */
export type NegocioPublico = Pick<
  Tables<'businesses'>,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'timezone'
  | 'phone'
  | 'address'
  | 'city'
  | 'logo_url'
  | 'cover_url'
  | 'brand_color'
  | 'allow_staff_choice'
  | 'photos'
  // Reglas de reserva. Las necesita el motor de cupos para la página pública.
  // No son secretas —se deducen mirando los cupos que se ofrecen—, pero aun así
  // no viajan al navegador: el cálculo pasa entero en el servidor.
  | 'slot_granularity_minutes'
  | 'min_notice_minutes'
  | 'max_advance_days'
  | 'cancel_notice_minutes'
  | 'align_to_clock'
>;

export type ContextoNegocio = {
  negocio: Tables<'businesses'>;
  rol: Rol;
  staffId: string | null;
};

// Una sola cadena literal, larga a propósito: los tipos de Supabase se deducen
// del texto del select y una concatenación los rompe.
const CAMPOS_PUBLICOS =
  'id, slug, name, category, timezone, phone, address, city, logo_url, cover_url, brand_color, allow_staff_choice, photos, slot_granularity_minutes, min_notice_minutes, max_advance_days, cancel_notice_minutes, align_to_clock';

/**
 * Un slug siempre se guarda en minúsculas, así que /Barberia-Juan y
 * /barberia-juan llegan al mismo negocio.
 */
export function normalizarSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Resuelve el negocio de una ruta pública `/[slug]`.
 *
 * Devuelve null si no existe, si no está publicado o si la suscripción no está
 * activa. Esa decisión no está acá: la toma la política de RLS. Este código
 * consulta con la llave publicable y recibe lo que la base le deja ver.
 */
export const getNegocioPublico = cache(async (slug: string): Promise<NegocioPublico | null> => {
  const supabase = await createClient();

  const { data } = await supabase
    .from('businesses')
    .select(CAMPOS_PUBLICOS)
    .eq('slug', normalizarSlug(slug))
    .maybeSingle();

  return data ?? null;
});

/**
 * Resuelve el negocio del usuario autenticado, para el panel.
 *
 * Devuelve null si no hay sesión o si el usuario no tiene membresía en ningún
 * negocio.
 *
 * Memorizada por petición con `cache`: el layout del panel y la página la
 * llaman en el mismo render, y sin esto serían dos rondas de consultas.
 * No cruza peticiones ni usuarios.
 */
export const getContextoNegocio = cache(async (): Promise<ContextoNegocio | null> => {
  const userId = await getUsuarioId();
  if (!userId) return null;

  const supabase = await createClient();

  // Membresía y negocio en una sola consulta: cada ida y vuelta a la base se
  // paga en cada clic del panel. RLS solo devuelve las membresías del propio
  // usuario y el negocio al que pertenece.
  const { data: membresia } = await supabase
    .from('memberships')
    .select('role, staff_id, businesses(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membresia?.businesses) return null;

  return {
    negocio: membresia.businesses,
    rol: membresia.role as Rol,
    staffId: membresia.staff_id,
  };
});

/**
 * El id del usuario de la sesión, o null.
 *
 * getClaims() verifica la firma del token con la llave pública del proyecto
 * (ES256) sin llamar a Supabase; getUser() hacía una petición al servidor de
 * Auth en cada render. La contracara: una sesión cerrada desde otro lado sigue
 * valiendo hasta que su token vence (1 hora). No abre datos de más: RLS valida
 * el mismo token en cada consulta.
 */
const getUsuarioId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * Igual que getContextoNegocio, pero corta el renderizado si no hay sesión o
 * si el usuario todavía no tiene negocio.
 */
export async function requireNegocio(): Promise<ContextoNegocio> {
  const contexto = await getContextoNegocio();

  if (!contexto) {
    // Con sesión pero sin negocio: le falta terminar el registro (tarea B1).
    redirect((await getUsuarioId()) ? '/bienvenida' : '/login');
  }

  return contexto;
}

/**
 * Para las pantallas que solo puede ver el dueño: contabilidad, configuración,
 * suscripción.
 *
 * Es una comodidad para no renderizar una pantalla que igual saldría vacía.
 * La protección real la dan las políticas de RLS: un trabajador que llame
 * directamente a la base no obtiene esas filas aunque se salte esta función.
 */
export async function requireDueno(): Promise<ContextoNegocio> {
  const contexto = await requireNegocio();

  if (contexto.rol !== 'owner') {
    redirect('/panel');
  }

  return contexto;
}
