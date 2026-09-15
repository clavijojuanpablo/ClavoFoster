import { z } from 'zod';

import { normalizarCelular } from '@/lib/validation/telefono';

/**
 * Validación de un trabajador y de los servicios que presta (tareas D1 y D2).
 *
 * La base repite los límites con restricciones CHECK y llaves compuestas
 * (supabase/migrations/20260914150001_equipo.sql). Acá se valida para dar un
 * mensaje claro en el formulario; la garantía es la de la base.
 */

export const NOMBRE_TRABAJADOR_MAX = 80;
export const PERFIL_MAX = 300;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Carpeta de las fotos del equipo dentro de la del negocio. */
export function carpetaEquipo(businessId: string): string {
  return `${businessId}/equipo`;
}

/**
 * Construye el esquema para un negocio concreto: la foto solo puede estar en la
 * carpeta de ESE negocio. El businessId viene de la sesión, nunca del
 * formulario.
 */
export function esquemaTrabajador(businessId: string) {
  const foto = new RegExp(`^${carpetaEquipo(businessId)}/${UUID}\\.jpg$`);

  return z.object({
    // Vacío al crear. Al editar llega en un campo oculto: la pertenencia al
    // negocio la resuelven la consulta y RLS.
    id: z.union([z.literal(''), z.uuid('No encontramos a esa persona')]).transform((v) => v || null),
    nombre: z
      .string()
      .trim()
      .min(2, 'Escribe el nombre')
      .max(NOMBRE_TRABAJADOR_MAX, `El nombre puede tener hasta ${NOMBRE_TRABAJADOR_MAX} caracteres`),
    // Opcional: muchos dueños cargan a su equipo sin pedirle el número.
    celular: z.string().transform((valor, ctx) => {
      if (valor.trim() === '') return null;
      const normalizado = normalizarCelular(valor);
      if (!normalizado) {
        ctx.addIssue({ code: 'custom', message: 'Escribe un celular válido, por ejemplo 300 123 4567' });
        return z.NEVER;
      }
      return normalizado;
    }),
    perfil: z
      .string()
      .trim()
      .max(PERFIL_MAX, `El perfil puede tener hasta ${PERFIL_MAX} caracteres`)
      .transform((v) => (v === '' ? null : v)),
    foto: z
      .string()
      .trim()
      .refine((v) => v === '' || foto.test(v), 'La foto no pertenece a este negocio. Súbela de nuevo')
      .transform((v) => v || null),
    servicios: z.array(z.uuid('Uno de los servicios no es válido')).transform((ids) => [...new Set(ids)]),
  });
}

export type TrabajadorValidado = z.output<ReturnType<typeof esquemaTrabajador>>;
