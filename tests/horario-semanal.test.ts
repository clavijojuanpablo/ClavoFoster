import { describe, expect, it } from 'vitest';

import { citasFueraDelHorario, quedaFueraDelHorario } from '@/lib/scheduling/horario';
import { aInstanteUtc, fechaLocalDe } from '@/lib/scheduling/timezone';
import type { Intervalo, TurnoSemanal } from '@/lib/scheduling/types';

/**
 * Citas por fuera de un horario semanal (D3).
 *
 * 2026-09-14 es lunes. Bogotá es UTC-5, sin horario de verano.
 */

const BOGOTA = 'America/Bogota';

// Lunes partido 9–13 y 14–19; martes 9–13 y 13–19 (pegados); domingo cerrado.
const TURNOS: TurnoSemanal[] = [
  { weekday: 1, desde: '09:00', hasta: '13:00' },
  { weekday: 1, desde: '14:00', hasta: '19:00' },
  { weekday: 2, desde: '09:00', hasta: '13:00' },
  { weekday: 2, desde: '13:00', hasta: '19:00' },
];

function local(dia: number, hora: number, minuto = 0): Date {
  return aInstanteUtc(BOGOTA, 2026, 9, dia, hora, minuto);
}

function cita(dia: number, desde: [number, number], hasta: [number, number]): Intervalo {
  return { inicio: local(dia, ...desde), fin: local(dia, ...hasta) };
}

describe('quedaFueraDelHorario', () => {
  it('una cita dentro de un turno está dentro', () => {
    expect(quedaFueraDelHorario(cita(14, [9, 0], [9, 45]), TURNOS, BOGOTA)).toBe(false);
  });

  it('una cita que termina justo al cierre del turno está dentro', () => {
    expect(quedaFueraDelHorario(cita(14, [18, 15], [19, 0]), TURNOS, BOGOTA)).toBe(false);
  });

  it('una cita en el hueco del almuerzo queda por fuera', () => {
    expect(quedaFueraDelHorario(cita(14, [13, 0], [13, 30]), TURNOS, BOGOTA)).toBe(true);
  });

  it('una cita que se pasa del cierre del turno queda por fuera', () => {
    expect(quedaFueraDelHorario(cita(14, [12, 30], [13, 15]), TURNOS, BOGOTA)).toBe(true);
  });

  it('con turnos pegados, una cita que cruza de uno a otro está dentro', () => {
    expect(quedaFueraDelHorario(cita(15, [12, 30], [13, 30]), TURNOS, BOGOTA)).toBe(false);
  });

  it('un día sin horario deja todo por fuera', () => {
    expect(quedaFueraDelHorario(cita(20, [10, 0], [11, 0]), TURNOS, BOGOTA)).toBe(true);
  });

  it('sin ningún turno, todo queda por fuera', () => {
    expect(quedaFueraDelHorario(cita(14, [10, 0], [11, 0]), [], BOGOTA)).toBe(true);
  });

  // Las 20:00 del lunes en Bogotá ya son martes en UTC: el día sale de la hora
  // local, no de la UTC.
  it('usa el día local, no el de UTC', () => {
    const tarde = cita(14, [18, 30], [19, 0]);
    expect(tarde.inicio.getUTCDay()).toBe(1);
    const noche: Intervalo = { inicio: local(14, 19, 30), fin: local(14, 20, 0) };
    expect(noche.inicio.getUTCDate()).toBe(15);
    expect(fechaLocalDe(BOGOTA, noche.inicio)).toBe('2026-09-14');
    // 19:30 del lunes: fuera, aunque el martes en UTC sí tendría turno a esa hora.
    expect(quedaFueraDelHorario(noche, TURNOS, BOGOTA)).toBe(true);
  });
});

describe('citasFueraDelHorario', () => {
  it('devuelve solo las de afuera, conservando sus datos', () => {
    const citas = [
      { id: 'dentro', ocupa: cita(14, [9, 0], [10, 0]) },
      { id: 'almuerzo', ocupa: cita(14, [13, 15], [13, 45]) },
      { id: 'domingo', ocupa: cita(20, [10, 0], [10, 30]) },
    ];

    expect(citasFueraDelHorario(citas, TURNOS, BOGOTA).map((c) => c.id)).toEqual(['almuerzo', 'domingo']);
  });
});
