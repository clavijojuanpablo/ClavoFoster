import { describe, expect, it } from 'vitest';

import { esquemaServicio, formatearPrecio, leerPrecio } from '@/lib/validation/servicio';

const ID = '11111111-1111-4111-8111-111111111111';

const valido = {
  id: '',
  nombre: ' Corte de cabello ',
  descripcion: ' Lavado, corte y peinado ',
  duracion: '45',
  precio: '30.000',
  color: '#6d5ce8',
};

function errorDe(campo: string, datos: Record<string, string>): string | undefined {
  const r = esquemaServicio.safeParse({ ...valido, ...datos });
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === campo)?.message;
}

describe('esquemaServicio', () => {
  it('normaliza y convierte los tipos', () => {
    expect(esquemaServicio.parse(valido)).toEqual({
      id: null,
      nombre: 'Corte de cabello',
      descripcion: 'Lavado, corte y peinado',
      duracion: 45,
      precio: 30000,
      color: '#6d5ce8',
    });
  });

  it('al editar conserva el id', () => {
    expect(esquemaServicio.parse({ ...valido, id: ID }).id).toBe(ID);
  });

  it('rechaza un id que no es uuid', () => {
    expect(errorDe('id', { id: '1; drop table services' })).toBeDefined();
  });

  it('una descripción vacía se guarda como null', () => {
    expect(esquemaServicio.parse({ ...valido, descripcion: '   ' }).descripcion).toBeNull();
  });

  it('exige nombre de 2 a 80 caracteres', () => {
    expect(errorDe('nombre', { nombre: ' a ' })).toBe('Escribe el nombre del servicio');
    expect(errorDe('nombre', { nombre: 'x'.repeat(81) })).toBeDefined();
    expect(errorDe('nombre', { nombre: 'x'.repeat(80) })).toBeUndefined();
  });

  it('limita la descripción a 300 caracteres', () => {
    expect(errorDe('descripcion', { descripcion: 'x'.repeat(301) })).toBeDefined();
  });

  describe('duración', () => {
    it('acepta de 5 a 600 minutos', () => {
      expect(errorDe('duracion', { duracion: '5' })).toBeUndefined();
      expect(errorDe('duracion', { duracion: '600' })).toBeUndefined();
      expect(errorDe('duracion', { duracion: '135' })).toBeUndefined();
    });

    it('rechaza fuera de rango, decimales y vacío', () => {
      for (const duracion of ['4', '601', '0', '-30', '45.5', '', 'una hora']) {
        expect(errorDe('duracion', { duracion }), duracion).toBeDefined();
      }
    });
  });

  describe('precio', () => {
    it('acepta 0: hay servicios que no se cobran', () => {
      expect(esquemaServicio.parse({ ...valido, precio: '0' }).precio).toBe(0);
    });

    it('vacío pide escribirlo, no lo toma como 0', () => {
      expect(errorDe('precio', { precio: '' })).toBe('Escribe el precio. Si no cobras, escribe 0');
    });

    it('rechaza más de cien millones', () => {
      expect(errorDe('precio', { precio: '100.000.000' })).toBeUndefined();
      expect(errorDe('precio', { precio: '100.000.001' })).toBeDefined();
    });
  });

  it('solo acepta colores de la paleta', () => {
    expect(errorDe('color', { color: '#000000' })).toBe('Escoge un color');
    expect(errorDe('color', { color: '' })).toBe('Escoge un color');
  });
});

describe('leerPrecio', () => {
  it('lee lo que escribe un dueño', () => {
    expect(leerPrecio('30.000')).toBe(30000);
    expect(leerPrecio('$ 30.000')).toBe(30000);
    expect(leerPrecio('30000')).toBe(30000);
    expect(leerPrecio('1.500.000')).toBe(1500000);
    expect(leerPrecio(' 45 000 ')).toBe(45000);
  });

  // Quitarle la coma a "30.000,50" daría tres millones.
  it('no convierte centavos en miles', () => {
    expect(leerPrecio('30.000,50')).toBe('invalido');
    expect(leerPrecio('30000.5')).toBe('invalido');
  });

  it('rechaza negativos y texto', () => {
    expect(leerPrecio('-5000')).toBe('invalido');
    expect(leerPrecio('treinta mil')).toBe('invalido');
    expect(leerPrecio('$')).toBe('invalido');
  });

  it('vacío es null', () => {
    expect(leerPrecio('  ')).toBeNull();
  });
});

describe('formatearPrecio', () => {
  it('separa los miles con punto', () => {
    expect(formatearPrecio(30000)).toBe('30.000');
    expect(formatearPrecio(1500000)).toBe('1.500.000');
    expect(formatearPrecio(0)).toBe('0');
  });
});
