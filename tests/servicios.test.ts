import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Servicios (C1): lo que el dueño puede escribir, lo que la base rechaza aunque
 * alguien se salte el formulario, y qué ve el público de un servicio
 * desactivado.
 *
 * Todo con la llave publicable y la sesión del dueño: lo mismo que tiene
 * cualquiera que abra la consola del navegador.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-servicios-12345';

type Dueno = { userId: string; businessId: string; cliente: SupabaseClient };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `servicios-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Servicios ${nombre}`,
    p_slug: `servicios-${nombre}-${marca}`,
    p_category: 'salon',
  });
  if (eBiz) throw new Error(eBiz.message);

  return { userId: data.user.id, businessId: businessId as string, cliente };
}

const servicioValido = { name: 'Corte bob', duration_minutes: 45, price_cop: 55000, color: '#1e9e8c' };

let a: Dueno;
let b: Dueno;
let servicioDeB: string;

beforeAll(async () => {
  a = await crearDueno('a');
  b = await crearDueno('b');

  const { data, error } = await b.cliente
    .from('services')
    .insert({ ...servicioValido, business_id: b.businessId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  servicioDeB = data.id;
});

afterAll(async () => {
  for (const d of [a, b]) {
    if (!d) continue;
    await admin.from('businesses').delete().eq('id', d.businessId);
    await admin.auth.admin.deleteUser(d.userId);
  }
});

describe('plantillas sin buffers (C2 fuera del MVP)', () => {
  it('el tiempo de preparación quedó sumado a la duración', async () => {
    const { data } = await a.cliente
      .from('services')
      .select('name, duration_minutes, buffer_before_minutes, buffer_after_minutes')
      .eq('business_id', a.businessId);

    expect(data?.find((s) => s.name === 'Tinte')?.duration_minutes).toBe(135);
    expect(data?.find((s) => s.name === 'Keratina')?.duration_minutes).toBe(195);
    expect(data?.every((s) => s.buffer_before_minutes === 0 && s.buffer_after_minutes === 0)).toBe(true);
  });
});

describe('escritura del dueño', () => {
  it('crea y edita servicios de su negocio', async () => {
    const { data, error } = await a.cliente
      .from('services')
      .insert({ ...servicioValido, business_id: a.businessId })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { error: eEditar } = await a.cliente
      .from('services')
      .update({ price_cop: 60000, description: 'Con lavado' })
      .eq('id', data!.id);
    expect(eEditar).toBeNull();

    const { data: guardado } = await admin.from('services').select('price_cop, description').eq('id', data!.id).single();
    expect(guardado).toEqual({ price_cop: 60000, description: 'Con lavado' });
  });

  it('NO puede crear un servicio en otro negocio', async () => {
    const { error } = await a.cliente.from('services').insert({ ...servicioValido, business_id: b.businessId });
    expect(error).not.toBeNull();
  });

  it('NO puede editar ni desactivar el servicio de otro negocio', async () => {
    const { data } = await a.cliente
      .from('services')
      .update({ price_cop: 1, is_active: false })
      .eq('id', servicioDeB)
      .select('id');
    expect(data ?? []).toHaveLength(0);

    const { data: intacto } = await admin.from('services').select('price_cop, is_active').eq('id', servicioDeB).single();
    expect(intacto).toEqual({ price_cop: 55000, is_active: true });
  });
});

describe('lo que la base rechaza aunque se salten el formulario', () => {
  const casos: [string, Record<string, unknown>][] = [
    ['nombre de una letra', { name: ' x ' }],
    ['nombre de más de 80', { name: 'x'.repeat(81) }],
    ['descripción de más de 300', { description: 'x'.repeat(301) }],
    ['precio de más de cien millones', { price_cop: 100_000_001 }],
    ['precio negativo', { price_cop: -1 }],
    ['color que no es hex', { color: 'rojo' }],
    ['color en mayúsculas', { color: '#6D5CE8' }],
    ['duración de más de 10 horas', { duration_minutes: 601 }],
  ];

  for (const [caso, cambio] of casos) {
    it(caso, async () => {
      const { error } = await a.cliente
        .from('services')
        .insert({ ...servicioValido, ...cambio, business_id: a.businessId });
      expect(error).not.toBeNull();
    });
  }
});

describe('servicio desactivado', () => {
  it('desaparece de la página pública pero el dueño lo sigue viendo', async () => {
    await admin.from('businesses').update({ is_published: true }).eq('id', a.businessId);

    const { data: servicio } = await a.cliente
      .from('services')
      .insert({ ...servicioValido, name: `Desactivable ${marca}`, business_id: a.businessId })
      .select('id')
      .single();

    const visiblePara = async (cliente: SupabaseClient) => {
      const { data } = await cliente.from('services').select('id').eq('id', servicio!.id);
      return (data ?? []).length === 1;
    };

    expect(await visiblePara(anonimo)).toBe(true);

    const { error } = await a.cliente.from('services').update({ is_active: false }).eq('id', servicio!.id);
    expect(error).toBeNull();

    expect(await visiblePara(anonimo)).toBe(false);
    expect(await visiblePara(a.cliente)).toBe(true);
  });
});
