import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Cliente de Supabase para el servidor, atado a la sesión del usuario.
 *
 * Este es el cliente que se usa por defecto en todo el panel: las consultas
 * pasan por las políticas de RLS con la identidad de quien está autenticado.
 * Si una consulta devuelve menos datos de los esperados, casi siempre es RLS
 * haciendo su trabajo — no un bug.
 *
 * Ver docs/05-arquitectura-multitenant.md
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. Se ignora a
            // propósito: el middleware es el que refresca la sesión.
          }
        },
      },
    },
  );
}
