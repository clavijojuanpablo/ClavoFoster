import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { obtenerCatalogoReservable, obtenerDisponibilidad, obtenerVentanaDeCupos } from '@/lib/booking/disponibilidad';
import type { NegocioPublico } from '@/lib/tenant';

/**
 * Disponibilidad pública (F2 y F3): el motor de cupos conectado con la base.
 *
 * El motor ya tiene sus pruebas puras en `motor-de-cupos.test.ts`. Lo que se
 * prueba acá es el cableado, que es donde se rompen estas cosas: que el horario
 * salga de `working_hours`, que las citas y los bloqueos tapen de verdad, que
 * el cierre del local le caiga a todo el mundo y que "el primero disponible"
 * reparta en vez de duplicar.
 *
 * 2030-01-09 es miércoles. Bogotá es UTC-5, así que las 9:00 locales son las
 * 14:00Z.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const marca = Math.random().toString(36).slice(2, 10);
const MIERCOLES = '2030-01-09';
/** La víspera al mediodía: lejos de la anticipación mínima y de la ventana. */
const AHORA = new Date('2030-01-08T17:00:00Z');

let negocio: NegocioPublico;
let servicioId: string;
let ana: string;
let beto: string;
let clienteId: string;

/** Las horas locales de los cupos, para leer las expectativas de un vistazo. */
function horas(cupos: { inicio: string }[]): string[] {
  return cupos.map((c) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(c.inicio)),
  );
}

async function cuposDe(staffId: string | null, fecha = MIERCOLES) {
  const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === servicioId)!;
  const dias = await obtenerDisponibilidad({
    negocio,
    servicio,
    staffId,
    desde: fecha,
    hasta: fecha,
    ahora: AHORA,
  });

  return dias[0].cupos;
}

beforeAll(async () => {
  const { data: business, error } = await admin
    .from('businesses')
    .insert({
      slug: `cupos-${marca}`,
      name: 'Estudio de prueba',
      category: 'barbershop',
      timezone: 'America/Bogota',
      slot_granularity_minutes: 30,
      min_notice_minutes: 0,
      max_advance_days: 60,
      align_to_clock: true,
      is_published: true,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  negocio = business as NegocioPublico;

  const { data: servicio, error: eServicio } = await admin
    .from('services')
    .insert({ business_id: negocio.id, name: 'Corte', duration_minutes: 30, price_cop: 30_000 })
    .select('id')
    .single();
  if (eServicio) throw new Error(eServicio.message);
  servicioId = servicio.id;

  const { data: equipo, error: eEquipo } = await admin
    .from('staff')
    .insert([
      { business_id: negocio.id, name: 'Ana', display_order: 0 },
      { business_id: negocio.id, name: 'Beto', display_order: 1 },
    ])
    .select('id, name');
  if (eEquipo) throw new Error(eEquipo.message);
  ana = equipo.find((p) => p.name === 'Ana')!.id;
  beto = equipo.find((p) => p.name === 'Beto')!.id;

  const { error: ePresta } = await admin.from('staff_services').insert([
    { business_id: negocio.id, staff_id: ana, service_id: servicioId },
    { business_id: negocio.id, staff_id: beto, service_id: servicioId },
  ]);
  if (ePresta) throw new Error(ePresta.message);

  // Turno partido de lunes a sábado: 9–13 y 14–18. Es el caso normal, no la excepción.
  const { error: eHorario } = await admin.from('working_hours').insert(
    [ana, beto].flatMap((staffId) =>
      [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
        { business_id: negocio.id, staff_id: staffId, weekday, starts_at: '09:00', ends_at: '13:00' },
        { business_id: negocio.id, staff_id: staffId, weekday, starts_at: '14:00', ends_at: '18:00' },
      ]),
    ),
  );
  if (eHorario) throw new Error(eHorario.message);

  const { data: cliente, error: eCliente } = await admin
    .from('customers')
    .insert({ business_id: negocio.id, phone: `+5730012${marca.slice(0, 5).replace(/\D/g, '') || '34567'}`.slice(0, 13), name: 'Cliente' })
    .select('id')
    .single();
  if (eCliente) throw new Error(eCliente.message);
  clienteId = cliente.id;
});

afterAll(async () => {
  if (negocio) await admin.from('businesses').delete().eq('id', negocio.id);
});

describe('catálogo reservable', () => {
  it('trae el servicio con quien lo presta, en el orden del equipo', async () => {
    const catalogo = await obtenerCatalogoReservable(negocio);

    expect(catalogo).toHaveLength(1);
    expect(catalogo[0].trabajadores.map((t) => t.nombre)).toEqual(['Ana', 'Beto']);
    expect(catalogo[0].trabajadores[0].duracionMinutos).toBe(30);
  });

  it('el servicio desactivado no se puede reservar', async () => {
    await admin.from('services').update({ is_active: false }).eq('id', servicioId);
    expect(await obtenerCatalogoReservable(negocio)).toHaveLength(0);

    await admin.from('services').update({ is_active: true }).eq('id', servicioId);
    expect(await obtenerCatalogoReservable(negocio)).toHaveLength(1);
  });

  it('la persona desactivada deja de aparecer y de ofrecer cupos', async () => {
    await admin.from('staff').update({ is_active: false }).eq('id', beto);

    const catalogo = await obtenerCatalogoReservable(negocio);
    expect(catalogo[0].trabajadores.map((t) => t.nombre)).toEqual(['Ana']);
    expect((await cuposDe(beto)).length).toBe(0);

    await admin.from('staff').update({ is_active: true }).eq('id', beto);
  });
});

describe('cupos de una persona', () => {
  it('sale el turno partido completo, sin cupos dentro del almuerzo', async () => {
    const libres = horas(await cuposDe(ana));

    expect(libres[0]).toBe('09:00');
    // El último de la mañana cabe entero antes de cerrar a la 1.
    expect(libres).toContain('12:30');
    expect(libres).not.toContain('13:00');
    expect(libres).not.toContain('13:30');
    expect(libres).toContain('14:00');
    // A las 17:30 empieza el último: termina justo a las 6.
    expect(libres.at(-1)).toBe('17:30');
  });

  it('un día sin horario no ofrece cupos y no revienta', async () => {
    // 2030-01-13 es domingo, y el horario va de lunes a sábado.
    expect(await cuposDe(ana, '2030-01-13')).toEqual([]);
  });

  it('una cita agendada tapa su hora', async () => {
    const { data: cita, error } = await admin
      .from('appointments')
      .insert({
        business_id: negocio.id,
        customer_id: clienteId,
        staff_id: ana,
        service_id: servicioId,
        start_at: `${MIERCOLES}T15:00:00Z`, // 10:00 en Bogotá
        end_at: `${MIERCOLES}T15:30:00Z`,
        price_cop: 30_000,
        duration_minutes: 30,
        status: 'confirmed',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    expect(horas(await cuposDe(ana))).not.toContain('10:00');
    // La de al lado sigue libre: la cita ocupa lo suyo, no media mañana.
    expect(horas(await cuposDe(ana))).toContain('10:30');
    // Y no le quita el cupo a nadie más.
    expect(horas(await cuposDe(beto))).toContain('10:00');

    // Cancelada, el cupo vuelve a estar libre.
    await admin.from('appointments').update({ status: 'cancelled' }).eq('id', cita.id);
    expect(horas(await cuposDe(ana))).toContain('10:00');

    await admin.from('appointments').delete().eq('id', cita.id);
  });

  it('el bloqueo de una persona solo la tapa a ella', async () => {
    const { data: bloqueo, error } = await admin
      .from('time_off')
      .insert({
        business_id: negocio.id,
        staff_id: ana,
        starts_at: `${MIERCOLES}T14:00:00Z`, // 9:00 a 11:00 en Bogotá
        ends_at: `${MIERCOLES}T16:00:00Z`,
        reason: 'Cita médica',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    expect(horas(await cuposDe(ana))).not.toContain('09:00');
    expect(horas(await cuposDe(ana))).toContain('11:00');
    expect(horas(await cuposDe(beto))).toContain('09:00');

    await admin.from('time_off').delete().eq('id', bloqueo.id);
  });

  it('el cierre del local tapa a todo el equipo', async () => {
    const { data: cierre, error } = await admin
      .from('time_off')
      .insert({
        business_id: negocio.id,
        staff_id: null,
        starts_at: `${MIERCOLES}T14:00:00Z`,
        ends_at: `${MIERCOLES}T16:00:00Z`,
        reason: 'Festivo',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    for (const persona of [ana, beto]) {
      expect(horas(await cuposDe(persona))).not.toContain('09:00');
      expect(horas(await cuposDe(persona))).not.toContain('10:30');
    }

    await admin.from('time_off').delete().eq('id', cierre.id);
  });
});

describe('el primero disponible', () => {
  it('no ofrece la misma hora dos veces', async () => {
    const cupos = await cuposDe(null);
    const deAna = await cuposDe(ana);

    expect(horas(cupos)).toEqual(horas(deAna));
    expect(new Set(cupos.map((c) => c.inicio)).size).toBe(cupos.length);
  });

  it('cada cupo dice a quién le tocó', async () => {
    const cupos = await cuposDe(null);

    expect(cupos.every((c) => [ana, beto].includes(c.staffId))).toBe(true);
    expect(cupos[0].staffNombre).toBeTruthy();
  });

  it('reparte: quien ya tiene citas ese día cede el cupo', async () => {
    // Ana arranca el día con una cita; Beto con ninguna.
    const { data: cita, error } = await admin
      .from('appointments')
      .insert({
        business_id: negocio.id,
        customer_id: clienteId,
        staff_id: ana,
        service_id: servicioId,
        start_at: `${MIERCOLES}T22:00:00Z`, // 5:00 p. m. en Bogotá
        end_at: `${MIERCOLES}T22:30:00Z`,
        price_cop: 30_000,
        duration_minutes: 30,
        status: 'confirmed',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const cupos = await cuposDe(null);
    // A las 9:00 los dos están libres, así que le toca al que va más suelto.
    expect(cupos.find((c) => horas([c])[0] === '09:00')?.staffId).toBe(beto);
    // Las 5 de la tarde solo las tiene Beto, y siguen ofreciéndose.
    expect(cupos.find((c) => horas([c])[0] === '17:00')?.staffId).toBe(beto);

    await admin.from('appointments').delete().eq('id', cita.id);
  });
});

describe('ventana de días', () => {
  it('trae catorce días y dice por dónde sigue', async () => {
    const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === servicioId)!;
    const ventana = await obtenerVentanaDeCupos({ negocio, servicio, staffId: null, desde: MIERCOLES, ahora: AHORA });

    expect(ventana.dias).toHaveLength(14);
    expect(ventana.dias[0].fecha).toBe(MIERCOLES);
    expect(ventana.dias.at(-1)!.fecha).toBe('2030-01-22');
    expect(ventana.siguienteDesde).toBe('2030-01-23');
  });

  it('se corta donde el negocio deja de recibir reservas', async () => {
    const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === servicioId)!;
    // max_advance_days = 60 contados desde AHORA (2030-01-08): el último día es
    // el 2030-03-09, así que la tanda que arranca el 2030-03-01 se queda corta.
    const ventana = await obtenerVentanaDeCupos({ negocio, servicio, staffId: null, desde: '2030-03-01', ahora: AHORA });

    expect(ventana.dias.at(-1)!.fecha).toBe('2030-03-09');
    expect(ventana.siguienteDesde).toBeNull();
  });

  it('la anticipación mínima corre los cupos de hoy', async () => {
    await admin.from('businesses').update({ min_notice_minutes: 120 }).eq('id', negocio.id);
    const conAviso = { ...negocio, min_notice_minutes: 120 };

    const servicio = (await obtenerCatalogoReservable(conAviso)).find((s) => s.id === servicioId)!;
    // Son las 10:00 de ese mismo miércoles en Bogotá: con dos horas de aviso,
    // lo más pronto son las 12:00.
    const [dia] = await obtenerDisponibilidad({
      negocio: conAviso,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: new Date(`${MIERCOLES}T15:00:00Z`),
    });

    expect(horas(dia.cupos)).not.toContain('11:30');
    expect(horas(dia.cupos)[0]).toBe('12:00');

    await admin.from('businesses').update({ min_notice_minutes: 0 }).eq('id', negocio.id);
  });
});
