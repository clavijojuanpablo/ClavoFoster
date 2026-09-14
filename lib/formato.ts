const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** $30.000 — el peso colombiano no usa centavos en la práctica. */
export function pesos(cop: number): string {
  // Intl mete un espacio duro entre el signo y el número ("$ 30.000"); en
  // pantalla se lee mejor pegado.
  return PESOS.format(cop).replace(/\s/g, '');
}

/** 45 → "45 min", 60 → "1 h", 90 → "1 h 30". */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto}` : `${horas} h`;
}

/** "Barbería El Demo" → "BE". Para avatares sin foto. */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return '·';
  const primeras = palabras.length === 1 ? [palabras[0].slice(0, 2)] : [palabras[0][0], palabras[1][0]];
  return primeras.join('').toUpperCase();
}

/** Hora local del negocio: "9:30 a. m." */
export function hora(timezone: string, instante: Date | string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instante));
}

/** "viernes 12 de septiembre" */
export function fechaLarga(timezone: string, instante: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(instante);
}
