import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env, serverEnv } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * ⚠️  CLIENTE PRIVILEGIADO — SALTA TODAS LAS POLÍTICAS DE RLS.
 *
 * Es la llave maestra de la base de datos. Con este cliente, una consulta sin
 * filtro de negocio devuelve las filas de TODOS los negocios.
 *
 * USO PERMITIDO, y en ningún otro lugar:
 *
 *   1. La reserva desde la página pública: calcular los cupos libres
 *      (`lib/booking/disponibilidad.ts`) y crear la cita. El cliente final no
 *      tiene sesión, así que no hay identidad que RLS pueda evaluar.
 *   2. Procesar webhooks entrantes (pasarela de pagos, WhatsApp).
 *      Los origina un tercero, no un usuario autenticado.
 *   3. Trabajos programados (recordatorios, limpieza de retenciones vencidas).
 *
 * En cualquier otro caso se usa `lib/supabase/server.ts`, que respeta RLS.
 *
 * Un pull request que use este cliente fuera de esos tres casos se devuelve.
 * Ver docs/12-convenciones-de-desarrollo.md
 *
 * REGLA QUE ACOMPAÑA A ESTE CLIENTE: el `business_id` se deriva SIEMPRE en el
 * servidor —del slug verificado o de la sesión—, nunca de algo que haya
 * mandado el navegador. Sin RLS de por medio, esa es la única barrera que
 * queda entre un negocio y los datos de otro.
 */
export function createAdminClient() {
  const { SUPABASE_SECRET_KEY } = serverEnv();

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
