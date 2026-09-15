import { describe, expect, it } from 'vitest';

import { cuandoEsElBloqueo, fechaCorta } from '@/lib/formato';
import { esquemaBloqueo, rangoDelBloqueo } from '@/lib/validation/bloqueo';

/**
 * Bloqueos (D4): validación, conversión a UTC y cómo se muestran.
 * 2026-09-21 es lunes. Bogotá es UTC-5.
 */

const PERSONA = '11111111-1111-4111-8111-111111111111';
const BOGOTA = 'America/Bogota';

const horas = { tipo: 'horas', quien: PERSONA, fecha: '2026-09-21', desde: '09:00', hasta: '13:00', motivo: ' Cita médica ' };
const dias = { tipo: 'dias', quien: 'local', fechaDesde: '2026-09-21', fechaHasta: '2026-09-25', motivo: '' };

function errores(datos: Record<string, unknown>): Record<string, string> {
  const r = esquemaBloqueo.safeParse(datos);
  if (r.success) return {};
  return Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe('esquemaBloqueo', () => {
  it('unas horas de una persona', () => {
    expect(esquemaBloqueo.parse(horas)).toEqual({ ...horas, motivo: 'Cita médica' });
  });

  it('días completos del local: quien es null y el motivo vacío también', () => {
    expect(esquemaBloqueo.parse(dias)).toMatchObject({ quien: null, motivo: null });
  });

  it('la hora final tiene que ser después de la inicial', () => {
    expect(errores({ ...horas, hasta: '09:00' }).hasta).toBeDefined();
    expect(errores({ ...horas, desde: '14:00', hasta: '13:00' }).hasta).toBeDefined();
  });

  it('un solo día completo es válido (mismo día de inicio y fin)', () => {
    expect(esquemaBloqueo.safeParse({ ...dias, fechaHasta: '2026-09-21' }).success).toBe(true);
  });

  it('el último día no puede ser antes del primero', () => {
    expect(errores({ ...dias, fechaHasta: '2026-09-20' }).fechaHasta).toBeDefined();
  });

  it('limita la duración a 180 días', () => {
    expect(errores({ ...dias, fechaHasta: '2027-03-20' }).fechaHasta).toBe('Un bloqueo puede durar hasta 180 días');
  });

  it('rechaza quién, fechas y horas mal escritas', () => {
    expect(errores({ ...horas, quien: 'otro' }).quien).toBeDefined();
    expect(errores({ ...horas, fecha: '21/09/2026' }).fecha).toBeDefined();
    expect(errores({ ...horas, desde: '9:00' }).desde).toBeDefined();
    expect(esquemaBloqueo.safeParse({ ...horas, tipo: 'semanas' }).success).toBe(false);
  });

  it('limita el motivo a 120 caracteres', () => {
    expect(errores({ ...horas, motivo: 'x'.repeat(121) }).motivo).toBeDefined();
  });
});

describe('rangoDelBloqueo', () => {
  it('unas horas: hora local del negocio a UTC', () => {
    const { inicio, fin } = rangoDelBloqueo(esquemaBloqueo.parse(horas), BOGOTA);
    expect(inicio.toISOString()).toBe('2026-09-21T14:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-09-21T18:00:00.000Z');
  });

  it('días completos: incluye el último día entero', () => {
    const { inicio, fin } = rangoDelBloqueo(esquemaBloqueo.parse(dias), BOGOTA);
    expect(inicio.toISOString()).toBe('2026-09-21T05:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-09-26T05:00:00.000Z');
  });

  // Nueva York adelanta el reloj el 8 de marzo de 2026: ese día dura 23 horas.
  it('un día con cambio de horario dura lo que de verdad dura', () => {
    const { inicio, fin } = rangoDelBloqueo(
      esquemaBloqueo.parse({ ...dias, fechaDesde: '2026-03-08', fechaHasta: '2026-03-08' }),
      'America/New_York',
    );
    expect((fin.getTime() - inicio.getTime()) / 3_600_000).toBe(23);
  });
});

describe('cuandoEsElBloqueo', () => {
  it('un día completo', () => {
    const { inicio, fin } = rangoDelBloqueo(esquemaBloqueo.parse({ ...dias, fechaHasta: '2026-09-21' }), BOGOTA);
    expect(cuandoEsElBloqueo(BOGOTA, inicio, fin)).toBe(`${fechaCorta(BOGOTA, inicio)} · todo el día`);
  });

  it('varios días muestra el último día bloqueado, no el siguiente', () => {
    const { inicio, fin } = rangoDelBloqueo(esquemaBloqueo.parse(dias), BOGOTA);
    const texto = cuandoEsElBloqueo(BOGOTA, inicio, fin);
    expect(texto).toContain('21');
    expect(texto).toContain('25');
    expect(texto).not.toContain('26');
  });

  it('unas horas del mismo día', () => {
    const { inicio, fin } = rangoDelBloqueo(esquemaBloqueo.parse(horas), BOGOTA);
    const texto = cuandoEsElBloqueo(BOGOTA, inicio, fin);
    expect(texto.startsWith(`${fechaCorta(BOGOTA, inicio)} · `)).toBe(true);
    expect(texto).toMatch(/9:00.*1:00/);
  });
});
