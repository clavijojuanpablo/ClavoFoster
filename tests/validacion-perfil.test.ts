import { describe, expect, it } from 'vitest';

import { esquemaPerfil, esZonaHorariaValida, zonasHorariasDisponibles } from '@/lib/validation/perfil';

const PROPIO = '11111111-1111-4111-8111-111111111111';
const AJENO = '22222222-2222-4222-8222-222222222222';
const FOTO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';

const valido = {
  nombreNegocio: ' Barbería Don Juan ',
  categoria: 'barbershop',
  celular: '300 123 4567',
  direccion: ' Calle 85 #12-34 ',
  ciudad: 'Bogotá',
  latitud: '4.6717',
  longitud: '-74.0536',
  zonaHoraria: 'America/Bogota',
  fotos: JSON.stringify([`${PROPIO}/${FOTO}`]),
};

const esquema = esquemaPerfil(PROPIO);

describe('esquemaPerfil', () => {
  it('normaliza y convierte los tipos', () => {
    expect(esquema.parse(valido)).toEqual({
      nombreNegocio: 'Barbería Don Juan',
      categoria: 'barbershop',
      celular: '+573001234567',
      direccion: 'Calle 85 #12-34',
      ciudad: 'Bogotá',
      latitud: 4.6717,
      longitud: -74.0536,
      zonaHoraria: 'America/Bogota',
      fotos: [`${PROPIO}/${FOTO}`],
    });
  });

  it('se puede guardar sin dirección, ubicación ni fotos', () => {
    const r = esquema.parse({ ...valido, direccion: '', ciudad: '', latitud: '', longitud: '', fotos: '[]' });
    expect(r.direccion).toBeNull();
    expect(r.latitud).toBeNull();
    expect(r.fotos).toEqual([]);
  });

  it('recorta el ruido del GPS a 7 decimales', () => {
    expect(esquema.parse({ ...valido, latitud: '4.671712345678' }).latitud).toBe(4.6717123);
  });

  it('rechaza una coordenada sin la otra', () => {
    expect(esquema.safeParse({ ...valido, longitud: '' }).success).toBe(false);
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(esquema.safeParse({ ...valido, latitud: '91' }).success).toBe(false);
    expect(esquema.safeParse({ ...valido, longitud: 'abc' }).success).toBe(false);
  });

  // El formulario manda la lista de fotos en un input oculto que cualquiera
  // puede editar. Una ruta de otro negocio no se acepta, aunque exista.
  it('rechaza fotos de la carpeta de otro negocio', () => {
    const r = esquema.safeParse({ ...valido, fotos: JSON.stringify([`${AJENO}/${FOTO}`]) });
    expect(r.success).toBe(false);
  });

  it.each([
    ['ruta con ..', `${PROPIO}/../${AJENO}/${FOTO}`],
    ['sin carpeta', FOTO],
    ['nombre que no generó la subida', `${PROPIO}/fachada.png`],
  ])('rechaza foto %s', (_caso, ruta) => {
    expect(esquema.safeParse({ ...valido, fotos: JSON.stringify([ruta]) }).success).toBe(false);
  });

  it('rechaza más de 10 fotos y un JSON roto', () => {
    const muchas = Array.from({ length: 11 }, () => `${PROPIO}/${FOTO}`);
    expect(esquema.safeParse({ ...valido, fotos: JSON.stringify(muchas) }).success).toBe(false);
    expect(esquema.safeParse({ ...valido, fotos: '{no es json' }).success).toBe(false);
  });

  it('rechaza una zona horaria inventada', () => {
    expect(esquema.safeParse({ ...valido, zonaHoraria: 'Bogota' }).success).toBe(false);
  });
});

describe('zonas horarias', () => {
  it('reconoce zonas reales y rechaza las inventadas', () => {
    expect(esZonaHorariaValida('America/Bogota')).toBe(true);
    expect(esZonaHorariaValida('Europe/Madrid')).toBe(true);
    expect(esZonaHorariaValida('GMT-5 Colombia')).toBe(false);
  });

  it('el selector siempre incluye la zona por defecto', () => {
    expect(zonasHorariasDisponibles()).toContain('America/Bogota');
  });
});
