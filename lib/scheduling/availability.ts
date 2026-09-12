import { duracionMinutos, normalizar, restar, sumarMinutos } from './intervals';
import {
  aInstanteUtc,
  diaDeLaSemana,
  minutosDesdeMedianocheLocal,
  partirFecha,
  partirHora,
} from './timezone';
import type { EntradaDisponibilidad, Intervalo, ReglasDeReserva } from './types';

/**
 * El motor de cupos.
 *
 * LÓGICA PURA: no toca la base de datos, no lee el reloj del sistema, no
 * importa Next.js. Recibe datos y devuelve datos. Ver CLAUDE.md.
 *
 * Un "cupo" es el instante en que EMPIEZA EL SERVICIO — lo que ve y escoge el
 * cliente. El buffer previo queda antes de esa hora y no se le muestra.
 *
 * Ver docs/06-motor-de-agendamiento.md
 */

/** Paso 1: el horario del trabajador para esa fecha, ya en instantes UTC. */
export function jornadaDelDia(
  fecha: string,
  turnos: EntradaDisponibilidad['turnos'],
  timezone: string,
): Intervalo[] {
  const { año, mes, dia } = partirFecha(fecha);
  const weekday = diaDeLaSemana(timezone, fecha);

  const delDia = turnos
    .filter((t) => t.weekday === weekday)
    .map((t) => {
      const desde = partirHora(t.desde);
      const hasta = partirHora(t.hasta);

      return {
        inicio: aInstanteUtc(timezone, año, mes, dia, desde.hora, desde.minuto),
        fin: aInstanteUtc(timezone, año, mes, dia, hasta.hora, hasta.minuto),
      };
    });

  // El turno partido (9–13 y 14–19) son dos intervalos separados; normalizar
  // solo funde los que de verdad se tocan.
  return normalizar(delDia);
}

/** Redondea al siguiente múltiplo de la granularidad contado desde medianoche. */
function alinearAlReloj(instante: Date, reglas: ReglasDeReserva): Date {
  const minutos = minutosDesdeMedianocheLocal(reglas.timezone, instante);
  const resto = minutos % reglas.granularidadMinutos;

  return resto === 0 ? instante : sumarMinutos(instante, reglas.granularidadMinutos - resto);
}

/**
 * Cupos de un solo día para un trabajador y un servicio.
 *
 * Devuelve los instantes de inicio del servicio, en orden.
 */
export function calcularCupos(entrada: EntradaDisponibilidad): Date[] {
  const { fecha, turnos, ocupado, servicio, reglas, ahora } = entrada;

  if (reglas.granularidadMinutos <= 0) {
    throw new Error('La granularidad tiene que ser mayor que cero.');
  }
  if (servicio.duracionMinutos <= 0) {
    throw new Error('La duración del servicio tiene que ser mayor que cero.');
  }

  // Pasos 1 a 3: horario − ocupado = huecos libres.
  const jornada = jornadaDelDia(fecha, turnos, reglas.timezone);
  if (jornada.length === 0) return [];

  const libres = restar(jornada, ocupado);

  // Lo que de verdad ocupa el servicio, buffers incluidos.
  const anchoTotal =
    servicio.bufferAntesMinutos + servicio.duracionMinutos + servicio.bufferDespuesMinutos;

  // Paso 5, preparado: los límites de tiempo.
  const noAntesDe = sumarMinutos(ahora, reglas.anticipacionMinimaMinutos);
  const noDespuesDe = sumarMinutos(ahora, reglas.ventanaMaximaDias * 24 * 60);

  const cupos: Date[] = [];

  // Paso 4: recorrer cada hueco generando candidatos.
  for (const hueco of libres) {
    if (duracionMinutos(hueco) < anchoTotal) continue;

    // El servicio no puede empezar antes de que quepa su buffer previo.
    let inicio = sumarMinutos(hueco.inicio, servicio.bufferAntesMinutos);
    if (reglas.alinearAlReloj) inicio = alinearAlReloj(inicio, reglas);

    while (true) {
      const finConBuffer = sumarMinutos(
        inicio,
        servicio.duracionMinutos + servicio.bufferDespuesMinutos,
      );

      // Ya no cabe completo antes de que se acabe el hueco.
      if (finConBuffer > hueco.fin) break;

      if (inicio >= noAntesDe && inicio <= noDespuesDe) {
        cupos.push(inicio);
      }

      inicio = sumarMinutos(inicio, reglas.granularidadMinutos);
    }
  }

  return cupos.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Cupos de varios días seguidos.
 *
 * Los datos se traen UNA vez y se pasan completos: pedir un mes no puede
 * convertirse en treinta consultas. Ver la sección de rendimiento de
 * docs/06-motor-de-agendamiento.md
 */
export function calcularCuposEnRango(
  entrada: Omit<EntradaDisponibilidad, 'fecha'> & { fechas: string[] },
): { fecha: string; cupos: Date[] }[] {
  const { fechas, ...resto } = entrada;

  return fechas.map((fecha) => ({
    fecha,
    cupos: calcularCupos({ ...resto, fecha }),
  }));
}
