import { describe, expect, it } from 'vitest';

import { calcularCupos } from '@/lib/scheduling/availability';
import { aInstanteUtc, partirFecha } from '@/lib/scheduling/timezone';
import type { Intervalo, ReglasDeReserva, TurnoSemanal } from '@/lib/scheduling/types';

/**
 * Los casos obligatorios de docs/06-motor-de-agendamiento.md
 *
 * Dos de los quince (doble reserva simultánea y liberación de una retención
 * vencida) no viven acá: los garantiza la base de datos y se prueban en
 * garantias-del-esquema.test.ts. El motor es lógica pura y no sabe de
 * concurrencia.
 */

const TZ = 'America/Bogota';
const JUEVES = '2026-09-17';
const WEEKDAY_JUEVES = 4;

/** Una hora local de Bogotá como instante UTC. */
function bog(hhmm: string, fecha = JUEVES): Date {
  const { año, mes, dia } = partirFecha(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  return aInstanteUtc(TZ, año, mes, dia, h, m);
}

/** Un instante de vuelta a hora local legible, para comparar en las pruebas. */
function hhmm(instante: Date, timezone = TZ): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante);
}

const REGLAS: ReglasDeReserva = {
  timezone: TZ,
  granularidadMinutos: 15,
  anticipacionMinimaMinutos: 0,
  ventanaMaximaDias: 365,
  alinearAlReloj: false,
};

/** Jornada corrida de 9 a 19 los jueves. */
const CORRIDO: TurnoSemanal[] = [{ weekday: WEEKDAY_JUEVES, desde: '09:00', hasta: '19:00' }];

/** Turno partido: 9–13 y 14–19. */
const PARTIDO: TurnoSemanal[] = [
  { weekday: WEEKDAY_JUEVES, desde: '09:00', hasta: '13:00' },
  { weekday: WEEKDAY_JUEVES, desde: '14:00', hasta: '19:00' },
];

const SIN_BUFFERS = { bufferAntesMinutos: 0, bufferDespuesMinutos: 0 };

/** Un "ahora" muy anterior, para que los filtros de tiempo no estorben. */
const AHORA_LEJANO = bog('00:00', '2026-09-01');

function cupos(opciones: {
  turnos?: TurnoSemanal[];
  ocupado?: Intervalo[];
  duracion: number;
  bufferAntes?: number;
  bufferDespues?: number;
  reglas?: Partial<ReglasDeReserva>;
  ahora?: Date;
  fecha?: string;
}): string[] {
  const reglas = { ...REGLAS, ...opciones.reglas };

  return calcularCupos({
    fecha: opciones.fecha ?? JUEVES,
    turnos: opciones.turnos ?? CORRIDO,
    ocupado: opciones.ocupado ?? [],
    servicio: {
      duracionMinutos: opciones.duracion,
      bufferAntesMinutos: opciones.bufferAntes ?? 0,
      bufferDespuesMinutos: opciones.bufferDespues ?? 0,
    },
    reglas,
    ahora: opciones.ahora ?? AHORA_LEJANO,
  }).map((c) => hhmm(c, reglas.timezone));
}

describe('1 — el caso del requisito', () => {
  // Corte de 60 min a las 12:00 y barba de 30 min a la 1:00.
  // El cliente quiere una barba de 30 min: tiene que salir las 13:30,
  // no las 14:00.
  const ocupado: Intervalo[] = [
    { inicio: bog('12:00'), fin: bog('13:00') },
    { inicio: bog('13:00'), fin: bog('13:30') },
  ];

  it('ofrece las 13:30, no las 14:00', () => {
    const resultado = cupos({ ocupado, duracion: 30, ...SIN_BUFFERS });

    expect(resultado).toContain('13:30');

    const despuesDelBloque = resultado.filter((h) => h >= '13:00');
    expect(despuesDelBloque[0]).toBe('13:30');
  });

  it('no ofrece nada dentro de las citas existentes', () => {
    const resultado = cupos({ ocupado, duracion: 30, ...SIN_BUFFERS });

    expect(resultado).not.toContain('12:00');
    expect(resultado).not.toContain('12:30');
    expect(resultado).not.toContain('13:00');
  });
});

describe('2 — el servicio tiene que caber', () => {
  it('un servicio de 60 min no entra en un hueco de 45', () => {
    // Libre solo 13:15–14:00
    const ocupado: Intervalo[] = [
      { inicio: bog('09:00'), fin: bog('13:15') },
      { inicio: bog('14:00'), fin: bog('19:00') },
    ];

    expect(cupos({ ocupado, duracion: 60 })).toEqual([]);
  });

  it('pero el mismo hueco sí sirve para uno de 30', () => {
    const ocupado: Intervalo[] = [
      { inicio: bog('09:00'), fin: bog('13:15') },
      { inicio: bog('14:00'), fin: bog('19:00') },
    ];

    expect(cupos({ ocupado, duracion: 30 })).toEqual(['13:15', '13:30']);
  });
});

describe('3 — turno partido', () => {
  it('no ofrece cupos durante el almuerzo', () => {
    const resultado = cupos({ turnos: PARTIDO, duracion: 30 });

    expect(resultado).toContain('12:30');
    expect(resultado).not.toContain('13:00');
    expect(resultado).not.toContain('13:30');
    expect(resultado).toContain('14:00');
  });

  it('el último cupo de la mañana termina justo al cerrar', () => {
    const resultado = cupos({ turnos: PARTIDO, duracion: 30 });
    const mañana = resultado.filter((h) => h < '13:00');

    expect(mañana.at(-1)).toBe('12:30');
  });
});

describe('4 — buffers', () => {
  it('el cupo siguiente respeta los buffers de ambos lados', () => {
    // Cita de 10:00 a 11:00 que ya trae 10 min de buffer a cada lado.
    const ocupado: Intervalo[] = [{ inicio: bog('09:50'), fin: bog('11:10') }];

    const resultado = cupos({
      ocupado,
      duracion: 30,
      bufferAntes: 10,
      bufferDespues: 10,
    });

    // 11:10 (fin del bloqueo) + 10 de buffer previo del nuevo servicio.
    const despues = resultado.filter((h) => h > '11:00');
    expect(despues[0]).toBe('11:20');
  });

  it('el buffer previo no deja empezar pegado al inicio de la jornada', () => {
    const resultado = cupos({ duracion: 30, bufferAntes: 15 });

    expect(resultado[0]).toBe('09:15');
  });
});

describe('5 — el cierre', () => {
  it('el último cupo cabe completo antes de cerrar', () => {
    const resultado = cupos({ duracion: 45 });

    // 18:15 + 45 = 19:00 exacto.
    expect(resultado.at(-1)).toBe('18:15');
  });

  it('el buffer posterior también tiene que caber antes del cierre', () => {
    const resultado = cupos({ duracion: 45, bufferDespues: 15 });

    expect(resultado.at(-1)).toBe('18:00');
  });
});

describe('6 y 7 — días sin disponibilidad', () => {
  it('un día sin horario configurado devuelve lista vacía', () => {
    // El jueves no aparece en los turnos.
    const soloLunes: TurnoSemanal[] = [{ weekday: 1, desde: '09:00', hasta: '19:00' }];

    expect(cupos({ turnos: soloLunes, duracion: 30 })).toEqual([]);
  });

  it('un bloqueo de día completo devuelve lista vacía', () => {
    const ocupado: Intervalo[] = [{ inicio: bog('00:00'), fin: bog('23:59') }];

    expect(cupos({ ocupado, duracion: 30 })).toEqual([]);
  });
});

describe('8 — bloqueo parcial', () => {
  it('parte el día en dos y ofrece antes y después', () => {
    const ocupado: Intervalo[] = [{ inicio: bog('12:00'), fin: bog('14:00') }];
    const resultado = cupos({ ocupado, duracion: 30 });

    expect(resultado).toContain('11:30');
    expect(resultado).not.toContain('12:00');
    expect(resultado).not.toContain('13:30');
    expect(resultado).toContain('14:00');
  });
});

describe('9 — anticipación mínima', () => {
  it('con 2 horas de anticipación, consultando a las 10:00, el primero es a las 12:00', () => {
    const resultado = cupos({
      duracion: 30,
      ahora: bog('10:00'),
      reglas: { anticipacionMinimaMinutos: 120 },
    });

    expect(resultado[0]).toBe('12:00');
  });

  it('sin anticipación mínima se puede reservar de una', () => {
    const resultado = cupos({ duracion: 30, ahora: bog('10:00') });

    expect(resultado[0]).toBe('10:00');
  });
});

describe('10 — ventana máxima', () => {
  it('no ofrece nada más allá de la ventana configurada', () => {
    const resultado = cupos({
      duracion: 30,
      ahora: bog('09:00', '2026-09-01'),
      reglas: { ventanaMaximaDias: 5 },
    });

    // El jueves 17 está a 16 días: fuera de la ventana.
    expect(resultado).toEqual([]);
  });
});

describe('11 — zonas horarias', () => {
  it('los cupos corresponden a la hora local del negocio, no a la del servidor', () => {
    const TZ_MX = 'America/Mexico_City';

    const resultado = calcularCupos({
      fecha: JUEVES,
      turnos: CORRIDO,
      ocupado: [],
      servicio: { duracionMinutos: 60, ...SIN_BUFFERS },
      reglas: { ...REGLAS, timezone: TZ_MX },
      ahora: AHORA_LEJANO,
    });

    expect(hhmm(resultado[0], TZ_MX)).toBe('09:00');
    expect(hhmm(resultado.at(-1)!, TZ_MX)).toBe('18:00');

    // Y el mismo instante visto desde Bogotá es una hora distinta:
    // Ciudad de México va una hora atrás.
    expect(hhmm(resultado[0], TZ)).toBe('10:00');
  });

  it('Bogotá está a UTC-5', () => {
    const resultado = calcularCupos({
      fecha: JUEVES,
      turnos: CORRIDO,
      ocupado: [],
      servicio: { duracionMinutos: 60, ...SIN_BUFFERS },
      reglas: REGLAS,
      ahora: AHORA_LEJANO,
    });

    expect(resultado[0].toISOString()).toBe('2026-09-17T14:00:00.000Z');
  });
});

describe('12 — alineación al reloj', () => {
  const ocupado: Intervalo[] = [{ inicio: bog('09:00'), fin: bog('13:20') }];

  it('apagada, aprovecha el hueco desde el minuto exacto', () => {
    const resultado = cupos({ ocupado, duracion: 30 });

    expect(resultado[0]).toBe('13:20');
  });

  it('encendida, redondea al siguiente múltiplo de la granularidad', () => {
    const resultado = cupos({
      ocupado,
      duracion: 30,
      reglas: { alinearAlReloj: true },
    });

    expect(resultado[0]).toBe('13:30');
  });
});

describe('13 — lo que no está ocupado, está libre', () => {
  it('una franja sin cita se ofrece con normalidad', () => {
    // Misma franja que en el caso 1, pero la cita de las 12 ya no está:
    // así queda una cita cancelada, que no se pasa como ocupada.
    const ocupado: Intervalo[] = [{ inicio: bog('13:00'), fin: bog('13:30') }];
    const resultado = cupos({ ocupado, duracion: 30 });

    expect(resultado).toContain('12:00');
    expect(resultado).toContain('12:30');
  });
});

describe('14 — servicios que no caben nunca', () => {
  it('un servicio más largo que la jornada no ofrece nada', () => {
    expect(cupos({ duracion: 11 * 60 })).toEqual([]);
  });
});

describe('bordes y entradas inválidas', () => {
  it('acepta lo ocupado desordenado y solapado', () => {
    const ocupado: Intervalo[] = [
      { inicio: bog('13:00'), fin: bog('13:30') },
      { inicio: bog('12:00'), fin: bog('13:00') },
      { inicio: bog('12:30'), fin: bog('13:15') },
    ];

    const resultado = cupos({ ocupado, duracion: 30 });
    const despues = resultado.filter((h) => h >= '12:00');

    expect(despues[0]).toBe('13:30');
  });

  it('ignora rangos ocupados vacíos', () => {
    const ocupado: Intervalo[] = [{ inicio: bog('12:00'), fin: bog('12:00') }];

    expect(cupos({ ocupado, duracion: 30 })).toContain('12:00');
  });

  it('un bloqueo fuera del horario no cambia nada', () => {
    const ocupado: Intervalo[] = [{ inicio: bog('20:00'), fin: bog('22:00') }];

    expect(cupos({ ocupado, duracion: 45 }).at(-1)).toBe('18:15');
  });

  it('rechaza granularidad cero', () => {
    expect(() => cupos({ duracion: 30, reglas: { granularidadMinutos: 0 } })).toThrow();
  });

  it('rechaza duración cero', () => {
    expect(() => cupos({ duracion: 0 })).toThrow();
  });

  it('rechaza una fecha mal formada', () => {
    expect(() => cupos({ duracion: 30, fecha: '17/09/2026' })).toThrow();
  });
});
