import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * PRUEBA DE AISLAMIENTO ENTRE NEGOCIOS
 *
 * Es la prueba más importante del proyecto. Verifica que las políticas de RLS
 * realmente impiden que un negocio vea los datos de otro.
 *
 * Corre contra la base de datos real: crea dos negocios completos, se
 * autentica como dueño de uno e intenta leer todo lo del otro.
 *
 * Si esta prueba falla, NO SE DESPLIEGA.
 * Ver docs/05-arquitectura-multitenant.md y docs/03-backlog.md (tarea A3)
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

// Cliente privilegiado: solo para montar y desmontar el escenario.
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const marca = Math.random().toString(36).slice(2, 10);

type Negocio = {
  businessId: string;
  userId: string;
  email: string;
  staffId: string;
  serviceId: string;
  customerId: string;
  appointmentId: string;
};

const PASSWORD = 'prueba-aislamiento-12345';

async function crearNegocio(nombre: string, diaOffset: number): Promise<Negocio> {
  const { data: business, error: eB } = await admin
    .from('businesses')
    .insert({
      slug: `test-${nombre}-${marca}`,
      name: `Test ${nombre}`,
      category: 'barbershop',
      is_published: true,
      status: 'active',
    })
    .select('id')
    .single();
  if (eB) throw new Error(`crear negocio: ${eB.message}`);

  const email = `test-${nombre}-${marca}@ejemplo.test`;
  const { data: user, error: eU } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (eU) throw new Error(`crear usuario: ${eU.message}`);

  const { error: eM } = await admin.from('memberships').insert({
    user_id: user.user.id,
    business_id: business.id,
    role: 'owner',
  });
  if (eM) throw new Error(`crear membresia: ${eM.message}`);

  const { data: staff, error: eS } = await admin
    .from('staff')
    .insert({ business_id: business.id, name: `Barbero ${nombre}` })
    .select('id')
    .single();
  if (eS) throw new Error(`crear staff: ${eS.message}`);

  const { data: service, error: eSv } = await admin
    .from('services')
    .insert({
      business_id: business.id,
      name: 'Corte',
      duration_minutes: 45,
      price_cop: 30000,
    })
    .select('id')
    .single();
  if (eSv) throw new Error(`crear servicio: ${eSv.message}`);

  const { data: customer, error: eC } = await admin
    .from('customers')
    .insert({
      business_id: business.id,
      // Teléfono único por corrida para no chocar con unique(business_id, phone)
      phone: `+5730012${String(diaOffset).padStart(2, '0')}${marca.slice(0, 3).replace(/\D/g, '0')}`,
      name: `Cliente ${nombre}`,
    })
    .select('id')
    .single();
  if (eC) throw new Error(`crear cliente: ${eC.message}`);

  const inicio = new Date(Date.now() + diaOffset * 86400000);
  inicio.setUTCHours(15, 0, 0, 0);
  const fin = new Date(inicio.getTime() + 45 * 60000);

  const { data: appointment, error: eA } = await admin
    .from('appointments')
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      staff_id: staff.id,
      service_id: service.id,
      start_at: inicio.toISOString(),
      end_at: fin.toISOString(),
      price_cop: 30000,
      duration_minutes: 45,
      status: 'confirmed',
    })
    .select('id')
    .single();
  if (eA) throw new Error(`crear cita: ${eA.message}`);

  return {
    businessId: business.id,
    userId: user.user.id,
    email,
    staffId: staff.id,
    serviceId: service.id,
    customerId: customer.id,
    appointmentId: appointment.id,
  };
}

let negocioA: Negocio;
let negocioB: Negocio;
let comoA: SupabaseClient;

beforeAll(async () => {
  negocioA = await crearNegocio('alfa', 1);
  negocioB = await crearNegocio('beta', 2);

  comoA = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error } = await comoA.auth.signInWithPassword({
    email: negocioA.email,
    password: PASSWORD,
  });
  if (error) throw new Error(`iniciar sesion como A: ${error.message}`);
});

afterAll(async () => {
  for (const n of [negocioA, negocioB]) {
    if (!n) continue;
    await admin.from('businesses').delete().eq('id', n.businessId);
    await admin.auth.admin.deleteUser(n.userId);
  }
});

describe('aislamiento entre negocios', () => {
  // Sin esto, la prueba pasaría aunque RLS estuviera bloqueando TODO.
  // Primero hay que demostrar que A sí ve lo suyo.
  it('el dueño de A ve sus propios datos', async () => {
    const { data, error } = await comoA
      .from('appointments')
      .select('id')
      .eq('business_id', negocioA.businessId);

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  const tablasPrivadas = [
    'appointments',
    'customers',
    'working_hours',
    'time_off',
    'ledger_entries',
    'subscriptions',
    'notification_log',
  ] as const;

  it.each(tablasPrivadas)('A no puede leer %s de B', async (tabla) => {
    const { data, error } = await comoA
      .from(tabla)
      .select('id')
      .eq('business_id', negocioB.businessId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('A no puede leer el cliente de B ni por id directo', async () => {
    const { data } = await comoA
      .from('customers')
      .select('id, phone, name')
      .eq('id', negocioB.customerId);

    expect(data).toEqual([]);
  });

  it('A no puede escribir en el negocio de B', async () => {
    const { error } = await comoA.from('services').insert({
      business_id: negocioB.businessId,
      name: 'Servicio infiltrado',
      duration_minutes: 30,
      price_cop: 1,
    });

    // RLS rechaza el insert: la política with_check no se cumple.
    expect(error).not.toBeNull();
  });

  it('A no puede modificar el negocio de B', async () => {
    await comoA.from('businesses').update({ name: 'Secuestrado' }).eq('id', negocioB.businessId);

    const { data } = await admin
      .from('businesses')
      .select('name')
      .eq('id', negocioB.businessId)
      .single();

    expect(data?.name).toBe('Test beta');
  });

  // Así consulta el panel: SIN filtro de negocio, confiando en que RLS ya
  // recortó. Si esta prueba fallara, el panel mostraría datos de otro negocio.
  it('una consulta sin filtro devuelve solo lo del negocio de la sesión', async () => {
    const { data } = await comoA.from('appointments').select('id, business_id');

    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((c) => c.business_id === negocioA.businessId)).toBe(true);
  });

  // El criterio de la tarea A4: pedir explícitamente el negocio de otro no
  // sirve de nada. El business_id del navegador es, a lo sumo, una sugerencia.
  it('pedir explícitamente el business_id de B no da acceso', async () => {
    const { data } = await comoA
      .from('appointments')
      .select('id')
      .eq('business_id', negocioB.businessId);

    expect(data).toEqual([]);
  });

  it('A no ve la membresía de B', async () => {
    const { data } = await comoA.from('memberships').select('id, user_id');
    expect(data?.every((m) => m.user_id === negocioA.userId)).toBe(true);
  });
});

describe('lo que ve alguien sin sesión', () => {
  const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });

  it('ve el catálogo público del negocio', async () => {
    const { data } = await anonimo
      .from('services')
      .select('id, name, price_cop')
      .eq('business_id', negocioA.businessId);

    expect(data?.length).toBeGreaterThan(0);
  });

  it.each(['customers', 'appointments', 'ledger_entries', 'otp_codes'] as const)(
    'NO puede leer %s de nadie',
    async (tabla) => {
      const { data } = await anonimo.from(tabla).select('id');
      expect(data ?? []).toEqual([]);
    },
  );

  it('no ve el negocio si no está publicado', async () => {
    await admin.from('businesses').update({ is_published: false }).eq('id', negocioA.businessId);

    const { data } = await anonimo.from('businesses').select('id').eq('id', negocioA.businessId);
    expect(data).toEqual([]);

    await admin.from('businesses').update({ is_published: true }).eq('id', negocioA.businessId);
  });

  it('no ve el negocio si la suscripción está suspendida', async () => {
    await admin.from('businesses').update({ status: 'suspended' }).eq('id', negocioA.businessId);

    const { data } = await anonimo.from('businesses').select('id').eq('id', negocioA.businessId);
    expect(data).toEqual([]);

    await admin.from('businesses').update({ status: 'active' }).eq('id', negocioA.businessId);
  });
});
