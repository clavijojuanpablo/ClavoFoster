import { z } from 'zod';

/**
 * Validación de lo que manda el navegador en el flujo de reserva pública.
 *
 * Acá no hay sesión: todo lo que llega es de un desconocido. El `slug` viaja
 * porque la ruta lo lleva, pero el negocio se resuelve con él en el servidor y
 * nunca se acepta un `business_id` (regla 2 de CLAUDE.md).
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaCupos = z.object({
  slug: z.string().min(1).max(50),
  serviceId: z.uuid(),
  // 'cualquiera' es el "el primero disponible" de la interfaz.
  staffId: z
    .union([z.literal('cualquiera'), z.uuid()])
    .transform((v) => (v === 'cualquiera' ? null : v)),
  // Solo el primer día: cuántos trae cada tanda lo decide el servidor, así que
  // nadie puede pedir un año entero de una.
  desde: z.string().regex(FECHA),
});

export type PeticionDeCupos = z.input<typeof esquemaCupos>;
