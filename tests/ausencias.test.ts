import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Bloqueos y ausencias (D4) contra la base: lo que el dueño puede escribir y
 * lo que la base rechaza aunque se salten el formulario.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-ausencias-12345';

const INICIO = '2030-01-07T14:00:00Z';
const FIN = '2030-01-07T18:00:00Z';

type Dueno = { userId: string; businessId: string; cliente: SupabaseClient; staffId: string };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `ausencias-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Ausencias ${nombre}`,
    p_slug: `ausencias-${nombre}-${marca}`,
    p_category: 'spa',
  });
  if (eBiz) throw new Error(eBiz.message);

  const { data: staff, error: eStaff } = await cliente
    .from('staff')
    .insert({ business_id: businessId, name: `Terapeuta ${nombre}` })
    .select('id')
    .single();
  if (eStaff) throw new Error(eStaff.message);

  return { userId: data.user.id, businessId: businessId as string, cliente, staffId: staff.id };
}

let a: Dueno;
let b: Dueno;

beforeAll(async () => {
  a = await crearDueno('a');
  b = await crearDueno('b');
});

afterAll(async () => {
  for (const d of [a, b]) {
    if (!d) continue;
    await admin.from('businesses').delete().eq('id', d.businessId);
    await admin.auth.admin.deleteUser(d.userId);
  }
});

describe('escritura del dueño', () => {
  it('bloquea a una persona de su equipo y cierra el local', async () => {
    const { error: ePersona } = await a.cliente
      .from('time_off')
      .insert({ business_id: a.businessId, staff_id: a.staffId, starts_at: INICIO, ends_at: FIN, reason: 'Cita médica' });
    expect(ePersona).toBeNull();

    const { error: eLocal } = await a.cliente
      .from('time_off')
      .insert({ business_id: a.businessId, staff_id: null, starts_at: INICIO, ends_at: FIN, reason: 'Festivo' });
    expect(eLocal).toBeNull();
  });

  // Lo que lee la pantalla (lib/panel/bloqueos.ts). Con dos llaves hacia staff
  // la API no sabe cuál usar (PGRST201).
  it('los bloqueos se leen junto con el nombre de la persona', async () => {
    const { data, error } = await a.cliente
      .from('time_off')
      .select('id, staff_id, starts_at, ends_at, reason, staff(name)')
      .eq('business_id', a.businessId);
    expect(error).toBeNull();
    expect(data?.find((t) => t.staff_id)?.staff).toEqual({ name: 'Terapeuta a' });
  });

  it('otro negocio no ve ni puede quitar sus bloqueos', async () => {
    const { data: vistos } = await b.cliente.from('time_off').select('id').eq('business_id', a.businessId);
    expect(vistos ?? []).toHaveLength(0);

    const { data: borrados } = await b.cliente.from('time_off').delete().eq('business_id', a.businessId).select('id');
    expect(borrados ?? []).toHaveLength(0);

    const { count } = await admin.from('time_off').select('id', { count: 'exact', head: true }).eq('business_id', a.businessId);
    expect(count).toBe(2);
  });
});

describe('lo que la base rechaza aunque se salten el formulario', () => {
  it('bloquear en su negocio a la persona de otro negocio', async () => {
    const { error } = await a.cliente
      .from('time_off')
      .insert({ business_id: a.businessId, staff_id: b.staffId, starts_at: INICIO, ends_at: FIN });
    expect(error).not.toBeNull();
  });

  it('un bloqueo que termina antes de empezar', async () => {
    const { error } = await a.cliente
      .from('time_off')
      .insert({ business_id: a.businessId, staff_id: a.staffId, starts_at: FIN, ends_at: INICIO });
    expect(error).not.toBeNull();
  });

  it('un motivo de más de 120 caracteres', async () => {
    const { error } = await a.cliente
      .from('time_off')
      .insert({ business_id: a.businessId, staff_id: a.staffId, starts_at: INICIO, ends_at: FIN, reason: 'x'.repeat(121) });
    expect(error).not.toBeNull();
  });
});
