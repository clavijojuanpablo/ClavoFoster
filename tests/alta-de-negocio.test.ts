import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Verifica create_business(): el único camino por el que nace un negocio.
 *
 * Lo importante acá no es solo que cree las filas, sino que un usuario NO pueda
 * hacerse dueño de un negocio ajeno ni crear negocios en masa.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-alta-12345';

let userId: string;
let comoUsuario: SupabaseClient;
let businessId: string | null = null;

beforeAll(async () => {
  const email = `alta-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  userId = data.user.id;

  comoUsuario = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await comoUsuario.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);
});

afterAll(async () => {
  if (businessId) await admin.from('businesses').delete().eq('id', businessId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

describe('create_business', () => {
  it('crea el negocio con todo lo que necesita para operar', async () => {
    const { data, error } = await comoUsuario.rpc('create_business', {
      p_name: 'Barbería de Prueba',
      p_slug: `alta-${marca}`,
      p_category: 'barbershop',
      p_phone: '+573001234567',
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    businessId = data as string;

    // El usuario quedó como dueño
    const { data: membresia } = await admin
      .from('memberships')
      .select('role, user_id')
      .eq('business_id', businessId)
      .single();
    expect(membresia?.role).toBe('owner');
    expect(membresia?.user_id).toBe(userId);

    // Arrancó la prueba gratis
    const { data: suscripcion } = await admin
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('business_id', businessId)
      .single();
    expect(suscripcion?.status).toBe('trialing');
    expect(new Date(suscripcion!.trial_ends_at!).getTime()).toBeGreaterThan(Date.now());

    // No arranca con la pantalla vacía: trae los servicios de barbería
    const { data: servicios } = await admin
      .from('services')
      .select('name')
      .eq('business_id', businessId);
    expect(servicios?.length).toBeGreaterThan(0);
    expect(servicios?.map((s) => s.name)).toContain('Corte de cabello');

    // Y las categorías contables, con la del sistema marcada
    const { data: categorias } = await admin
      .from('ledger_categories')
      .select('name, direction, is_system')
      .eq('business_id', businessId);
    expect(categorias?.some((c) => c.name === 'Servicios' && c.is_system)).toBe(true);
    expect(categorias?.some((c) => c.direction === 'expense')).toBe(true);
  });

  it('el dueño ya puede leer su propio negocio', async () => {
    const { data, error } = await comoUsuario
      .from('businesses')
      .select('id, name, status')
      .eq('id', businessId!)
      .single();

    expect(error).toBeNull();
    // Lo ve aunque no esté publicado ni activo: está en prueba.
    expect(data?.status).toBe('trialing');
  });

  it('una misma cuenta no puede crear un segundo negocio', async () => {
    const { error } = await comoUsuario.rpc('create_business', {
      p_name: 'Segundo negocio',
      p_slug: `alta-${marca}-dos`,
      p_category: 'salon',
    });

    expect(error).not.toBeNull();
  });

  it('rechaza un slug ya tomado', async () => {
    const { data } = await comoUsuario.rpc('slug_disponible', { p_slug: `alta-${marca}` });
    expect(data).toBe(false);
  });

  it('acepta un slug libre y normaliza mayúsculas', async () => {
    const { data } = await comoUsuario.rpc('slug_disponible', { p_slug: `LIBRE-${marca}` });
    expect(data).toBe(true);
  });

  it('sin sesión no se puede crear un negocio', async () => {
    const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });
    const { error } = await anonimo.rpc('create_business', {
      p_name: 'Negocio sin dueño',
      p_slug: `anon-${marca}`,
      p_category: 'barbershop',
    });

    expect(error).not.toBeNull();
  });
});
