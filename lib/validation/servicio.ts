import { z } from 'zod';

import { COLORES_SERVICIO } from '@/lib/colores';

/**
 * Validación de un servicio (tarea C1).
 *
 * La base repite los límites con restricciones CHECK
 * (supabase/migrations/20260914130001_servicios.sql). Acá se valida para dar
 * un mensaje claro en el formulario; la garantía es la de la base.
 */

/** Los chips del formulario. Cualquier otra duración va por "Otra". */
export const DURACIONES_SUGERIDAS = [15, 30, 45, 60, 90] as const;

export const DURACION_MIN = 5;
export const DURACION_MAX = 600;
export const PRECIO_MAX_COP = 100_000_000;
export const NOMBRE_MAX = 80;
export const DESCRIPCION_MAX = 300;

type Color = (typeof COLORES_SERVICIO)[number]['valor'];

/**
 * Lee lo que el dueño escribe en el precio: "30.000", "$ 30000", "1.500.000".
 *
 * Solo pesos enteros (ver "Dinero" en CLAUDE.md). Unos centavos al final
 * ("30.000,50") no se ignoran en silencio: se rechazan, porque quitarles la
 * coma convertiría 30 mil en 3 millones.
 */
export function leerPrecio(texto: string): number | 'invalido' | null {
  const limpio = texto.trim();
  if (limpio === '') return null;
  if (/-/.test(limpio) || /[.,]\d{1,2}$/.test(limpio) || /[^\d\s.,$]/.test(limpio)) return 'invalido';
  const digitos = limpio.replace(/\D/g, '');
  return digitos === '' ? 'invalido' : Number(digitos);
}

/** 30000 → "30.000", para mostrarlo mientras se escribe. */
export function formatearPrecio(cop: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(cop);
}

export const esquemaServicio = z.object({
  // Vacío al crear. Al editar llega en un campo oculto: se valida la forma acá
  // y la pertenencia al negocio la resuelven la consulta y RLS.
  id: z.union([z.literal(''), z.uuid('No encontramos ese servicio')]).transform((v) => v || null),
  nombre: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre del servicio')
    .max(NOMBRE_MAX, `El nombre puede tener hasta ${NOMBRE_MAX} caracteres`),
  descripcion: z
    .string()
    .trim()
    .max(DESCRIPCION_MAX, `La descripción puede tener hasta ${DESCRIPCION_MAX} caracteres`)
    .transform((v) => (v === '' ? null : v)),
  duracion: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const minutos = Number(v);
      if (!/^\d+$/.test(v) || minutos < DURACION_MIN || minutos > DURACION_MAX) {
        ctx.addIssue({ code: 'custom', message: 'La duración va de 5 minutos a 10 horas (600 minutos)' });
        return z.NEVER;
      }
      return minutos;
    }),
  precio: z.string().transform((v, ctx) => {
    const cop = leerPrecio(v);
    if (cop === null) {
      ctx.addIssue({ code: 'custom', message: 'Escribe el precio. Si no cobras, escribe 0' });
      return z.NEVER;
    }
    if (cop === 'invalido') {
      ctx.addIssue({ code: 'custom', message: 'Escribe el precio en pesos, sin centavos. Por ejemplo 30.000' });
      return z.NEVER;
    }
    if (cop > PRECIO_MAX_COP) {
      ctx.addIssue({ code: 'custom', message: 'Ese precio es demasiado alto. Revisa que no sobre un cero' });
      return z.NEVER;
    }
    return cop;
  }),
  color: z.enum(COLORES_SERVICIO.map((c) => c.valor) as [Color, ...Color[]], 'Escoge un color'),
});

export type ServicioValidado = z.output<typeof esquemaServicio>;
