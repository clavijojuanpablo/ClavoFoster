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

/** Lo que se le deja escribir al cliente en la nota de la cita. */
export const NOTA_MAX = 200;
export const NOMBRE_MAX = 60;

const slug = z.string().min(1).max(50);

export const esquemaPedirCodigo = z.object({
  slug,
  // El número se valida y se normaliza a E.164 en la acción, con
  // `normalizarCelular`: acá solo se frena lo que ni siquiera parece un número.
  telefono: z.string().trim().min(7).max(20),
});

export const esquemaConfirmarCodigo = z.object({
  slug,
  telefono: z.string().trim().min(7).max(20),
  codigo: z.string().trim().regex(/^\d{6}$/, 'El código son seis números'),
});

export const esquemaReserva = z.object({
  slug,
  serviceId: z.uuid(),
  // Acá sí es un uuid concreto: "el primero disponible" ya se resolvió en una
  // persona cuando el cliente escogió la hora.
  staffId: z.uuid(),
  inicio: z.iso.datetime(),
  token: z.string().min(1).max(500),
  nombre: z
    .string()
    .trim()
    .max(NOMBRE_MAX, `El nombre puede tener hasta ${NOMBRE_MAX} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  nota: z
    .string()
    .trim()
    .max(NOTA_MAX, `La nota puede tener hasta ${NOTA_MAX} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
});

export type PeticionDeCodigo = z.input<typeof esquemaPedirCodigo>;
export type PeticionDeConfirmacion = z.input<typeof esquemaConfirmarCodigo>;
export type PeticionDeReserva = z.input<typeof esquemaReserva>;

/**
 * Mover una cita existente. El permiso es su `manage_token`, que es lo único
 * que se acepta: nunca el id de la cita.
 */
export const esquemaMovida = z.object({
  token: z.string().min(16).max(200),
  inicio: z.iso.datetime(),
  staffId: z.uuid(),
});

export type PeticionDeMovida = z.input<typeof esquemaMovida>;
