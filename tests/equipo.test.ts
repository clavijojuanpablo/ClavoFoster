import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Equipo (D1 y D2): lo que el dueño puede escribir sobre su equipo, lo que la
 * base rechaza aunque se salten el formulario y qué ve el público.
 *
 * Todo con la llave publicable y la sesión del dueño.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-equipo-12345';
const ARCHIVO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';

type Dueno = { userId: string; businessId: string; cliente: SupabaseClient; servicioId: string };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `equipo-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Equipo ${nombre}`,
    p_slug: `equipo-${nombre}-${marca}`,
    p_category: 'barbershop',
  });
  if (eBiz) throw new Error(eBiz.message);

  const { data: servicio } = await cliente.from('services').select('id').eq('business_id', businessId).limit(1).single();

  return { userId: data.user.id, businessId: businessId as string, cliente, servicioId: servicio!.id };
}

async function crearTrabajador(d: Dueno, cambio: Record<string, unknown> = {}) {
  return d.cliente
    .from('staff')
    .insert({ name: 'Andrés Gómez', business_id: d.businessId, ...cambio })
    .select('id')
    .single();
}

let a: Dueno;
let b: Dueno;
let trabajadorDeB: string;

beforeAll(async () => {
  a = await crearDueno('a');
  b = await crearDueno('b');
  const { data, error } = await crearTrabajador(b);
  if (error) throw new Error(error.message);
  trabajadorDeB = data.id;
});

afterAll(async () => {
  for (const d of [a, b]) {
    if (!d) continue;
    await admin.from('businesses').delete().eq('id', d.businessId);
    await admin.auth.admin.deleteUser(d.userId);
  }
});

describe('escritura del dueño', () => {
  it('crea a una persona con foto de su carpeta y le asigna un servicio', async () => {
    const { data, error } = await crearTrabajador(a, {
      phone: '+573001234567',
      bio: 'Degradados',
      photo_url: `${a.businessId}/equipo/${ARCHIVO}`,
    });
    expect(error).toBeNull();

    const { error: eEnlace } = await a.cliente
      .from('staff_services')
      .insert({ staff_id: data!.id, service_id: a.servicioId, business_id: a.businessId });
    expect(eEnlace).toBeNull();
  });

  it('NO puede editar a una persona de otro negocio', async () => {
    const { data } = await a.cliente.from('staff').update({ name: 'Hackeado' }).eq('id', trabajadorDeB).select('id');
    expect(data ?? []).toHaveLength(0);

    const { data: intacto } = await admin.from('staff').select('name').eq('id', trabajadorDeB).single();
    expect(intacto?.name).toBe('Andrés Gómez');
  });
});

describe('servicios de otro negocio (llaves compuestas)', () => {
  it('NO puede asignarle a su trabajador el servicio de otro negocio', async () => {
    const { data: propio } = await crearTrabajador(a, { name: 'Julián Ríos' });
    const { error } = await a.cliente
      .from('staff_services')
      .insert({ staff_id: propio!.id, service_id: b.servicioId, business_id: a.businessId });
    expect(error).not.toBeNull();
  });

  it('NO puede asignar el trabajador de otro negocio a su servicio', async () => {
    const { error } = await a.cliente
      .from('staff_services')
      .insert({ staff_id: trabajadorDeB, service_id: a.servicioId, business_id: a.businessId });
    expect(error).not.toBeNull();
  });
});

describe('lo que la base rechaza aunque se salten el formulario', () => {
  const casos: [string, () => Record<string, unknown>][] = [
    ['nombre de una letra', () => ({ name: 'A' })],
    ['perfil de más de 300', () => ({ bio: 'x'.repeat(301) })],
    ['celular sin formato internacional', () => ({ phone: '3001234567' })],
    ['foto de la carpeta de otro negocio', () => ({ photo_url: `${b.businessId}/equipo/${ARCHIVO}` })],
    ['foto con URL externa', () => ({ photo_url: 'https://otro-sitio.com/foto.jpg' })],
  ];

  for (const [caso, cambio] of casos) {
    it(caso, async () => {
      const { error } = await crearTrabajador(a, cambio());
      expect(error).not.toBeNull();
    });
  }
});

describe('persona desactivada', () => {
  it('desaparece de la página pública pero el dueño la sigue viendo', async () => {
    await admin.from('businesses').update({ is_published: true }).eq('id', a.businessId);
    const { data } = await crearTrabajador(a, { name: `Desactivable ${marca}` });

    const visiblePara = async (cliente: SupabaseClient) => {
      const { data: filas } = await cliente.from('staff').select('id').eq('id', data!.id);
      return (filas ?? []).length === 1;
    };

    expect(await visiblePara(anonimo)).toBe(true);
    await a.cliente.from('staff').update({ is_active: false }).eq('id', data!.id);
    expect(await visiblePara(anonimo)).toBe(false);
    expect(await visiblePara(a.cliente)).toBe(true);
  });
});
