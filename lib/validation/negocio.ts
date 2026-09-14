import { z } from 'zod';

import { normalizarCelular } from '@/lib/validation/telefono';

/**
 * Validación del registro y del alta de negocio.
 *
 * La base de datos repite estas reglas con restricciones CHECK
 * (supabase/migrations/20260912120001_registro_de_negocio.sql): create_business
 * se puede llamar por RPC saltándose este archivo. Acá se valida para dar un
 * mensaje claro en el formulario; la garantía es la de la base.
 */

export const CATEGORIAS = [
  { valor: 'barbershop', nombre: 'Barbería' },
  { valor: 'salon', nombre: 'Peluquería' },
  { valor: 'spa', nombre: 'Spa' },
  { valor: 'tattoo', nombre: 'Tatuajes' },
  { valor: 'aesthetics', nombre: 'Cosmetología' },
] as const;

export type Categoria = (typeof CATEGORIAS)[number]['valor'];

const VALORES_CATEGORIA = CATEGORIAS.map((c) => c.valor) as [Categoria, ...Categoria[]];

/** Mismo listado que el CHECK `slug_no_reservado`. Si se agrega una ruta de primer nivel, va en los dos. */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  'api', 'admin', 'app', 'auth', 'login', 'signup', 'registro', 'bienvenida',
  'panel', 'cuenta', 'dashboard', 'static', 'assets', 'public', 'soporte',
  'ayuda', 'salir', 'configuracion', 'recuperar', 'cita', 'citas', 'reservar',
  'precios', 'planes', 'terminos', 'privacidad', 'contacto', 'blog',
  'www', 'mail', 'plataforma', 'bookia',
]);

/** Mismo patrón que el CHECK `slug_formato`. */
const FORMATO_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export const SLUG_MAX = 50;

/**
 * Propone un slug a partir del nombre: "Barbería Don Juan" → "barberia-don-juan".
 *
 * Es una sugerencia para no hacerle escribir el link al dueño, no una
 * validación: el resultado igual pasa por `esquemaSlug`.
 */
export function sugerirSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // tildes, diéresis y la virgulilla de la ñ
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

/**
 * Alternativas para cuando el slug ya está tomado: "barberia-juan" →
 * "barberia-juan-2", "barberia-juan-3"... Recorta la base si hace falta para no
 * pasar del máximo.
 */
export function alternativasDeSlug(slug: string, cantidad = 4): string[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const sufijo = `-${i + 2}`;
    const base = slug.slice(0, SLUG_MAX - sufijo.length).replace(/-+$/g, '');
    return `${base}${sufijo}`;
  });
}

export const esquemaSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'El link necesita al menos 2 caracteres')
  .max(SLUG_MAX, `El link puede tener hasta ${SLUG_MAX} caracteres`)
  .regex(FORMATO_SLUG, 'Usa solo letras sin tildes, números y guiones, sin guion al inicio ni al final')
  .refine((slug) => !SLUGS_RESERVADOS.has(slug), 'Ese link está reservado. Prueba con otro');

const esquemaNombreNegocio = z
  .string()
  .trim()
  .min(2, 'Escribe el nombre del negocio')
  .max(80, 'El nombre puede tener hasta 80 caracteres');

const esquemaCelular = z
  .string()
  .transform((valor, ctx) => {
    const normalizado = normalizarCelular(valor);
    if (!normalizado) {
      ctx.addIssue({ code: 'custom', message: 'Escribe un celular válido, por ejemplo 300 123 4567' });
      return z.NEVER;
    }
    return normalizado;
  });

/** Paso 1 del flujo 6: crear la cuenta. El negocio todavía no existe. */
export const esquemaRegistro = z.object({
  // trim antes de validar: un espacio pegado al copiar el correo no es un error del dueño.
  email: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido')),
  password: z
    .string()
    .min(8, 'La contraseña necesita al menos 8 caracteres')
    .max(72, 'La contraseña puede tener hasta 72 caracteres'),
  nombreNegocio: esquemaNombreNegocio,
  celular: esquemaCelular,
});

/** Crear el negocio, ya con sesión: tipo y link público. */
export const esquemaAltaNegocio = z.object({
  nombreNegocio: esquemaNombreNegocio,
  celular: esquemaCelular,
  categoria: z.enum(VALORES_CATEGORIA, 'Escoge el tipo de negocio'),
  slug: esquemaSlug,
});

/** Primer mensaje de error por campo, para pintarlo debajo de cada input. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? '');
    if (campo && !campos[campo]) campos[campo] = issue.message;
  }
  return campos;
}
