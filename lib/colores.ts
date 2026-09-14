/**
 * Colores de servicio en la agenda.
 *
 * Validados como paleta categórica: se distinguen entre sí también con
 * daltonismo (ver docs/15-sistema-de-diseno.md). El orden importa: un servicio
 * sin color escogido toma el de su posición, siempre el mismo.
 *
 * Nunca van solos: todo bloque de color lleva el nombre del servicio al lado.
 */
export const COLORES_SERVICIO = [
  { valor: '#6d5ce8', nombre: 'Violeta' },
  { valor: '#e4633f', nombre: 'Coral' },
  { valor: '#1e9e8c', nombre: 'Turquesa' },
  { valor: '#c98a1e', nombre: 'Ámbar' },
  { valor: '#3b86d9', nombre: 'Azul' },
  { valor: '#c9559f', nombre: 'Rosa' },
] as const;

export function colorDeServicio(color: string | null, indice: number): string {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  return COLORES_SERVICIO[((indice % COLORES_SERVICIO.length) + COLORES_SERVICIO.length) % COLORES_SERVICIO.length].valor;
}
