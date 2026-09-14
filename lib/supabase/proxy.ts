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

  // getClaims() renueva el token si venció (eso escribe las cookies nuevas) y
  // verifica su firma con la llave pública, sin llamar a Supabase en cada
  // petición. Ver getUsuarioId() en lib/tenant.ts.
  const { data } = await supabase.auth.getClaims();

  return { response, user: data?.claims.sub ? { id: data.claims.sub } : null };
}
