import { z } from 'zod';

import type { TurnoSemanal } from '@/lib/scheduling/types';

/**
 * Validación del horario semanal de una persona (tarea D3).
 *
 * La base repite lo importante: turnos que no se cruzan y que terminan después
 * de empezar (supabase/migrations/20260914170001_horario_semanal.sql).
 */

/** En el orden en que se piensa la semana en Colombia: lunes primero. 0 = domingo. */
export const DIAS_SEMANA = [
  { weekday: 1, nombre: 'Lunes', corto: 'Lun' },
  { weekday: 2, nombre: 'Martes', corto: 'Mar' },
  { weekday: 3, nombre: 'Miércoles', corto: 'Mié' },
  { weekday: 4, nombre: 'Jueves', corto: 'Jue' },
  { weekday: 5, nombre: 'Viernes', corto: 'Vie' },
  { weekday: 6, nombre: 'Sábado', corto: 'Sáb' },
  { weekday: 0, nombre: 'Domingo', corto: 'Dom' },
] as const;

export const MAX_TURNOS_POR_DIA = 4;

/** Lo que se sugiere a quien todavía no tiene horario: lunes a sábado, 9 a 19. */
export const HORARIO_SUGERIDO: TurnoSemanal[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  desde: '09:00',
  hasta: '19:00',
}));

/** 'HH:MM' de 00:00 a 23:59. Los turnos que pasan la medianoche no se soportan. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function minutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

const esquemaTurno = z.object({
  weekday: z.number().int().min(0).max(6),
  desde: z.string().regex(HORA, 'Escribe la hora de inicio'),
  hasta: z.string().regex(HORA, 'Escribe la hora de cierre'),
});

export const esquemaHorario = z
  .object({
    staffId: z.uuid('No encontramos a esa persona'),
    turnos: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v || '[]') as unknown;
        } catch {
          ctx.addIssue({ code: 'custom', message: 'No pudimos leer el horario. Recarga la página' });
          return z.NEVER;
        }
      })
      .pipe(z.array(esquemaTurno, 'No pudimos leer el horario. Recarga la página')),
  })
  .superRefine((d, ctx) => {
    for (const dia of DIAS_SEMANA) {
      const delDia = d.turnos
        .filter((t) => t.weekday === dia.weekday)
        .sort((a, b) => minutos(a.desde) - minutos(b.desde));
      const campo = [`dia${dia.weekday}`];

      if (delDia.length > MAX_TURNOS_POR_DIA) {
        ctx.addIssue({ code: 'custom', path: campo, message: `Máximo ${MAX_TURNOS_POR_DIA} turnos por día` });
        continue;
      }

      for (const [i, t] of delDia.entries()) {
        if (minutos(t.hasta) <= minutos(t.desde)) {
          ctx.addIssue({ code: 'custom', path: campo, message: `El turno de las ${t.desde} termina antes de empezar` });
          break;
        }
        const anterior = delDia[i - 1];
        if (anterior && minutos(t.desde) < minutos(anterior.hasta)) {
          ctx.addIssue({ code: 'custom', path: campo, message: 'Dos turnos del mismo día se cruzan' });
          break;
        }
      }
    }
  });

/** "9:00 – 13:00, 14:00 – 19:00" para mostrar el horario de un día. */
export function textoDelDia(turnos: TurnoSemanal[]): string {
  return turnos
    .slice()
    .sort((a, b) => minutos(a.desde) - minutos(b.desde))
    .map((t) => `${t.desde.replace(/^0/, '')} – ${t.hasta.replace(/^0/, '')}`)
    .join(', ');
}
