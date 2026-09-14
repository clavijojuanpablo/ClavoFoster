import { describe, expect, it } from 'vitest';

import { resumirCaja } from '@/lib/panel/caja';

type Movimiento = Parameters<typeof resumirCaja>[0][number];

const ingreso = (cop: number, metodo: Movimiento['payment_method'] = 'cash'): Movimiento => ({
  direction: 'income',
  amount_cop: cop,
  payment_method: metodo,
  reverses_id: null,
});

describe('resumirCaja', () => {
  it('suma los ingresos por método, en orden fijo y sin métodos vacíos', () => {
    const r = resumirCaja([ingreso(30000, 'nequi'), ingreso(45000), ingreso(20000)]);
    expect(r.totalCop).toBe(95000);
    expect(r.porMetodo).toEqual([
      { metodo: 'cash', cop: 65000 },
      { metodo: 'nequi', cop: 30000 },
    ]);
  });

  // Corregir es sumar, no borrar: una cita cumplida por error se revierte con
  // un asiento inverso, y lo que entró ese día tiene que bajar.
  it('resta el contra-asiento de una cita revertida', () => {
    const r = resumirCaja([
      ingreso(45000),
      { direction: 'expense', amount_cop: 45000, payment_method: 'cash', reverses_id: 'original' },
      ingreso(20000, 'transfer'),
    ]);
    expect(r.totalCop).toBe(20000);
    expect(r.porMetodo).toEqual([{ metodo: 'transfer', cop: 20000 }]);
  });

  it('un gasto del día no resta de lo que entró', () => {
    const r = resumirCaja([
      ingreso(30000),
      { direction: 'expense', amount_cop: 12000, payment_method: 'cash', reverses_id: null },
    ]);
    expect(r.totalCop).toBe(30000);
  });

  it('sin movimientos queda en cero', () => {
    expect(resumirCaja([])).toEqual({ totalCop: 0, porMetodo: [] });
  });
});
