import { z } from 'zod';

/**
 * Validación de la cita que el negocio agenda desde el panel (G3).
 *
 * La hora llega como reloj local del negocio —fecha y 'HH:MM', lo que escribe
 * el dueño— y se vuelve instante UTC en el servidor, con la zona del negocio
 * que sale de la sesión. El navegador nunca decide la zona horaria.
 */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 'YYYY-MM-DD' que exista en el calendario: '2026-02-30' no pasa. */
const fecha = (mensaje: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, mensaje)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, mensaje);

export const NOTA_INTERNA_MAX = 300;
export const NOMBRE_CLIENTE_MAX = 60;

export const esquemaCuposPanel = z.object({
  serviceId: z.uuid(),
  staffId: z.uuid(),
  fecha: fecha('Ese día no es válido'),
});

export const esquemaBuscarCliente = z.object({
  telefono: z.string().trim().min(7).max(20),
});

export const esquemaNuevaCita = z.object({
  serviceId: z.uuid({ error: 'Escoge un servicio' }),
  staffId: z.uuid({ error: 'Escoge quién atiende' }),
  fecha: fecha('Escoge el día'),
  hora: z.string().regex(HORA, 'Escoge la hora'),
  // Se normaliza a E.164 en la acción, con `normalizarCelular`.
  telefono: z.string().trim().min(7, 'Escribe el celular del cliente').max(20, 'Ese número es muy largo'),
  nombre: z
    .string()
    .trim()
    .max(NOMBRE_CLIENTE_MAX, `El nombre puede tener hasta ${NOMBRE_CLIENTE_MAX} caracteres`),
  nota: z
    .string()
    .trim()
    .max(NOTA_INTERNA_MAX, `La nota puede tener hasta ${NOTA_INTERNA_MAX} caracteres`)
    .transform((v) => (v === '' ? null : v)),
  origen: z.enum(['manual', 'walk_in']),
});

export type PeticionDeCuposPanel = z.input<typeof esquemaCuposPanel>;
export type PeticionDeNuevaCita = z.input<typeof esquemaNuevaCita>;
