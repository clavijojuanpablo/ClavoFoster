import { env } from '@/lib/env';

/** Bucket de Storage con las fotos del local. Público para leer. */
export const BUCKET_FOTOS = 'business-photos';

/**
 * URL pública de una foto a partir de la ruta guardada en `businesses.photos`.
 *
 * Se guardan rutas y no URLs: si cambia el dominio de Storage, basta con cambiar
 * esta función.
 */
export function urlDeFoto(ruta: string): string {
  const segmentos = ruta.split('/').map(encodeURIComponent).join('/');
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_FOTOS}/${segmentos}`;
}
