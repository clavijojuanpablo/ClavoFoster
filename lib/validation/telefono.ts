/**
 * Normalización de números de celular a E.164 (`+573001234567`).
 *
 * El número se guarda siempre normalizado: el mismo cliente escrito como
 * "300 123 4567" y como "+57 300-123-4567" tiene que ser una sola persona, y
 * WhatsApp Cloud API solo acepta formato internacional.
 *
 * Se usa en el registro del negocio (B1) y en la identificación del cliente
 * por OTP (F4).
 */

/** Celular colombiano: 10 dígitos que empiezan por 3. */
const CELULAR_CO = /^3\d{9}$/;

/** E.164: + y entre 8 y 15 dígitos, el primero distinto de cero. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Devuelve el número en E.164, o null si no es un celular válido.
 *
 * Sin indicativo se asume Colombia. Con `+` se acepta cualquier país: hay
 * dueños y clientes con WhatsApp de Venezuela o de España viviendo acá.
 */
export function normalizarCelular(entrada: string): string | null {
  const limpio = entrada.trim().replace(/[\s().-]/g, '');

  if (limpio.startsWith('+')) {
    if (limpio.startsWith('+57')) {
      return CELULAR_CO.test(limpio.slice(3)) ? limpio : null;
    }
    return E164.test(limpio) ? limpio : null;
  }

  if (!/^\d+$/.test(limpio)) return null;

  if (CELULAR_CO.test(limpio)) return `+57${limpio}`;

  // Escrito con el indicativo pero sin el +: 573001234567
  if (limpio.startsWith('57') && CELULAR_CO.test(limpio.slice(2))) return `+${limpio}`;

  return null;
}
