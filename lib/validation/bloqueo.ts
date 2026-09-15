import { z } from 'zod';

import { rangoDelDia } from '@/lib/fechas';
import { aInstanteUtc, partirFecha, partirHora } from '@/lib/scheduling/timezone';

/**
 * Validación de un bloqueo o ausencia (tarea D4).
 *
 * El dueño escribe fechas y horas de reloj del negocio; se guardan instantes
 * UTC (regla 3 de CLAUDE.md). La conversión está en `rangoDelBloqueo`.
 */

export const MOTIVO_MAX = 120;
/** Un bloqueo más largo que esto es casi seguro un error al escoger la fecha. */
export const DIAS_MAX = 180;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const fecha = (mensaje: string) => z.string().regex(FECHA, mensaje);
const hora = (mensaje: string) => z.string().regex(HORA, mensaje);

const base = {
  // 'local' cierra el negocio entero; si no, el id de la persona.
  quien: z.union([z.literal('local'), z.uuid('Escoge a quién bloquear')]).transform((v) => (v === 'local' ? null : v)),
  motivo: z
    .string()
    .trim()
    .max(MOTIVO_MAX, `El motivo puede tener hasta ${MOTIVO_MAX} caracteres`)
    .transform((v) => (v === '' ? null : v)),
};

export const esquemaBloqueo = z.discriminatedUnion('tipo', [
  z
    .object({
      tipo: z.literal('horas'),
      fecha: fecha('Escoge el día'),
      desde: hora('Escribe desde qué hora'),
      hasta: hora('Escribe hasta qué hora'),
      ...base,
    })
    .refine((d) => d.hasta > d.desde, { message: 'La hora final tiene que ser después de la inicial', path: ['hasta'] }),
  z
    .object({
      tipo: z.literal('dias'),
      fechaDesde: fecha('Escoge desde qué día'),
      fechaHasta: fecha('Escoge hasta qué día'),
      ...base,
    })
    .refine((d) => d.fechaHasta >= d.fechaDesde, {
      message: 'El último día tiene que ser igual o posterior al primero',
      path: ['fechaHasta'],
    })
    .refine((d) => diasEntre(d.fechaDesde, d.fechaHasta) < DIAS_MAX, {
      message: `Un bloqueo puede durar hasta ${DIAS_MAX} días`,
      path: ['fechaHasta'],
    }),
]);

export type BloqueoValidado = z.output<typeof esquemaBloqueo>;

function diasEntre(desde: string, hasta: string): number {
  const a = partirFecha(desde);
  const b = partirFecha(hasta);
  return (Date.UTC(b.año, b.mes - 1, b.dia) - Date.UTC(a.año, a.mes - 1, a.dia)) / 86_400_000;
}

/**
 * Instantes UTC del bloqueo en la zona del negocio.
 *
 * Días completos: desde la medianoche local del primer día hasta la medianoche
 * local del día siguiente al último. Así "del 21 al 25" incluye el 25 entero,
 * y un día con cambio de horario dura lo que de verdad dura.
 */
export function rangoDelBloqueo(datos: BloqueoValidado, timezone: string): { inicio: Date; fin: Date } {
  if (datos.tipo === 'dias') {
    return { inicio: rangoDelDia(timezone, datos.fechaDesde).desde, fin: rangoDelDia(timezone, datos.fechaHasta).hasta };
  }

  const { año, mes, dia } = partirFecha(datos.fecha);
  const desde = partirHora(datos.desde);
  const hasta = partirHora(datos.hasta);

  return {
    inicio: aInstanteUtc(timezone, año, mes, dia, desde.hora, desde.minuto),
    fin: aInstanteUtc(timezone, año, mes, dia, hasta.hora, hasta.minuto),
  };
}
