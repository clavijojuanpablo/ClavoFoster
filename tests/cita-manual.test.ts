import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { obtenerCatalogoReservable, obtenerDisponibilidad } from '@/lib/booking/disponibilidad';
import type { ServicioReservable } from '@/lib/booking/tipos';
import { instanteLocal } from '@/lib/fechas';
import { buscarClientePorTelefono, catalogoParaAgendar, crearCitaManual, cuposSugeridos } from '@/lib/panel/nueva-cita';
import type { ContextoNegocio } from '@/lib/tenant';

/**
 * La cita que agenda el negocio desde el panel (G3).
 *
 * Con la sesión real del dueño: el cliente de Supabase "del servidor" se
 * cambia por uno con la sesión iniciada, así que RLS se evalúa de verdad, igual
 * que en producción. Lo único simulado es de dónde sale ese cliente.
 *
 * 2030-01-09 es miércoles. Bogotá es UTC-5.
 */

const sesion = vi.hoisted(() => ({ cliente: null as SupabaseClient | null }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => sesion.cliente }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const marca = Math.random().toString(36).slice(2, 10);
const digitos = String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
const PASSWORD = 'prueba-cita-manual-12345';
const MIERCOLES = '2030-01-09';
// El día anterior: todas las citas de la prueba son futuras.
const AHORA = new Date('2030-01-08T12:00:00Z');

type Dueno = { userId: string; cliente: SupabaseClient; contexto: ContextoNegocio; ana: string; beto: string };

async function crearDueno(nombre: string): Promise<Dueno> {
  const email = `manual-${nombre}-${marca}@ejemplo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(error.message);

  const cliente = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
  if (eLogin) throw new Error(eLogin.message);

  const { data: businessId, error: eBiz } = await cliente.rpc('create_business', {
    p_name: `Manual ${nombre}`,
    p_slug: `manual-${nombre}-${marca}`,
    p_category: 'barbershop',
  });
  if (eBiz) throw new Error(eBiz.message);

  const { data: negocio } = await cliente.from('businesses').select('*').eq('id', businessId).single();
  const { data: servicios } = await cliente.from('services').select('id').eq('business_id', businessId).limit(1);
  const { data: equipo } = await cliente
    .from('staff')
    .insert([
      { business_id: businessId, name: 'Ana' },
      { business_id: businessId, name: 'Beto' },
    ])
    .select('id, name');

  const ana = equipo!.find((t) => t.name === 'Ana')!.id;
  const beto = equipo!.find((t) => t.name === 'Beto')!.id;

  // Solo Ana presta el servicio, y solo ella tiene horario.
  await cliente.from('staff_services').insert({ business_id: businessId, staff_id: ana, service_id: servicios![0].id });
  await cliente.from('working_hours').insert(
    [1, 2, 3, 4, 5].map((weekday) => ({
      business_id: businessId,
      staff_id: ana,
      weekday,
      starts_at: '09:00',
      ends_at: '18:00',
    })),
  );

  return { userId: data.user.id, cliente, contexto: { negocio: negocio!, rol: 'owner', staffId: null }, ana, beto };
}

let a: Dueno;
let b: Dueno;
let corte: ServicioReservable;

function como(d: Dueno) {
  sesion.cliente = d.cliente;
}

function a_las(reloj: string) {
  return instanteLocal('America/Bogota', MIERCOLES, reloj);
}

beforeAll(async () => {
  a = await crearDueno('a');
  b = await crearDueno('b');
  como(a);
  corte = (await catalogoParaAgendar(a.contexto)).find((s) => s.trabajadores.length > 0)!;
});

afterAll(async () => {
  for (const d of [a, b]) {
    if (!d) continue;
    await admin.from('businesses').delete().eq('id', d.contexto.negocio.id);
    await admin.auth.admin.deleteUser(d.userId);
  }
});

describe('agendar desde el panel', () => {
  it('crea la cita confirmada, con precio y duración copiados, y al cliente nuevo', async () => {
    como(a);
    const telefono = `+57301${digitos}`;

    const r = await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      inicio: a_las('10:07'),
      cliente: { telefono, nombre: 'Camila' },
      notaInterna: 'Viene con el hijo',
      origen: 'walk_in',
      ahora: AHORA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const { data: cita } = await admin
      .from('appointments')
      .select('status, source, price_cop, duration_minutes, start_at, internal_note, customers(name, last_visit_at)')
      .eq('id', r.citaId)
      .single();

    expect(cita).toMatchObject({
      status: 'confirmed',
      source: 'walk_in',
      price_cop: corte.trabajadores[0].precioCop,
      duration_minutes: corte.trabajadores[0].duracionMinutos,
      internal_note: 'Viene con el hijo',
    });
    // A cualquier minuto, no solo en los cupos del motor.
    expect(new Date(cita!.start_at).toISOString()).toBe('2030-01-09T15:07:00.000Z');
    // La visita todavía no pasó.
    expect(cita!.customers).toMatchObject({ name: 'Camila', last_visit_at: null });

    // Al que llegó sin cita no se le manda nada.
    const { data: avisos } = await admin.from('notification_log').select('id').eq('appointment_id', r.citaId);
    expect(avisos).toHaveLength(0);
  });

  it('al cliente que vuelve no le cambia el nombre, y al que llamó le manda la confirmación', async () => {
    como(a);
    const telefono = `+57302${digitos}`;
    await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      inicio: a_las('12:00'),
      cliente: { telefono, nombre: 'Camila R. (la del flequillo)' },
      notaInterna: null,
      origen: 'walk_in',
      ahora: AHORA,
    });

    const r = await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      inicio: a_las('14:00'),
      cliente: { telefono, nombre: 'Cami' },
      notaInterna: null,
      origen: 'manual',
      ahora: AHORA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const conocido = await buscarClientePorTelefono(a.contexto, telefono);
    expect(conocido?.nombre).toBe('Camila R. (la del flequillo)');

    const { data: avisos } = await admin
      .from('notification_log')
      .select('template, recipient')
      .eq('appointment_id', r.citaId);
    expect(avisos).toEqual([{ template: 'booking_confirmed', recipient: telefono }]);
  });

  it('no deja poner a la misma persona en dos citas a la vez', async () => {
    como(a);
    const r = await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      inicio: a_las('10:15'),
      cliente: { telefono: `+57303${digitos}`, nombre: 'Pedro' },
      notaInterna: null,
      origen: 'manual',
      ahora: AHORA,
    });

    expect(r).toMatchObject({ ok: false, cupoOcupado: true });
  });

  it('no agenda con alguien que no presta el servicio', async () => {
    como(a);
    const r = await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.beto,
      inicio: a_las('16:00'),
      cliente: { telefono: `+57304${digitos}`, nombre: 'Luis' },
      notaInterna: null,
      origen: 'manual',
      ahora: AHORA,
    });

    expect(r.ok).toBe(false);
  });

  it('el trabajador solo agenda en su propia columna', async () => {
    como(a);
    const r = await crearCitaManual({
      contexto: { ...a.contexto, rol: 'staff', staffId: a.beto },
      servicio: corte,
      staffId: a.ana,
      inicio: a_las('16:00'),
      cliente: { telefono: `+57305${digitos}`, nombre: 'Luis' },
      notaInterna: null,
      origen: 'manual',
      ahora: AHORA,
    });

    expect(r).toEqual({ ok: false, error: 'Solo puedes agendar citas contigo' });
  });

  it('sugiere las horas libres del día, sin las que ya están tomadas', async () => {
    como(a);
    const cupos = await cuposSugeridos({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      fecha: MIERCOLES,
      ahora: new Date('2030-01-08T12:00:00Z'),
    });

    const relojes = cupos.map((c) => c.reloj);
    expect(relojes[0]).toBe('09:00');
    expect(relojes).not.toContain('12:00');
    expect(cupos[0].etiqueta).toBe('9:00 a. m.');
  });
});

describe('aislamiento', () => {
  it('otro negocio no encuentra a los clientes de este', async () => {
    como(b);
    expect(await buscarClientePorTelefono(b.contexto, `+57301${digitos}`)).toBeNull();
  });

  it('el catálogo de otro negocio no trae los servicios de este', async () => {
    como(b);
    const deB = await catalogoParaAgendar(b.contexto);
    expect(deB.some((s) => s.id === corte.id)).toBe(false);
  });
});

describe('agendar desde el panel: bordes', () => {
  const JUEVES = '2030-01-10';
  const DOMINGO = '2030-01-13';

  function el(fecha: string, reloj: string) {
    return instanteLocal('America/Bogota', fecha, reloj);
  }

  function agendar(inicio: Date, telefono: string, servicio: ServicioReservable = corte) {
    return crearCitaManual({
      contexto: a.contexto,
      servicio,
      staffId: a.ana,
      inicio,
      cliente: { telefono, nombre: 'Borde' },
      notaInterna: null,
      origen: 'walk_in',
      ahora: AHORA,
    });
  }

  it('la cita que empieza justo cuando termina otra no choca: [inicio, fin)', async () => {
    como(a);
    const duracion = corte.trabajadores[0].duracionMinutos;
    const primera = el(JUEVES, '09:00');
    const justoDespues = new Date(primera.getTime() + duracion * 60_000);

    expect((await agendar(primera, `+57310${digitos}`)).ok).toBe(true);
    expect((await agendar(justoDespues, `+57311${digitos}`)).ok).toBe(true);
    // Un minuto antes sí se monta.
    const unMinutoAntes = new Date(justoDespues.getTime() - 60_000);
    expect(await agendar(unMinutoAntes, `+57312${digitos}`)).toMatchObject({ ok: false, cupoOcupado: true });
  });

  it('la cita cancelada no ocupa: el mismo cupo se vuelve a agendar', async () => {
    como(a);
    const inicio = el(JUEVES, '15:00');
    const r = await agendar(inicio, `+57313${digitos}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    await admin.from('appointments').update({ status: 'cancelled', cancelled_by: 'business' }).eq('id', r.citaId);

    expect((await agendar(inicio, `+57314${digitos}`)).ok).toBe(true);
  });

  it('el buffer después de la cita también ocupa, aunque el servicio ya haya terminado', async () => {
    como(a);
    const conLimpieza = { ...corte, bufferDespuesMinutos: 15 };
    const duracion = corte.trabajadores[0].duracionMinutos;
    const inicio = el(JUEVES, '17:00');

    expect((await agendar(inicio, `+57315${digitos}`, conLimpieza)).ok).toBe(true);
    // Terminó el servicio, pero la silla se está limpiando.
    const enLaLimpieza = new Date(inicio.getTime() + (duracion + 5) * 60_000);
    expect(await agendar(enLaLimpieza, `+57316${digitos}`)).toMatchObject({ ok: false, cupoOcupado: true });
    // Pasada la limpieza, sí.
    const pasadaLaLimpieza = new Date(inicio.getTime() + (duracion + 15) * 60_000);
    expect((await agendar(pasadaLaLimpieza, `+57317${digitos}`)).ok).toBe(true);
  });

  it('agenda fuera del horario: un domingo sin turno, a las 7 de la mañana', async () => {
    como(a);
    const r = await agendar(el(DOMINGO, '07:00'), `+57318${digitos}`);
    expect(r.ok).toBe(true);
  });

  it('no sugiere nada en un día sin horario, y no revienta', async () => {
    como(a);
    const cupos = await cuposSugeridos({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      fecha: DOMINGO,
      ahora: new Date('2030-01-08T12:00:00Z'),
    });
    expect(cupos).toEqual([]);
  });

  it('no sugiere horas con alguien que no presta el servicio', async () => {
    como(a);
    const cupos = await cuposSugeridos({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.beto,
      fecha: MIERCOLES,
      ahora: new Date('2030-01-08T12:00:00Z'),
    });
    expect(cupos).toEqual([]);
  });

  it('la última sugerencia es la que cabe exacta hasta el cierre de las 18:00', async () => {
    como(a);
    const duracion = corte.trabajadores[0].duracionMinutos;
    const cupos = await cuposSugeridos({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      fecha: MIERCOLES,
      ahora: new Date('2030-01-08T12:00:00Z'),
    });
    const ultimo = instanteLocal('America/Bogota', MIERCOLES, cupos[cupos.length - 1].reloj);
    const cierre = instanteLocal('America/Bogota', MIERCOLES, '18:00');
    expect(ultimo.getTime() + duracion * 60_000).toBeLessThanOrEqual(cierre.getTime());
    expect(ultimo.getTime() + (duracion + a.contexto.negocio.slot_granularity_minutes) * 60_000).toBeGreaterThan(
      cierre.getTime(),
    );
  });
});

describe('el motor con la sesión del dueño ve lo mismo que con la llave maestra', () => {
  it('el mismo catálogo y los mismos cupos, leídos con RLS de miembro', async () => {
    como(a);

    const conLlave = await obtenerCatalogoReservable(a.contexto.negocio);
    const conSesion = await obtenerCatalogoReservable(a.contexto.negocio, a.cliente);
    expect(conSesion).toEqual(conLlave);

    const consulta = {
      negocio: a.contexto.negocio,
      servicio: corte,
      staffId: null,
      desde: MIERCOLES,
      hasta: '2030-01-13',
      ahora: new Date('2030-01-08T12:00:00Z'),
    };
    const diasConLlave = await obtenerDisponibilidad(consulta);
    const diasConSesion = await obtenerDisponibilidad({ ...consulta, cliente: a.cliente });
    expect(diasConSesion).toEqual(diasConLlave);
    // Y no es vacío por accidente: el miércoles hay horas y hay citas que las parten.
    expect(diasConSesion[0].cupos.length).toBeGreaterThan(0);
  });
});

describe('el aviso por WhatsApp', () => {
  it('no se manda si la cita que llamó se registra ya pasada', async () => {
    como(a);
    const r = await crearCitaManual({
      contexto: a.contexto,
      servicio: corte,
      staffId: a.ana,
      inicio: instanteLocal('America/Bogota', '2030-01-11', '10:00'),
      cliente: { telefono: `+57309${digitos}`, nombre: 'Tardío' },
      notaInterna: null,
      origen: 'manual',
      ahora: new Date('2030-01-11T18:00:00Z'),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const { data: avisos } = await admin.from('notification_log').select('id').eq('appointment_id', r.citaId);
    expect(avisos).toHaveLength(0);
  });
});
