import type { Intervalo } from './types';

/**
 * Aritmética de intervalos de tiempo.
 *
 * Es todo lo que hace falta para calcular disponibilidad: el horario de
 * trabajo menos lo ocupado da los huecos libres. Sin grillas de casillas, que
 * es lo que hace que la mayoría de sistemas pierdan los cupos intermedios.
 *
 * Ver docs/06-motor-de-agendamiento.md
 */

/**
 * Ordena, descarta los vacíos y funde los que se solapan o se tocan.
 *
 * Fundir los que se tocan es correcto en los dos usos: dos turnos pegados
 * (9–13 y 13–19) son una sola jornada, y dos citas pegadas son un solo bloque
 * ocupado.
 */
export function normalizar(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = intervalos
    .filter((i) => i.fin > i.inicio)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const resultado: Intervalo[] = [];

  for (const actual of ordenados) {
    const ultimo = resultado.at(-1);

    if (ultimo && actual.inicio <= ultimo.fin) {
      if (actual.fin > ultimo.fin) ultimo.fin = actual.fin;
    } else {
      resultado.push({ inicio: actual.inicio, fin: actual.fin });
    }
  }

  return resultado;
}

/**
 * `base` menos `aQuitar`.
 *
 * Un intervalo de `aQuitar` que cae en la mitad de uno de `base` lo parte en
 * dos: así un bloqueo a media mañana deja libres el rato de antes y el de
 * después, en vez de perder el día entero.
 */
export function restar(base: Intervalo[], aQuitar: Intervalo[]): Intervalo[] {
  const quitar = normalizar(aQuitar);
  let resultado = normalizar(base);

  for (const q of quitar) {
    const siguiente: Intervalo[] = [];

    for (const b of resultado) {
      // No se tocan: el intervalo sobrevive entero.
      if (q.fin <= b.inicio || q.inicio >= b.fin) {
        siguiente.push(b);
        continue;
      }

      // Lo que queda a la izquierda de lo que se quita.
      if (q.inicio > b.inicio) {
        siguiente.push({ inicio: b.inicio, fin: q.inicio });
      }

      // Lo que queda a la derecha.
      if (q.fin < b.fin) {
        siguiente.push({ inicio: q.fin, fin: b.fin });
      }
    }

    resultado = siguiente;
  }

  return resultado;
}

export function duracionMinutos(intervalo: Intervalo): number {
  return (intervalo.fin.getTime() - intervalo.inicio.getTime()) / 60_000;
}

export function sumarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000);
}
