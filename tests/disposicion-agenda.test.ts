import { describe, expect, it } from 'vitest';

import {
  colocarEnCarriles,
  horasDeLaRegla,
  recortarAlDia,
  ventanaDelDia,
} from '@/lib/agenda/disposicion';

/**
 * Disposición del calendario (G1): lógica pura, sin base ni pantalla.
 *
 * Los minutos son locales desde la medianoche del negocio: 9:00 son 540.
 */

const h = (hora: number, minuto = 0) => hora * 60 + minuto;
const bloque = (desde: number, hasta: number, id = '') => ({
  desdeMinuto: desde,
  hastaMinuto: hasta,
  id,
});

describe('colocarEnCarriles', () => {
  it('lo normal: citas seguidas, todas a ancho completo', () => {
    const r = colocarEnCarriles([bloque(h(9), h(10)), bloque(h(10), h(11)), bloque(h(11), h(12))]);

    expect(r.map((c) => c.carril)).toEqual([0, 0, 0]);
    expect(r.map((c) => c.carriles)).toEqual([1, 1, 1]);
  });

  it('dos encimadas se reparten el ancho', () => {
    const r = colocarEnCarriles([bloque(h(9), h(10)), bloque(h(9, 30), h(10, 30))]);

    expect(r.map((c) => c.carril)).toEqual([0, 1]);
    expect(r.map((c) => c.carriles)).toEqual([2, 2]);
  });

  it('una que termina justo cuando empieza la otra no se cruza', () => {
    const r = colocarEnCarriles([bloque(h(9), h(10)), bloque(h(10), h(11))]);

    expect(r.every((c) => c.carriles === 1)).toBe(true);
  });

  it('el ancho se reparte por grupo encadenado, no por pareja', () => {
    // A se cruza con B, B con C, pero A y C no se tocan. Los tres a un tercio:
    // si no, las columnas quedarían escalonadas y la pantalla se leería mal.
    const r = colocarEnCarriles([
      bloque(h(9), h(10), 'a'),
      bloque(h(9, 45), h(10, 45), 'b'),
      bloque(h(10, 30), h(11, 30), 'c'),
    ]);

    expect(r.map((c) => c.bloque.id)).toEqual(['a', 'b', 'c']);
    expect(r.map((c) => c.carril)).toEqual([0, 1, 0]);
    expect(r.every((c) => c.carriles === 2)).toBe(true);
  });

  it('reusa el carril que ya se desocupó', () => {
    const r = colocarEnCarriles([
      bloque(h(9), h(11), 'larga'),
      bloque(h(9), h(10), 'corta'),
      bloque(h(10), h(10, 30), 'despues'),
    ]);

    const carril = (id: string) => r.find((c) => c.bloque.id === id)!.carril;

    // 'despues' cabe donde estaba 'corta' en vez de abrir un tercer carril,
    // que dejaría la columna con un hueco vacío al lado.
    expect(carril('despues')).toBe(carril('corta'));
    expect(carril('larga')).not.toBe(carril('corta'));
    expect(r.every((c) => c.carriles === 2)).toBe(true);
  });

  it('tres a la misma hora quedan en tres carriles', () => {
    const r = colocarEnCarriles([bloque(h(9), h(10)), bloque(h(9), h(10)), bloque(h(9), h(10))]);

    expect(r.map((c) => c.carril).sort()).toEqual([0, 1, 2]);
    expect(r.every((c) => c.carriles === 3)).toBe(true);
  });

  it('no revienta con una lista vacía y no altera la que recibe', () => {
    const original = [bloque(h(10), h(11)), bloque(h(9), h(10))];
    const copia = [...original];

    expect(colocarEnCarriles([])).toEqual([]);
    colocarEnCarriles(original);
    expect(original).toEqual(copia);
  });
});

describe('ventanaDelDia', () => {
  it('un día sin nada igual se dibuja, con la franja mínima', () => {
    expect(ventanaDelDia([])).toEqual({ desdeMinuto: h(8), hastaMinuto: h(20) });
  });

  it('se estira para que quepa lo que se sale de la franja', () => {
    expect(ventanaDelDia([bloque(h(6, 30), h(22, 15))])).toEqual({
      desdeMinuto: h(6),
      hastaMinuto: h(23),
    });
  });

  it('no se encoge por dentro de la franja mínima', () => {
    expect(ventanaDelDia([bloque(h(10), h(12))])).toEqual({ desdeMinuto: h(8), hastaMinuto: h(20) });
  });

  it('una cita que termina a las 19:05 estira el día hasta las 20:00', () => {
    expect(ventanaDelDia([bloque(h(18), h(19, 5))], { minimoHasta: h(19) }).hastaMinuto).toBe(h(20));
  });

  it('no se pasa de la medianoche', () => {
    expect(ventanaDelDia([bloque(h(22), 24 * 60)]).hastaMinuto).toBe(24 * 60);
  });
});

describe('horasDeLaRegla', () => {
  it('marca cada hora en punto, incluidos los dos extremos', () => {
    expect(horasDeLaRegla(h(9), h(12))).toEqual([h(9), h(10), h(11), h(12)]);
  });

  it('arranca en la siguiente hora en punto si la ventana no empieza redonda', () => {
    expect(horasDeLaRegla(h(9, 30), h(11))).toEqual([h(10), h(11)]);
  });
});

describe('recortarAlDia', () => {
  // Bogotá es UTC-5: el 16 de septiembre va de 05:00Z a 05:00Z del 17.
  const dia = { desde: new Date('2026-09-16T05:00:00Z'), hasta: new Date('2026-09-17T05:00:00Z') };

  it('una cita del día se vuelve minutos locales', () => {
    const r = recortarAlDia(
      { inicio: new Date('2026-09-16T14:00:00Z'), fin: new Date('2026-09-16T15:00:00Z') },
      dia,
    );

    expect(r).toEqual({ desdeMinuto: h(9), hastaMinuto: h(10) });
  });

  it('un bloqueo que viene de ayer arranca en el minuto cero, no en negativo', () => {
    const r = recortarAlDia(
      { inicio: new Date('2026-09-15T20:00:00Z'), fin: new Date('2026-09-16T14:00:00Z') },
      dia,
    );

    expect(r).toEqual({ desdeMinuto: 0, hastaMinuto: h(9) });
  });

  it('un cierre de varios días llena el día entero', () => {
    const r = recortarAlDia(
      { inicio: new Date('2026-09-10T00:00:00Z'), fin: new Date('2026-09-30T00:00:00Z') },
      dia,
    );

    expect(r).toEqual({ desdeMinuto: 0, hastaMinuto: 24 * 60 });
  });

  it('lo que no toca el día no se dibuja', () => {
    expect(
      recortarAlDia(
        { inicio: new Date('2026-09-20T14:00:00Z'), fin: new Date('2026-09-20T15:00:00Z') },
        dia,
      ),
    ).toBeNull();

    // Y lo que termina justo cuando empieza el día tampoco.
    expect(
      recortarAlDia(
        { inicio: new Date('2026-09-16T04:00:00Z'), fin: new Date('2026-09-16T05:00:00Z') },
        dia,
      ),
    ).toBeNull();
  });
});
