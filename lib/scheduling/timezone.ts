/**
 * Conversión entre hora local del negocio e instantes UTC.
 *
 * Sin dependencias: usa Intl, que trae la base de datos de zonas horarias del
 * propio runtime. Se necesita una sola operación —"las 9:00 del 12 de marzo en
 * Bogotá, ¿qué instante UTC son?"— y para eso no vale la pena arrastrar una
 * librería de fechas.
 *
 * Colombia no tiene horario de verano, así que hoy esto es casi trivial. El
 * algoritmo de dos pasos existe para el día que entre un negocio en Chile o en
 * México, donde sí cambia la hora.
 *
 * Ver la sección "El tiempo" de docs/06-motor-de-agendamiento.md
 */

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(timezone: string): Intl.DateTimeFormat {
  let f = formateadores.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formateadores.set(timezone, f);
  }
  return f;
}

/**
 * Cuánto se adelanta la zona respecto a UTC en ese instante, en milisegundos.
 * Bogotá (UTC-5) devuelve -18_000_000.
 */
export function desfaseMs(timezone: string, instante: Date): number {
  const partes = formateador(timezone).formatToParts(instante);
  const v: Record<string, number> = {};
  for (const p of partes) {
    if (p.type !== 'literal') v[p.type] = Number(p.value);
  }

  // Qué hora marca el reloj de esa zona, interpretada como si fuera UTC.
  const comoSiFueraUtc = Date.UTC(
    v.year,
    v.month - 1,
    v.day,
    // Intl usa 24 para la medianoche en algunos runtimes.
    v.hour === 24 ? 0 : v.hour,
    v.minute,
    v.second,
  );

  return comoSiFueraUtc - instante.getTime();
}

/**
 * Convierte una hora de reloj local a instante UTC.
 *
 * El algoritmo es de dos pasos porque el desfase depende del instante, y el
 * instante es justo lo que se está buscando: se hace una primera aproximación,
 * se mira el desfase real ahí y se corrige.
 *
 * En los saltos de horario de verano una hora local puede no existir o existir
 * dos veces. Acá se devuelve siempre un instante razonable y sin reventar; no
 * se intenta resolver la ambigüedad, porque en la práctica ningún negocio
 * agenda a las 2 de la mañana del día del cambio.
 */
export function aInstanteUtc(
  timezone: string,
  año: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  const aproximado = Date.UTC(año, mes - 1, dia, hora, minuto);
  const desfase1 = desfaseMs(timezone, new Date(aproximado));
  const candidato = aproximado - desfase1;
  const desfase2 = desfaseMs(timezone, new Date(candidato));

  return new Date(aproximado - desfase2);
}

/** Parte 'YYYY-MM-DD' en sus números. Falla fuerte si viene mal. */
export function partirFecha(fecha: string): { año: number; mes: number; dia: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: "${fecha}". Se espera YYYY-MM-DD.`);

  return { año: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** Parte 'HH:MM' (o 'HH:MM:SS') en sus números. */
export function partirHora(hora: string): { hora: number; minuto: number } {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hora);
  if (!m) throw new Error(`Hora inválida: "${hora}". Se espera HH:MM.`);

  return { hora: Number(m[1]), minuto: Number(m[2]) };
}

/**
 * Día de la semana (0 = domingo) de una fecha en la zona del negocio.
 *
 * Se calcula sobre el mediodía local para no caer en un borde de cambio de
 * horario y terminar con el día equivocado.
 */
export function diaDeLaSemana(timezone: string, fecha: string): number {
  const { año, mes, dia } = partirFecha(fecha);
  const mediodia = aInstanteUtc(timezone, año, mes, dia, 12, 0);
  const partes = formateador(timezone).formatToParts(mediodia);
  const v: Record<string, number> = {};
  for (const p of partes) {
    if (p.type !== 'literal') v[p.type] = Number(p.value);
  }

  // Date.UTC con los componentes locales da el día de la semana local.
  return new Date(Date.UTC(v.year, v.month - 1, v.day)).getUTCDay();
}

/** Minutos transcurridos desde la medianoche local, para alinear al reloj. */
export function minutosDesdeMedianocheLocal(timezone: string, instante: Date): number {
  const partes = formateador(timezone).formatToParts(instante);
  const v: Record<string, number> = {};
  for (const p of partes) {
    if (p.type !== 'literal') v[p.type] = Number(p.value);
  }

  return (v.hour === 24 ? 0 : v.hour) * 60 + v.minute;
}

/** Fecha local 'YYYY-MM-DD' de un instante en la zona del negocio. */
export function fechaLocalDe(timezone: string, instante: Date): string {
  const partes = formateador(timezone).formatToParts(instante);
  const v: Record<string, string> = {};
  for (const p of partes) {
    if (p.type !== 'literal') v[p.type] = p.value;
  }

  return `${v.year}-${v.month}-${v.day}`;
}
