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
>;

export type ContextoNegocio = {
  negocio: Tables<'businesses'>;
  rol: Rol;
  staffId: string | null;
};

const CAMPOS_PUBLICOS =
  'id, slug, name, category, timezone, phone, address, city, logo_url, cover_url, brand_color, allow_staff_choice, photos';

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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Se lee la membresía del propio usuario: RLS solo devuelve las suyas.
  const { data: membresia } = await supabase
    .from('memberships')
    .select('role, staff_id, business_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membresia) return null;

  const { data: negocio } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', membresia.business_id)
    .maybeSingle();

  if (!negocio) return null;

  return {
    negocio,
    rol: membresia.role as Rol,
    staffId: membresia.staff_id,
  };
});

/**
 * Igual que getContextoNegocio, pero corta el renderizado si no hay sesión o
 * si el usuario todavía no tiene negocio.
 */
export async function requireNegocio(): Promise<ContextoNegocio> {
  const contexto = await getContextoNegocio();

  if (!contexto) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Con sesión pero sin negocio: le falta terminar el registro (tarea B1).
    redirect(user ? '/bienvenida' : '/login');
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
