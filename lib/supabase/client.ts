import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Cliente de Supabase para el navegador.
 *
 * Usa la llave publicable, que es pública a propósito: lo que protege los datos
 * son las políticas de RLS, no el secreto de esta llave.
 *
 * Se usa sobre todo para suscripciones en vivo (Realtime) en el calendario del
 * panel. Las escrituras van por Server Actions, no desde acá.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
