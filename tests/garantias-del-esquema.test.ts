import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Las garantías que da la BASE DE DATOS, no la aplicación.
 *
 * Cada una de estas reglas existe para que un bug en el código no pueda
 * corromper los datos. Si alguna se cae, hay una clase entera de errores que
 * vuelve a ser posible.
 *
 * Ver docs/06-motor-de-agendamiento.md y docs/07-modelo-de-datos.md
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const marca = Math.random().toString(36).slice(2, 10);

let businessId: string;
let staffA: string;
let staffB: string;
let serviceId: string;
let customerId: string;

const base = new Date();
base.setUTCFullYear(base.getUTCFullYear() + 1);
base.setUTCHours(15, 0, 0, 0);

const enMinutos = (m: number) => new Date(base.getTime() + m * 60000).toISOString();

/** Inserta una cita; devuelve el error de Postgres si lo hubo. */
async function crearCita(opts: {
  staffId: string;
  desdeMin: number;
  duracion: number;
  status?: string;
  bufferAntes?: number;
  bufferDespues?: number;
}) {
  const { error, data } = await admin
    .from('appointments')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      staff_id: opts.staffId,
      service_id: serviceId,
      start_at: enMinutos(opts.desdeMin),
      end_at: enMinutos(opts.desdeMin + opts.duracion),
      price_cop: 30000,
      duration_minutes: opts.duracion,
      buffer_before_minutes: opts.bufferAntes ?? 0,
      buffer_after_minutes: opts.bufferDespues ?? 0,
      status: opts.status ?? 'confirmed',
    })
    .select('id')
    .maybeSingle();
  return { error, id: data?.id as string | undefined };
}

beforeAll(async () => {
  const { data: b } = await admin
    .from('businesses')
    .insert({ slug: `garantias-${marca}`, name: 'Garantías', category: 'barbershop' })
    .select('id')
    .single();
  businessId = b!.id;

  const { data: s } = await admin
    .from('staff')
    .insert([
      { business_id: businessId, name: 'A' },
      { business_id: businessId, name: 'B' },
    ])
    .select('id');
  staffA = s![0].id;
  staffB = s![1].id;

  const { data: sv } = await admin
    .from('services')
    .insert({ business_id: businessId, name: 'Corte', duration_minutes: 45, price_cop: 30000 })
    .select('id')
    .single();
  serviceId = sv!.id;

  const { data: c } = await admin
    .from('customers')
    .insert({ business_id: businessId, name: 'Cliente', phone: `+5730099${marca.replace(/\D/g, '1').slice(0, 5)}` })
    .select('id')
    .single();
  customerId = c!.id;
});

afterAll(async () => {
  if (businessId) await admin.from('businesses').delete().eq('id', businessId);
});

describe('doble reserva', () => {
  it('rechaza dos citas que se pisan para el mismo trabajador', async () => {
    const primera = await crearCita({ staffId: staffA, desdeMin: 0, duracion: 60 });
    expect(primera.error).toBeNull();

    // Empieza 30 min después: se solapa.
    const segunda = await crearCita({ staffId: staffA, desdeMin: 30, duracion: 60 });
    expect(segunda.error).not.toBeNull();
  });

  it('permite la misma hora para trabajadores distintos', async () => {
    const { error } = await crearCita({ staffId: staffB, desdeMin: 0, duracion: 60 });
    expect(error).toBeNull();
  });

  it('permite una cita que empieza justo cuando termina la anterior', async () => {
    const { error } = await crearCita({ staffId: staffA, desdeMin: 60, duracion: 30 });
    expect(error).toBeNull();
  });

  it('una cita cancelada NO bloquea el cupo', async () => {
    const cancelada = await crearCita({
      staffId: staffA, desdeMin: 200, duracion: 60, status: 'cancelled',
    });
    expect(cancelada.error).toBeNull();

    const nueva = await crearCita({ staffId: staffA, desdeMin: 200, duracion: 60 });
    expect(nueva.error).toBeNull();
  });

  it('una cita pendiente SÍ bloquea el cupo (es la retención)', async () => {
    const pendiente = await crearCita({
      staffId: staffA, desdeMin: 400, duracion: 60, status: 'pending',
    });
    expect(pendiente.error).toBeNull();

    const otra = await crearCita({ staffId: staffA, desdeMin: 400, duracion: 60 });
    expect(otra.error).not.toBeNull();
  });

  it('los buffers también bloquean', async () => {
    // 600–660 con 30 min de buffer después ⇒ ocupa hasta 690
    const conBuffer = await crearCita({
      staffId: staffB, desdeMin: 600, duracion: 60, bufferDespues: 30,
    });
    expect(conBuffer.error).toBeNull();

    // Empezar a los 670 caería dentro del buffer
    const dentroDelBuffer = await crearCita({ staffId: staffB, desdeMin: 670, duracion: 30 });
    expect(dentroDelBuffer.error).not.toBeNull();

    // A los 690 ya cabe
    const despuesDelBuffer = await crearCita({ staffId: staffB, desdeMin: 690, duracion: 30 });
    expect(despuesDelBuffer.error).toBeNull();
  });
});

describe('retención de cupo', () => {
  it('una retención vencida bloquea hasta que se limpia, y después libera', async () => {
    // Alguien escogió la hora y abandonó antes de verificar su celular.
    const { error: eRetencion } = await admin.from('appointments').insert({
      business_id: businessId,
      customer_id: customerId,
      staff_id: staffA,
      service_id: serviceId,
      start_at: enMinutos(1500),
      end_at: enMinutos(1545),
      price_cop: 30000,
      duration_minutes: 45,
      status: 'pending',
      expires_at: new Date(Date.now() - 60_000).toISOString(), // venció hace un minuto
    });
    expect(eRetencion).toBeNull();

    // Mientras no se limpie, sigue apartando el cupo.
    const bloqueada = await crearCita({ staffId: staffA, desdeMin: 1500, duracion: 45 });
    expect(bloqueada.error).not.toBeNull();

    // La misma consulta que corre /api/cron/cleanup-holds
    const { data: liberadas } = await admin
      .from('appointments')
      .delete()
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');
    expect(liberadas?.length).toBeGreaterThan(0);

    // Ahora el cupo está libre otra vez.
    const despues = await crearCita({ staffId: staffA, desdeMin: 1500, duracion: 45 });
    expect(despues.error).toBeNull();
  });

  it('una retención vigente NO se limpia', async () => {
    const { data: vigente } = await admin
      .from('appointments')
      .insert({
        business_id: businessId,
        customer_id: customerId,
        staff_id: staffB,
        service_id: serviceId,
        start_at: enMinutos(1700),
        end_at: enMinutos(1745),
        price_cop: 30000,
        duration_minutes: 45,
        status: 'pending',
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .select('id')
      .single();

    await admin
      .from('appointments')
      .delete()
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    const { data } = await admin.from('appointments').select('id').eq('id', vigente!.id);
    expect(data?.length).toBe(1);
  });
});

describe('contabilidad', () => {
  it('una cita no puede generar dos ingresos', async () => {
    const { id } = await crearCita({ staffId: staffB, desdeMin: 900, duracion: 45 });

    const asiento = {
      business_id: businessId,
      direction: 'income' as const,
      amount_cop: 30000,
      occurred_on: base.toISOString().slice(0, 10),
      payment_method: 'cash' as const,
      appointment_id: id,
    };

    expect((await admin.from('ledger_entries').insert(asiento)).error).toBeNull();
    expect((await admin.from('ledger_entries').insert(asiento)).error).not.toBeNull();
  });

  it('no acepta montos negativos', async () => {
    const { error } = await admin.from('ledger_entries').insert({
      business_id: businessId,
      direction: 'expense',
      amount_cop: -1000,
      occurred_on: base.toISOString().slice(0, 10),
      payment_method: 'cash',
    });
    expect(error).not.toBeNull();
  });
});

describe('notificaciones', () => {
  it('no se puede encolar dos veces el mismo recordatorio', async () => {
    const { id } = await crearCita({ staffId: staffA, desdeMin: 1200, duracion: 45 });

    const mensaje = {
      business_id: businessId,
      appointment_id: id,
      channel: 'whatsapp' as const,
      template: 'reminder_24h',
      recipient: '+573001234567',
    };

    expect((await admin.from('notification_log').insert(mensaje)).error).toBeNull();
    expect((await admin.from('notification_log').insert(mensaje)).error).not.toBeNull();
  });
});

describe('validaciones de datos', () => {
  it('rechaza un slug con mayúsculas', async () => {
    const { error } = await admin
      .from('businesses')
      .insert({ slug: `MAYUS-${marca}`, name: 'X', category: 'barbershop' });
    expect(error).not.toBeNull();
  });

  it('rechaza un slug reservado', async () => {
    const { error } = await admin
      .from('businesses')
      .insert({ slug: 'admin', name: 'X', category: 'barbershop' });
    expect(error).not.toBeNull();
  });

  it('rechaza un teléfono que no está en formato internacional', async () => {
    const { error } = await admin
      .from('customers')
      .insert({ business_id: businessId, name: 'Mal', phone: '3001234567' });
    expect(error).not.toBeNull();
  });

  it('rechaza dos clientes con el mismo teléfono en el mismo negocio', async () => {
    const phone = `+57300777${marca.replace(/\D/g, '2').slice(0, 4)}`;
    expect(
      (await admin.from('customers').insert({ business_id: businessId, name: 'Uno', phone })).error,
    ).toBeNull();
    expect(
      (await admin.from('customers').insert({ business_id: businessId, name: 'Dos', phone })).error,
    ).not.toBeNull();
  });

  it('rechaza una cita que termina antes de empezar', async () => {
    const { error } = await admin.from('appointments').insert({
      business_id: businessId,
      customer_id: customerId,
      staff_id: staffA,
      service_id: serviceId,
      start_at: enMinutos(100),
      end_at: enMinutos(50),
      price_cop: 30000,
      duration_minutes: 45,
    });
    expect(error).not.toBeNull();
  });

  it('rechaza un horario que termina antes de empezar', async () => {
    const { error } = await admin.from('working_hours').insert({
      business_id: businessId,
      staff_id: staffA,
      weekday: 1,
      starts_at: '18:00',
      ends_at: '09:00',
    });
    expect(error).not.toBeNull();
  });
});
