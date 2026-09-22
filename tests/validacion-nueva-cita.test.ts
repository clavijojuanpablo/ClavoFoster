import { describe, expect, it } from 'vitest';

import { esquemaNuevaCita } from '@/lib/validation/nueva-cita';

/** La cita que agenda el negocio desde el panel (G3): lo que se frena antes de tocar la base. */

const valida = {
  serviceId: '8f14e45f-ceea-4e7a-9c1b-2d3f4a5b6c7d',
  staffId: '1c9d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
  fecha: '2030-01-09',
  hora: '15:07',
  telefono: '300 123 4567',
  nombre: 'Camila',
  nota: '',
  origen: 'walk_in',
} as const;

describe('esquemaNuevaCita', () => {
  it('acepta una cita a cualquier minuto y deja la nota vacía en null', () => {
    const r = esquemaNuevaCita.safeParse(valida);
    expect(r.success).toBe(true);
    expect(r.data?.nota).toBeNull();
  });

  it('rechaza días que no existen en el calendario', () => {
    for (const fecha of ['2030-02-30', '2026-13-45', '2030-1-9']) {
      expect(esquemaNuevaCita.safeParse({ ...valida, fecha }).success).toBe(false);
    }
  });

  it('rechaza horas que no son de reloj', () => {
    for (const hora of ['24:00', '9:00', '15:60', '']) {
      expect(esquemaNuevaCita.safeParse({ ...valida, hora }).success).toBe(false);
    }
  });

  it('no acepta un origen que no sea del panel', () => {
    expect(esquemaNuevaCita.safeParse({ ...valida, origen: 'online' }).success).toBe(false);
  });
});
