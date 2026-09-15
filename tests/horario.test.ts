import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Horario semanal (D3) contra la base: guardar_horario() reemplaza todo o nada,
 * y la base no deja turnos cruzados ni horarios en el trabajador de otro
 * negocio.
 *
 * Todo con la llave publicable y la sesión del dueño.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-horario-12345';

type Dueno = { userId: string; businessId: string; cliente: SupabaseClient; staffId: string };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `horario-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Horario ${nombre}`,
    p_slug: `horario-${nombre}-${marca}`,
    p_category: 'salon',
  });
  if (eBiz) throw new Error(eBiz.message);

  const { data: staff, error: eStaff } = await cliente
    .from('staff')
    .insert({ business_id: businessId, name: `Estilista ${nombre}` })
    .select('id')
    .single();
  if (eStaff) throw new Error(eStaff.message);

  return { userId: data.user.id, businessId: businessId as string, cliente, staffId: staff.id };
}

async function horarioDe(staffId: string) {
  const { data } = await admin
    .from('working_hours')
    .select('weekday, starts_at, ends_at')
    .eq('staff_id', staffId)
    .order('weekday')
    .order('starts_at');
  return (data ?? []).map((h) => `${h.weekday} ${h.starts_at.slice(0, 5)}-${h.ends_at.slice(0, 5)}`);
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

describe('guardar_horario', () => {
  it('guarda turno partido y después lo reemplaza entero', async () => {
    const { error } = await a.cliente.rpc('guardar_horario', {
      p_staff_id: a.staffId,
      p_turnos: [
        { weekday: 1, desde: '09:00', hasta: '13:00' },
        { weekday: 1, desde: '14:00', hasta: '19:00' },
        { weekday: 2, desde: '09:00', hasta: '19:00' },
      ],
    });
    expect(error).toBeNull();
    expect(await horarioDe(a.staffId)).toEqual(['1 09:00-13:00', '1 14:00-19:00', '2 09:00-19:00']);

    const { error: e2 } = await a.cliente.rpc('guardar_horario', {
      p_staff_id: a.staffId,
      p_turnos: [{ weekday: 6, desde: '08:00', hasta: '12:00' }],
    });
    expect(e2).toBeNull();
    expect(await horarioDe(a.staffId)).toEqual(['6 08:00-12:00']);
  });

  it('con turnos cruzados falla y deja el horario anterior intacto', async () => {
    const { error } = await a.cliente.rpc('guardar_horario', {
      p_staff_id: a.staffId,
      p_turnos: [
        { weekday: 3, desde: '09:00', hasta: '13:00' },
        { weekday: 3, desde: '12:00', hasta: '18:00' },
      ],
    });
    expect(error?.hint).toBe('turnos_solapados');
    expect(await horarioDe(a.staffId)).toEqual(['6 08:00-12:00']);
  });

  it('un turno que termina antes de empezar falla con su propio aviso', async () => {
    const { error } = await a.cliente.rpc('guardar_horario', {
      p_staff_id: a.staffId,
      p_turnos: [{ weekday: 4, desde: '18:00', hasta: '09:00' }],
    });
    expect(error?.hint).toBe('turno_invalido');
  });

  it('NO puede guardar el horario del trabajador de otro negocio', async () => {
    const { error } = await a.cliente.rpc('guardar_horario', {
      p_staff_id: b.staffId,
      p_turnos: [{ weekday: 1, desde: '09:00', hasta: '10:00' }],
    });
    expect(error?.hint).toBe('sin_permiso');
    expect(await horarioDe(b.staffId)).toEqual([]);
  });

  it('sin sesión no se puede llamar', async () => {
    const { error } = await anonimo.rpc('guardar_horario', { p_staff_id: a.staffId, p_turnos: [] });
    expect(error).not.toBeNull();
    expect(await horarioDe(a.staffId)).toEqual(['6 08:00-12:00']);
  });
});

// Lo que lee la pantalla Equipo (lib/panel/equipo.ts): con dos llaves hacia
// staff la API no sabe cuál usar (PGRST201). Ver 20260914190002.
it('el equipo se lee junto con su horario', async () => {
  const { error } = await a.cliente
    .from('staff')
    .select('id, staff_services(service_id), working_hours(weekday, starts_at, ends_at)')
    .eq('business_id', a.businessId);
  expect(error).toBeNull();
});

describe('garantías de la tabla aunque se salten la función', () => {
  it('NO puede insertar un turno en su negocio con el trabajador de otro', async () => {
    const { error } = await a.cliente
      .from('working_hours')
      .insert({ business_id: a.businessId, staff_id: b.staffId, weekday: 1, starts_at: '09:00', ends_at: '10:00' });
    expect(error).not.toBeNull();
  });

  it('NO puede insertar un turno que se cruza con otro del mismo día', async () => {
    const { error } = await a.cliente
      .from('working_hours')
      .insert({ business_id: a.businessId, staff_id: a.staffId, weekday: 6, starts_at: '11:00', ends_at: '13:00' });
    expect(error).not.toBeNull();
  });
});
