import { aInstanteUtc, minutosDesdeMedianocheLocal, partirFecha, partirHora } from '@/lib/scheduling/timezone';

/**
 * "Hoy" siempre es el hoy del NEGOCIO, no el del servidor (UTC en Vercel) ni el
 * del navegador. A las 8 p. m. en Bogotá ya es mañana en UTC: si el panel usara
 * la fecha del servidor, a esa hora mostraría las citas del día siguiente.
 */

/** Fecha local 'YYYY-MM-DD' en la zona del negocio. */
export function fechaLocal(timezone: string, instante: Date): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/** Instantes UTC de inicio (incluido) y fin (excluido) de un día local del negocio. */
export function rangoDelDia(timezone: string, fecha: string): { desde: Date; hasta: Date } {
  const { año, mes, dia } = partirFecha(fecha);
  // Date.UTC normaliza el día 32 al mes siguiente, así el fin de mes no es caso aparte.
  const siguiente = new Date(Date.UTC(año, mes - 1, dia + 1));

  return {
    desde: aInstanteUtc(timezone, año, mes, dia, 0, 0),
    hasta: aInstanteUtc(
      timezone,
      siguiente.getUTCFullYear(),
      siguiente.getUTCMonth() + 1,
      siguiente.getUTCDate(),
      0,
      0,
    ),
  };
}

/**
 * Suma días a una fecha de calendario 'YYYY-MM-DD'.
 *
 * Aritmética en UTC puro y a propósito: una fecha así es una etiqueta de
 * calendario, no un instante, y acá no hay zona horaria que valga. Un día con
 * cambio de horario sigue siendo un día en el calendario. `Date.UTC` normaliza
 * el fin de mes y el año bisiesto solo.
 */
export function sumarDias(fecha: string, dias: number): string {
  const { año, mes, dia } = partirFecha(fecha);

  return new Date(Date.UTC(año, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Las fechas de `desde` a `hasta`, ambas incluidas. Vacío si `hasta` es anterior. */
export function fechasEntre(desde: string, hasta: string): string[] {
  const fechas: string[] = [];

  for (let cursor = desde; cursor <= hasta; cursor = sumarDias(cursor, 1)) {
    fechas.push(cursor);
  }

  return fechas;
}

/** Hora del día en la zona del negocio, para escoger el saludo. */
export function horaLocal(timezone: string, instante: Date): number {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }).format(instante),
  );
  return hora === 24 ? 0 : hora;
}

export function saludo(timezone: string, instante: Date): string {
  const hora = horaLocal(timezone, instante);
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** El instante UTC de una fecha y una hora de reloj ('HH:MM') escritas en la zona del negocio. */
export function instanteLocal(timezone: string, fecha: string, horaDelReloj: string): Date {
  const { año, mes, dia } = partirFecha(fecha);
  const { hora, minuto } = partirHora(horaDelReloj);

  return aInstanteUtc(timezone, año, mes, dia, hora, minuto);
}

/** La hora de reloj 'HH:MM' de un instante en la zona del negocio. Lo que espera un `<input type="time">`. */
export function relojLocal(timezone: string, instante: Date): string {
  const minutos = minutosDesdeMedianocheLocal(timezone, instante);

  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}
