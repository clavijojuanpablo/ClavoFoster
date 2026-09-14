import { aInstanteUtc, partirFecha } from '@/lib/scheduling/timezone';

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
