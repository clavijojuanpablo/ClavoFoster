import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Perfil del negocio (B4): qué puede cambiar el dueño de su negocio y dónde
 * puede subir fotos.
 *
 * Todo se prueba con la llave publicable y la sesión del dueño, que es
 * exactamente lo que tiene cualquiera que abra la consola del navegador.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'prueba-perfil-12345';
const BUCKET = 'business-photos';

// PNG de 1×1 píxel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type Dueno = { userId: string; businessId: string; cliente: SupabaseClient };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `perfil-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Perfil ${nombre}`,
    p_slug: `perfil-${nombre}-${marca}`,
    p_category: 'salon',
  });
  if (eBiz) throw new Error(eBiz.message);

  return { userId: data.user.id, businessId: businessId as string, cliente };
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
    const { data: archivos } = await admin.storage.from(BUCKET).list(d.businessId);
    if (archivos?.length) {
      await admin.storage.from(BUCKET).remove(archivos.map((f) => `${d.businessId}/${f.name}`));
    }
    await admin.from('businesses').delete().eq('id', d.businessId);
    await admin.auth.admin.deleteUser(d.userId);
  }
});

describe('columnas que el dueño puede cambiar', () => {
  it('actualiza dirección, coordenadas y zona horaria', async () => {
    const { error } = await a.cliente
      .from('businesses')
      .update({
        address: 'Carrera 7 #45-10',
        city: 'Bogotá',
        latitude: 4.6326,
        longitude: -74.0661,
        timezone: 'America/Lima',
      })
      .eq('id', a.businessId);

    expect(error).toBeNull();

    const { data } = await admin
      .from('businesses')
      .select('address, latitude, timezone')
      .eq('id', a.businessId)
      .single();
    expect(data?.address).toBe('Carrera 7 #45-10');
    expect(Number(data?.latitude)).toBeCloseTo(4.6326);
    expect(data?.timezone).toBe('America/Lima');
  });

  // El hueco que cierra esta migración: sin esto, un dueño en prueba se ponía
  // 'active' solo y nunca pagaba.
  it('NO puede cambiar el estado de su suscripción', async () => {
    const { error } = await a.cliente
      .from('businesses')
      .update({ status: 'active' })
      .eq('id', a.businessId);

    expect(error).not.toBeNull();

    const { data } = await admin.from('businesses').select('status').eq('id', a.businessId).single();
    expect(data?.status).toBe('trialing');
  });

  it('NO puede cambiar su slug', async () => {
    const { error } = await a.cliente
      .from('businesses')
      .update({ slug: `otro-${marca}` })
      .eq('id', a.businessId);

    expect(error).not.toBeNull();
  });

  it('rechaza una zona horaria inventada', async () => {
    const { error } = await a.cliente
      .from('businesses')
      .update({ timezone: 'Bogota' })
      .eq('id', a.businessId);

    expect(error?.hint).toBe('zona_horaria_invalida');
  });

  it('rechaza una coordenada sin la otra', async () => {
    const { error } = await a.cliente
      .from('businesses')
      .update({ latitude: 4.6, longitude: null })
      .eq('id', a.businessId);

    expect(error).not.toBeNull();
  });

  it('rechaza más de 10 fotos', async () => {
    const fotos = Array.from({ length: 11 }, (_, i) => `${a.businessId}/${i}.jpg`);
    const { error } = await a.cliente.from('businesses').update({ photos: fotos }).eq('id', a.businessId);

    expect(error).not.toBeNull();
  });
});

describe('fotos en Storage', () => {
  it('el dueño sube una foto a la carpeta de su negocio', async () => {
    const { error } = await a.cliente.storage
      .from(BUCKET)
      .upload(`${a.businessId}/fachada-${marca}.png`, PNG, { contentType: 'image/png' });

    expect(error).toBeNull();
  });

  it('NO puede subir a la carpeta de otro negocio', async () => {
    const { error } = await a.cliente.storage
      .from(BUCKET)
      .upload(`${b.businessId}/intruso-${marca}.png`, PNG, { contentType: 'image/png' });

    expect(error).not.toBeNull();
  });

  it('NO puede subir fuera de una carpeta de negocio', async () => {
    for (const ruta of [`suelta-${marca}.png`, `no-es-uuid/foto-${marca}.png`]) {
      const { error } = await a.cliente.storage
        .from(BUCKET)
        .upload(ruta, PNG, { contentType: 'image/png' });

      expect(error, ruta).not.toBeNull();
    }
  });

  it('NO puede borrar las fotos de otro negocio', async () => {
    const ruta = `${b.businessId}/de-b-${marca}.png`;
    await b.cliente.storage.from(BUCKET).upload(ruta, PNG, { contentType: 'image/png' });

    await a.cliente.storage.from(BUCKET).remove([ruta]);

    const { data } = await admin.storage.from(BUCKET).list(b.businessId);
    expect(data?.some((f) => f.name === `de-b-${marca}.png`)).toBe(true);
  });

  it('sin sesión no se sube nada', async () => {
    const anonimo = createClient(url, publishableKey, { auth: { persistSession: false } });
    const { error } = await anonimo.storage
      .from(BUCKET)
      .upload(`${a.businessId}/anonima-${marca}.png`, PNG, { contentType: 'image/png' });

    expect(error).not.toBeNull();
  });
});
