import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Refresco de sesión para proxy.ts.
 *
 * Los tokens de Supabase vencen. Sin esto, a alguien que deja el panel abierto
 * se le cierra la sesión sola a mitad del día. Acá se renuevan y las cookies
 * nuevas viajan en la respuesta.
 *
 * OJO con el manejo de cookies: hay que escribirlas tanto en la petición
 * (para que el resto del renderizado vea la sesión fresca) como en la
 * respuesta (para que el navegador la guarde). Saltarse una de las dos produce
 * sesiones que se caen de forma intermitente y muy difícil de reproducir.
 */
export async function refrescarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalida el token contra Supabase. Es lo que dispara el refresco.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
