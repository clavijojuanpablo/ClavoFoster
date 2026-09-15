import { describe, expect, it } from 'vitest';

import { esquemaHorario, textoDelDia } from '@/lib/validation/horario';

const STAFF = '11111111-1111-4111-8111-111111111111';

function validar(turnos: unknown) {
  return esquemaHorario.safeParse({ staffId: STAFF, turnos: JSON.stringify(turnos) });
}

function errores(turnos: unknown): Record<string, string> {
  const r = validar(turnos);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('esquemaHorario', () => {
  it('acepta turno partido y días sin horario', () => {
    const r = validar([
      { weekday: 1, desde: '09:00', hasta: '13:00' },
      { weekday: 1, desde: '14:00', hasta: '19:00' },
      { weekday: 6, desde: '08:30', hasta: '12:00' },
    ]);
    expect(r.success).toBe(true);
  });

  it('acepta un horario vacío: la persona no atiende ningún día', () => {
    expect(validar([]).success).toBe(true);
  });

  it('acepta turnos pegados (13:00 y 13:00)', () => {
    expect(
      validar([
        { weekday: 2, desde: '09:00', hasta: '13:00' },
        { weekday: 2, desde: '13:00', hasta: '19:00' },
      ]).success,
    ).toBe(true);
  });

  it('rechaza turnos que se cruzan, con el error en ese día', () => {
    expect(
      errores([
        { weekday: 3, desde: '09:00', hasta: '13:00' },
        { weekday: 3, desde: '12:00', hasta: '18:00' },
      ]),
    ).toEqual({ dia3: 'Dos turnos del mismo día se cruzan' });
  });

  it('detecta el cruce aunque los turnos lleguen desordenados', () => {
    expect(
      errores([
        { weekday: 4, desde: '14:00', hasta: '19:00' },
        { weekday: 4, desde: '09:00', hasta: '15:00' },
      ]).dia4,
    ).toBeDefined();
  });

  it('rechaza un turno que termina antes de empezar', () => {
    expect(errores([{ weekday: 5, desde: '19:00', hasta: '09:00' }]).dia5).toContain('termina antes de empezar');
    expect(errores([{ weekday: 5, desde: '09:00', hasta: '09:00' }]).dia5).toBeDefined();
  });

  it('rechaza horas mal escritas', () => {
    expect(validar([{ weekday: 1, desde: '9:00', hasta: '13:00' }]).success).toBe(false);
    expect(validar([{ weekday: 1, desde: '09:00', hasta: '24:00' }]).success).toBe(false);
    expect(validar([{ weekday: 1, desde: '', hasta: '13:00' }]).success).toBe(false);
  });

  it('rechaza días fuera de 0 a 6', () => {
    expect(validar([{ weekday: 7, desde: '09:00', hasta: '13:00' }]).success).toBe(false);
  });

  it('limita a 4 turnos por día', () => {
    const cinco = [8, 10, 12, 14, 16].map((h) => ({
      weekday: 1,
      desde: `${String(h).padStart(2, '0')}:00`,
      hasta: `${String(h + 1).padStart(2, '0')}:00`,
    }));
    expect(errores(cinco).dia1).toBe('Máximo 4 turnos por día');
  });

  it('rechaza un JSON roto o un id que no es uuid', () => {
    expect(esquemaHorario.safeParse({ staffId: STAFF, turnos: '[{' }).success).toBe(false);
    expect(esquemaHorario.safeParse({ staffId: 'abc', turnos: '[]' }).success).toBe(false);
  });
});

describe('textoDelDia', () => {
  it('ordena los turnos y quita el cero inicial', () => {
    expect(
      textoDelDia([
        { weekday: 1, desde: '14:00', hasta: '19:00' },
        { weekday: 1, desde: '09:00', hasta: '13:00' },
      ]),
    ).toBe('9:00 – 13:00, 14:00 – 19:00');
  });
});
