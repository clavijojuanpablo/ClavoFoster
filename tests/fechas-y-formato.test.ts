import { describe, expect, it } from 'vitest';

import { colorDeServicio } from '@/lib/colores';
import { fechaLocal, fechasEntre, rangoDelDia, saludo, sumarDias } from '@/lib/fechas';
import { cuandoEsElBloqueo, duracion, fechaCorta, fechaLarga, hora, iniciales, pesos } from '@/lib/formato';

describe('fechaLocal', () => {
  // 2026-09-13 01:30 UTC = 12 de septiembre, 8:30 p. m. en Bogotá.
  const nocheEnBogota = new Date('2026-09-13T01:30:00Z');

  it('usa el día del negocio, no el de UTC', () => {
    expect(fechaLocal('America/Bogota', nocheEnBogota)).toBe('2026-09-12');
    expect(fechaLocal('UTC', nocheEnBogota)).toBe('2026-09-13');
  });
});

describe('rangoDelDia', () => {
  it('cubre de medianoche a medianoche local, en UTC', () => {
    const { desde, hasta } = rangoDelDia('America/Bogota', '2026-09-12');
    expect(desde.toISOString()).toBe('2026-09-12T05:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-09-13T05:00:00.000Z');
  });

  it('cruza el fin de mes y de año', () => {
    expect(rangoDelDia('America/Bogota', '2026-12-31').hasta.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });

  it('un día con cambio de horario no dura 24 horas', () => {
    const horas = (tz: string, fecha: string) => {
      const { desde, hasta } = rangoDelDia(tz, fecha);
      return (hasta.getTime() - desde.getTime()) / 3_600_000;
    };
    // Nueva York adelanta el reloj el 8 de marzo de 2026 y lo atrasa el 1 de noviembre.
    expect(horas('America/New_York', '2026-03-08')).toBe(23);
    expect(horas('America/New_York', '2026-11-01')).toBe(25);
  });
});

describe('saludo', () => {
  it('depende de la hora del negocio', () => {
    expect(saludo('America/Bogota', new Date('2026-09-12T13:00:00Z'))).toBe('Buenos días'); // 8 a. m.
    expect(saludo('America/Bogota', new Date('2026-09-12T20:00:00Z'))).toBe('Buenas tardes'); // 3 p. m.
    expect(saludo('America/Bogota', new Date('2026-09-13T01:30:00Z'))).toBe('Buenas noches'); // 8:30 p. m.
  });
});

describe('formato', () => {
  it('pesos sin centavos y sin espacio', () => {
    expect(pesos(30000)).toBe('$30.000');
    expect(pesos(1250000)).toBe('$1.250.000');
    expect(pesos(0)).toBe('$0');
  });

  it('duración legible', () => {
    expect(duracion(15)).toBe('15 min');
    expect(duracion(60)).toBe('1 h');
    expect(duracion(90)).toBe('1 h 30');
    expect(duracion(135)).toBe('2 h 15');
  });

  it('iniciales', () => {
    expect(iniciales('Barbería El Demo')).toBe('BE');
    expect(iniciales('Camila')).toBe('CA');
    expect(iniciales('  ')).toBe('·');
  });

  it('un servicio sin color toma uno fijo por posición', () => {
    expect(colorDeServicio(null, 0)).toBe('#6d5ce8');
    expect(colorDeServicio(null, 7)).toBe(colorDeServicio(null, 1));
    expect(colorDeServicio('#ABCDEF', 3)).toBe('#abcdef');
    expect(colorDeServicio('rojo', 2)).toBe('#1e9e8c');
  });
});

describe('sumarDias y fechasEntre', () => {
  it('cruza el fin de mes, el año y el 29 de febrero', () => {
    expect(sumarDias('2026-09-12', 3)).toBe('2026-09-15');
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  // Son etiquetas de calendario, no instantes: un día con cambio de horario
  // sigue siendo un día.
  it('un día es un día aunque la zona cambie de horario', () => {
    expect(sumarDias('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('incluye los dos extremos', () => {
    expect(fechasEntre('2026-09-12', '2026-09-14')).toEqual(['2026-09-12', '2026-09-13', '2026-09-14']);
    expect(fechasEntre('2026-09-12', '2026-09-12')).toEqual(['2026-09-12']);
  });

  it('un rango al revés no devuelve nada', () => {
    expect(fechasEntre('2026-09-14', '2026-09-12')).toEqual([]);
  });
});

describe('espacios de Intl', () => {
  // Node y el navegador meten espacios distintos (U+202F contra U+00A0) antes
  // de "a. m." según su versión de ICU. Se ven iguales, pero para React son
  // textos distintos: rompen la hidratación y le tumban los eventos al árbol
  // entero. Le pasó al calendario (G1).
  const RAROS = /[  ]/;

  it('ninguna función de formato deja espacios no separables', () => {
    const tz = 'America/Bogota';
    const instante = new Date('2026-09-16T15:30:00Z');

    expect(hora(tz, instante)).not.toMatch(RAROS);
    expect(fechaLarga(tz, instante)).not.toMatch(RAROS);
    expect(fechaCorta(tz, instante)).not.toMatch(RAROS);
    expect(cuandoEsElBloqueo(tz, instante, new Date('2026-09-16T18:00:00Z'))).not.toMatch(RAROS);
    expect(pesos(30_000)).not.toMatch(RAROS);
  });

  it('la hora se sigue leyendo como debe', () => {
    expect(hora('America/Bogota', new Date('2026-09-16T15:30:00Z'))).toBe('10:30 a. m.');
  });
});
