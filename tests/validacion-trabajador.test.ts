import { describe, expect, it } from 'vitest';

import { esquemaTrabajador } from '@/lib/validation/trabajador';

const PROPIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
const ARCHIVO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
const SERVICIO = '33333333-3333-4333-8333-333333333333';

const esquema = esquemaTrabajador(PROPIO);

const valido = {
  id: '',
  nombre: ' Andrés Gómez ',
  celular: '300 123 4567',
  perfil: ' Degradados y barba ',
  foto: `${PROPIO}/equipo/${ARCHIVO}`,
  servicios: [SERVICIO, SERVICIO],
};

function errorDe(campo: string, datos: Record<string, unknown>): string | undefined {
  const r = esquema.safeParse({ ...valido, ...datos });
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === campo)?.message;
}

describe('esquemaTrabajador', () => {
  it('normaliza y convierte los tipos', () => {
    expect(esquema.parse(valido)).toEqual({
      id: null,
      nombre: 'Andrés Gómez',
      celular: '+573001234567',
      perfil: 'Degradados y barba',
      foto: `${PROPIO}/equipo/${ARCHIVO}`,
      // Un servicio repetido en el formulario no crea dos enlaces.
      servicios: [SERVICIO],
    });
  });

  it('celular, perfil y foto son opcionales', () => {
    const r = esquema.parse({ ...valido, celular: '  ', perfil: '', foto: '' });
    expect(r).toMatchObject({ celular: null, perfil: null, foto: null });
  });

  it('puede no prestar ningún servicio', () => {
    expect(esquema.parse({ ...valido, servicios: [] }).servicios).toEqual([]);
  });

  it('exige nombre de 2 a 80 caracteres', () => {
    expect(errorDe('nombre', { nombre: 'A' })).toBe('Escribe el nombre');
    expect(errorDe('nombre', { nombre: 'x'.repeat(81) })).toBeDefined();
  });

  it('rechaza un celular inválido', () => {
    expect(errorDe('celular', { celular: '12345' })).toBeDefined();
  });

  it('limita el perfil a 300 caracteres', () => {
    expect(errorDe('perfil', { perfil: 'x'.repeat(301) })).toBeDefined();
  });

  describe('foto', () => {
    it('rechaza una foto de la carpeta de otro negocio', () => {
      expect(errorDe('foto', { foto: `${AJENO}/equipo/${ARCHIVO}` })).toBeDefined();
    });

    it('rechaza fotos del local o rutas inventadas', () => {
      expect(errorDe('foto', { foto: `${PROPIO}/${ARCHIVO}` })).toBeDefined();
      expect(errorDe('foto', { foto: `${PROPIO}/equipo/../${AJENO}/equipo/${ARCHIVO}` })).toBeDefined();
      expect(errorDe('foto', { foto: 'https://otro-sitio.com/foto.jpg' })).toBeDefined();
    });
  });

  it('rechaza ids que no son uuid', () => {
    expect(errorDe('id', { id: 'abc' })).toBeDefined();
    expect(errorDe('servicios', { servicios: ['abc'] })).toBeDefined();
  });
});
