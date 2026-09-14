import { describe, expect, it } from 'vitest';

import {
  alternativasDeSlug,
  esquemaAltaNegocio,
  esquemaRegistro,
  esquemaSlug,
  SLUGS_RESERVADOS,
  sugerirSlug,
} from '@/lib/validation/negocio';
import { normalizarCelular } from '@/lib/validation/telefono';

describe('normalizarCelular', () => {
  it.each([
    ['3001234567', '+573001234567'],
    ['300 123 4567', '+573001234567'],
    ['300-123-4567', '+573001234567'],
    ['(300) 123 4567', '+573001234567'],
    ['+57 300 123 4567', '+573001234567'],
    ['573001234567', '+573001234567'],
    ['+58 412 1234567', '+584121234567'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarCelular(entrada)).toBe(esperado);
  });

  it.each([
    ['fijo de Bogotá sin indicativo', '6011234567'],
    ['incompleto', '300123456'],
    ['sobra un dígito', '30012345678'],
    ['+57 que no es celular', '+576011234567'],
    ['letras', '300abc4567'],
    ['vacío', ''],
    ['+ con muy pocos dígitos', '+1234'],
  ])('rechaza %s', (_caso, entrada) => {
    expect(normalizarCelular(entrada)).toBeNull();
  });
});

describe('sugerirSlug', () => {
  it.each([
    ['Barbería Don Juan', 'barberia-don-juan'],
    ['Peluquería Ñoña & Co.', 'peluqueria-nona-co'],
    ['  --Spa   Zen--  ', 'spa-zen'],
    ['Studio 54', 'studio-54'],
  ])('%s → %s', (nombre, esperado) => {
    expect(sugerirSlug(nombre)).toBe(esperado);
  });

  it('nunca pasa del máximo ni termina en guion al recortar', () => {
    const slug = sugerirSlug('Barbería '.repeat(10));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
    expect(esquemaSlug.safeParse(slug).success).toBe(true);
  });
});

describe('alternativasDeSlug', () => {
  it('numera desde 2', () => {
    expect(alternativasDeSlug('barberia-juan', 3)).toEqual([
      'barberia-juan-2',
      'barberia-juan-3',
      'barberia-juan-4',
    ]);
  });

  it('recorta la base para no pasar del máximo y sigue siendo un slug válido', () => {
    const largo = `${'a'.repeat(48)}-b`; // 50, justo en el máximo
    for (const alternativa of alternativasDeSlug(largo)) {
      expect(alternativa.length).toBeLessThanOrEqual(50);
      expect(esquemaSlug.safeParse(alternativa).success).toBe(true);
    }
  });
});

describe('esquemaSlug', () => {
  it('normaliza a minúsculas', () => {
    expect(esquemaSlug.parse('  Barberia-Juan ')).toBe('barberia-juan');
  });

  it.each(['-barberia', 'barberia-', 'barbería', 'barberia juan', 'a', 'x'.repeat(51)])(
    'rechaza "%s"',
    (slug) => {
      expect(esquemaSlug.safeParse(slug).success).toBe(false);
    },
  );

  it('rechaza las rutas de la aplicación', () => {
    for (const reservado of ['registro', 'bienvenida', 'login', 'panel', 'auth', 'bookia']) {
      expect(SLUGS_RESERVADOS.has(reservado)).toBe(true);
      expect(esquemaSlug.safeParse(reservado).success).toBe(false);
    }
  });
});

describe('esquemaRegistro', () => {
  const valido = {
    email: ' Dueno@Barberia.CO ',
    password: 'clave-segura',
    nombreNegocio: ' Barbería Don Juan ',
    celular: '300 123 4567',
  };

  it('normaliza correo, nombre y celular', () => {
    expect(esquemaRegistro.parse(valido)).toEqual({
      email: 'dueno@barberia.co',
      password: 'clave-segura',
      nombreNegocio: 'Barbería Don Juan',
      celular: '+573001234567',
    });
  });

  it('exige contraseña de al menos 8 caracteres', () => {
    const r = esquemaRegistro.safeParse({ ...valido, password: '1234567' });
    expect(r.success).toBe(false);
  });

  it('marca el celular inválido en su campo', () => {
    const r = esquemaRegistro.safeParse({ ...valido, celular: '123' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['celular']);
  });
});

describe('esquemaAltaNegocio', () => {
  it('rechaza una categoría que no tiene plantillas', () => {
    const r = esquemaAltaNegocio.safeParse({
      nombreNegocio: 'Negocio',
      celular: '3001234567',
      categoria: 'veterinaria',
      slug: 'negocio',
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['categoria']);
  });
});
