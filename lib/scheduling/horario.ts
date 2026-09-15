import { jornadaDelDia } from './availability';
import { fechaLocalDe } from './timezone';
import type { Intervalo, TurnoSemanal } from './types';

/**
 * Qué citas quedan por fuera de un horario semanal.
 *
 * Se usa al cambiar el horario de alguien (tarea D3): las citas ya agendadas
 * no se mueven ni se cancelan solas, pero el dueño tiene que saber cuáles
 * quedaron por fuera para decidir qué hacer con cada una.
 *
 * Una cita está dentro si su rango ocupado —con buffers— cabe entero en un
 * turno de su día. Los turnos pegados (9–13 y 13–19) cuentan como uno solo,
 * igual que al calcular cupos: `jornadaDelDia` ya los funde.
 */

export function quedaFueraDelHorario(ocupa: Intervalo, turnos: TurnoSemanal[], timezone: string): boolean {
  const jornada = jornadaDelDia(fechaLocalDe(timezone, ocupa.inicio), turnos, timezone);

  return !jornada.some((tramo) => tramo.inicio <= ocupa.inicio && ocupa.fin <= tramo.fin);
}

export function citasFueraDelHorario<T extends { ocupa: Intervalo }>(
  citas: T[],
  turnos: TurnoSemanal[],
  timezone: string,
): T[] {
  return citas.filter((c) => quedaFueraDelHorario(c.ocupa, turnos, timezone));
}
