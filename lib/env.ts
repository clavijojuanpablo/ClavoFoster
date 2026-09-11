import { z } from 'zod';

/**
 * Validación de variables de entorno.
 *
 * Falla al arrancar, no a mitad de una petición. Un secreto faltante que se
 * descubre cuando un cliente intenta reservar es mucho peor que un arranque
 * que se niega a levantar.
 *
 * Ver docs/12-convenciones-de-desarrollo.md
 */

// Las NEXT_PUBLIC_ tienen que referenciarse de forma literal para que Next.js
// las reemplace en el bundle. No se pueden leer con process.env[variable].
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
});

if (!publicParsed.success) {
  throw new Error(
    `Variables de entorno públicas inválidas o faltantes:\n${z.prettifyError(publicParsed.error)}\n\n` +
      'Copia .env.example a .env.local y llena los valores. ' +
      'Los de Supabase los imprime `npm run db:start`.',
  );
}

export const env = publicParsed.data;

/**
 * Variables que SOLO existen en el servidor.
 *
 * Se leen de forma perezosa: si se evaluaran al importar, cualquier módulo que
 * las importe desde el navegador reventaría el build.
 */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() no se puede llamar desde el navegador.');
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Variables de entorno de servidor inválidas o faltantes:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}
