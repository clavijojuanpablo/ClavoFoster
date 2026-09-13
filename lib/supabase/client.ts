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
 *
 * Única excepción: subir archivos a Storage (fotos del negocio). Una foto de
 * celular pasa el límite de 1 MB del cuerpo de una Server Action, y la política
 * de storage.objects ya verifica en la base que la carpeta sea de un negocio
 * del que el usuario es dueño. Guardar la ruta en la tabla sí va por Server
 * Action.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
