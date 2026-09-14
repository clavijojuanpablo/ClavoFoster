import type { Enums } from '@/lib/types/database';

export type MetodoDePago = Enums<'payment_method'>;

export const NOMBRE_METODO: Record<MetodoDePago, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Datáfono',
  other: 'Otro',
};

const ORDEN_METODOS: MetodoDePago[] = ['cash', 'nequi', 'transfer', 'card', 'other'];

/**
 * Ingresos del día por método de pago.
 *
 * Una cita cumplida que se revierte deja un asiento inverso (egreso que apunta
 * al original por reverses_id): se resta. Los gastos del día no son reversiones
 * y no restan acá: esto es lo que entró, no el balance.
 */
export function resumirCaja(
  movimientos: { direction: Enums<'ledger_direction'>; amount_cop: number; payment_method: MetodoDePago; reverses_id: string | null }[],
): { totalCop: number; porMetodo: { metodo: MetodoDePago; cop: number }[] } {
  const porMetodo = new Map<MetodoDePago, number>();

  for (const m of movimientos) {
    const signo = m.direction === 'income' ? 1 : m.reverses_id ? -1 : 0;
    if (!signo) continue;
    porMetodo.set(m.payment_method, (porMetodo.get(m.payment_method) ?? 0) + signo * m.amount_cop);
  }

  const lista = ORDEN_METODOS.map((metodo) => ({ metodo, cop: porMetodo.get(metodo) ?? 0 })).filter((m) => m.cop > 0);

  return { totalCop: lista.reduce((suma, m) => suma + m.cop, 0), porMetodo: lista };
}
