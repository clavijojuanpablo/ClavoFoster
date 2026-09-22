import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { obtenerCatalogoReservable, obtenerDisponibilidad } from '@/lib/booking/disponibilidad';
import { cancelarPorToken, obtenerCitaPorToken, reprogramarPorToken } from '@/lib/booking/gestion';
import { enmascarar, INTENTOS_MAX, solicitarCodigo, telefonoDelToken, verificarCodigo } from '@/lib/booking/otp';
import { crearCita } from '@/lib/booking/reservar';
import type { ServicioReservable } from '@/lib/booking/tipos';
import type { NegocioPublico } from '@/lib/tenant';

/**
 * La reserva pública de punta a punta (F4, F5 y F6): código por WhatsApp,
 * crear la cita y cancelarla por el link.
 *
 * Corre sin credenciales de Meta: el canal entra en modo consola y el código se
 * lee de la base, que es lo que haría un atacante y por eso es buena prueba de
 * que el código en claro nunca se guarda.
 *
 * 2030-01-09 es miércoles. Bogotá es UTC-5.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const marca = Math.random().toString(36).slice(2, 8).replace(/\D/g, '0').padStart(6, '1');
const TELEFONO = `+5730011${marca.slice(0, 5)}`.slice(0, 13);
const OTRO = `+5730022${marca.slice(0, 5)}`.slice(0, 13);
const MIERCOLES = '2030-01-09';
const AHORA = new Date('2030-01-08T17:00:00Z');

let negocio: NegocioPublico;
let servicio: ServicioReservable;
let ana: string;

/** El primer cupo libre de Ana ese miércoles. */
async function primerCupo(): Promise<string> {
  const [dia] = await obtenerDisponibilidad({
    negocio,
    servicio,
    staffId: ana,
    desde: MIERCOLES,
    hasta: MIERCOLES,
    ahora: AHORA,
  });

  return dia.cupos[0].inicio;
}

/**
 * Siembra un código conocido, con la misma huella que usa producción.
 *
 * El código en claro no se guarda en ninguna parte —solo su HMAC—, así que una
 * prueba no lo puede leer, y adivinarlo es justo lo que impiden los cinco
 * intentos. Sembrarlo con el mismo HMAC es lo que deja probar la verificación
 * de verdad; que haya que hacer esto es, de hecho, la prueba de que el código
 * no queda expuesto.
 */
async function sembrarCodigo(telefono: string, codigo: string, opciones: { vencido?: boolean } = {}) {
  const { createHmac } = await import('node:crypto');
  const hash = createHmac('sha256', secretKey).update(`${telefono}:${codigo}`).digest('hex');

  await admin.from('otp_codes').insert({
    business_id: negocio.id,
    phone: telefono,
    code_hash: hash,
    // Relativo al reloj simulado: el token que sale de verificar vence contra
    // ese mismo reloj, y con la hora real quedaría vencido antes de nacer.
    expires_at: new Date(AHORA.getTime() + (opciones.vencido ? -60_000 : 600_000)).toISOString(),
  });

  return codigo;
}

beforeAll(async () => {
  const { data: business, error } = await admin
    .from('businesses')
    .insert({
      slug: `reserva-${marca}`,
      name: 'Estudio de reservas',
      category: 'barbershop',
      timezone: 'America/Bogota',
      slot_granularity_minutes: 30,
      min_notice_minutes: 0,
      max_advance_days: 60,
      cancel_notice_minutes: 240,
      align_to_clock: true,
      is_published: true,
      status: 'active',
      phone: '+573001112233',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  negocio = business as NegocioPublico;

  const { data: s } = await admin
    .from('services')
    .insert({ business_id: negocio.id, name: 'Corte', duration_minutes: 30, price_cop: 30_000 })
    .select('id')
    .single();

  const { data: persona } = await admin
    .from('staff')
    .insert({ business_id: negocio.id, name: 'Ana' })
    .select('id')
    .single();
  ana = persona!.id;

  await admin.from('staff_services').insert({ business_id: negocio.id, staff_id: ana, service_id: s!.id });
  await admin.from('working_hours').insert(
    [1, 2, 3, 4, 5].map((weekday) => ({
      business_id: negocio.id,
      staff_id: ana,
      weekday,
      starts_at: '09:00',
      ends_at: '18:00',
    })),
  );

  servicio = (await obtenerCatalogoReservable(negocio))[0];
});

afterAll(async () => {
  if (negocio) {
    await admin.from('otp_codes').delete().eq('business_id', negocio.id);
    await admin.from('businesses').delete().eq('id', negocio.id);
  }
});

describe('el código por WhatsApp', () => {
  it('no guarda el código en claro, solo su huella', async () => {
    await sembrarCodigo(TELEFONO, '111111');

    const { data } = await admin
      .from('otp_codes')
      .select('code_hash')
      .eq('phone', TELEFONO)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(data!.code_hash).not.toContain('111111');
    expect(data!.code_hash).toHaveLength(64);

    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
  });

  it('un código correcto identifica al cliente y dice que es nuevo', async () => {
    await sembrarCodigo(TELEFONO, '222222');

    const r = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '222222', ahora: AHORA });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.esClienteNuevo).toBe(true);
    expect(r.nombre).toBeNull();
    expect(telefonoDelToken(r.token, negocio.id)).toBe(TELEFONO);
  });

  it('el token no sirve para otro negocio ni después de vencer', async () => {
    await sembrarCodigo(TELEFONO, '333333');
    const r = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '333333', ahora: AHORA });
    if (!r.ok) throw new Error('debería haber verificado');

    expect(telefonoDelToken(r.token, '00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(telefonoDelToken(r.token, negocio.id, new Date(AHORA.getTime() + 60 * 60_000))).toBeNull();
    expect(telefonoDelToken(`${r.token}x`, negocio.id)).toBeNull();
    expect(telefonoDelToken('cualquier-cosa', negocio.id)).toBeNull();
  });

  it('un código equivocado gasta intentos y a los cinco se cierra', async () => {
    await admin.from('otp_codes').delete().eq('phone', OTRO);
    await sembrarCodigo(OTRO, '444444');

    for (let i = 1; i <= INTENTOS_MAX; i++) {
      const r = await verificarCodigo({ negocio, telefono: OTRO, codigo: '000000', ahora: AHORA });
      expect(r.ok).toBe(false);
    }

    // Aunque ahora escriba el bueno, ya no sirve.
    const r = await verificarCodigo({ negocio, telefono: OTRO, codigo: '444444', ahora: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Pide un código nuevo');
  });

  it('un código vencido no sirve', async () => {
    await admin.from('otp_codes').delete().eq('phone', OTRO);
    await sembrarCodigo(OTRO, '555555', { vencido: true });

    const r = await verificarCodigo({ negocio, telefono: OTRO, codigo: '555555', ahora: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('venció');
  });

  it('un código solo se puede usar una vez', async () => {
    await admin.from('otp_codes').delete().eq('phone', OTRO);
    await sembrarCodigo(OTRO, '666666');

    expect((await verificarCodigo({ negocio, telefono: OTRO, codigo: '666666', ahora: AHORA })).ok).toBe(true);
    expect((await verificarCodigo({ negocio, telefono: OTRO, codigo: '666666', ahora: AHORA })).ok).toBe(false);
  });

  it('hay que esperar un minuto entre un envío y otro', async () => {
    await admin.from('otp_codes').delete().eq('phone', OTRO);

    expect((await solicitarCodigo({ negocio, telefono: OTRO, ip: null })).ok).toBe(true);

    const segundo = await solicitarCodigo({ negocio, telefono: OTRO, ip: null });
    expect(segundo.ok).toBe(false);
    if (!segundo.ok) expect(segundo.error).toContain('Espera');
  });

  it('enmascara el número para que el cliente lo reconozca sin exponerlo', () => {
    expect(enmascarar('+573001234567')).toBe('+57 300 *** 4567');
  });
});

describe('crear la cita', () => {
  it('sin token no se puede reservar', async () => {
    const resultado = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio: await primerCupo(),
      token: 'inventado',
      nombre: 'Tramposo',
      nota: null,
      ahora: AHORA,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain('venció');
  });

  it('guarda la cita, copia precio y duración, y devuelve el link de gestión', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '777777');
    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '777777', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    const inicio = await primerCupo();
    const resultado = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio,
      token: v.token,
      nombre: 'Camila Restrepo',
      nota: 'Voy con mi hijo',
      ahora: AHORA,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.cita.linkDeGestion).toContain(`/cita/${resultado.cita.token}`);

    const cita = await obtenerCitaPorToken(resultado.cita.token);
    expect(cita?.estado).toBe('confirmed');
    expect(cita?.precioCop).toBe(30_000);
    expect(cita?.duracionMinutos).toBe(30);
    expect(cita?.nota).toBe('Voy con mi hijo');

    // Y esa hora deja de ofrecerse.
    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    expect(dia.cupos.map((c) => c.inicio)).not.toContain(inicio);
  });

  it('al que vuelve no le vuelve a pedir el nombre', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '888888');

    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '888888', ahora: AHORA });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.esClienteNuevo).toBe(false);
    expect(v.nombre).toBe('Camila Restrepo');

    // Y puede reservar sin mandar nombre.
    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    const otro = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio: dia.cupos[0].inicio,
      token: v.token,
      nombre: null,
      nota: null,
      ahora: AHORA,
    });

    expect(otro.ok).toBe(true);
  });

  it('dos personas por el mismo cupo: la base deja pasar una sola', async () => {
    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    const cupo = dia.cupos[0].inicio;

    const tokens = await Promise.all(
      [OTRO, `+5730033${marca.slice(0, 5)}`.slice(0, 13)].map(async (telefono) => {
        await admin.from('otp_codes').delete().eq('phone', telefono);
        await sembrarCodigo(telefono, '999999');
        const v = await verificarCodigo({ negocio, telefono, codigo: '999999', ahora: AHORA });
        if (!v.ok) throw new Error('no verificó');
        return v.token;
      }),
    );

    // A la vez, de verdad: es lo único que prueba la restricción de exclusión.
    const resultados = await Promise.all(
      tokens.map((token, i) =>
        crearCita({
          negocio,
          servicio,
          staffId: ana,
          inicio: cupo,
          token,
          nombre: `Cliente ${i}`,
          nota: null,
          ahora: AHORA,
        }),
      ),
    );

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const perdedor = resultados.find((r) => !r.ok);
    expect(perdedor && !perdedor.ok && perdedor.cupoOcupado).toBe(true);
  });
});

describe('gestión por link', () => {
  it('un token inventado no muestra nada', async () => {
    expect(await obtenerCitaPorToken('a'.repeat(48))).toBeNull();
  });

  it('cancelar libera el cupo de inmediato', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '101010');
    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '101010', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    const inicio = await primerCupo();
    const creada = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio,
      token: v.token,
      nombre: null,
      nota: null,
      ahora: AHORA,
    });
    if (!creada.ok) throw new Error(creada.error);

    // Se cancela desde el futuro cercano, dentro del plazo de 4 horas previas.
    const cancelada = await cancelarPorToken(creada.cita.token, AHORA);
    expect(cancelada.ok).toBe(true);

    expect((await obtenerCitaPorToken(creada.cita.token))?.estado).toBe('cancelled');

    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    expect(dia.cupos.map((c) => c.inicio)).toContain(inicio);
  });

  it('fuera del plazo no se cancela sola: manda al teléfono del negocio', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '121212');
    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '121212', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    const inicio = await primerCupo();
    const creada = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio,
      token: v.token,
      nombre: null,
      nota: null,
      ahora: AHORA,
    });
    if (!creada.ok) throw new Error(creada.error);

    // Una hora antes de la cita, con un aviso exigido de cuatro.
    const casiEncima = new Date(new Date(inicio).getTime() - 60 * 60_000);
    const r = await cancelarPorToken(creada.cita.token, casiEncima);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('+573001112233');

    // Y la cita sigue en pie.
    expect((await obtenerCitaPorToken(creada.cita.token))?.estado).toBe('confirmed');
  });
});

describe('mover la cita', () => {
  it('cambia la hora sin cambiar el token ni el precio, y libera la anterior', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '131313');
    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '131313', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    const original = dia.cupos[0].inicio;
    const nueva = dia.cupos[3].inicio;

    const creada = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio: original,
      token: v.token,
      nombre: null,
      nota: null,
      ahora: AHORA,
    });
    if (!creada.ok) throw new Error(creada.error);

    const movida = await reprogramarPorToken({
      token: creada.cita.token,
      inicio: nueva,
      staffId: ana,
      ahora: AHORA,
    });
    expect(movida.ok).toBe(true);

    // Es la MISMA cita: mismo token, mismo precio, otra hora.
    const despues = await obtenerCitaPorToken(creada.cita.token);
    expect(despues?.inicio).toBe(nueva);
    expect(despues?.precioCop).toBe(30_000);
    expect(despues?.estado).toBe('confirmed');

    const [ahoraLibre] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });
    const libres = ahoraLibre.cupos.map((c) => c.inicio);
    expect(libres).toContain(original);
    expect(libres).not.toContain(nueva);
  });

  it('no se puede mover a una hora ya ocupada', async () => {
    const [dia] = await obtenerDisponibilidad({
      negocio,
      servicio,
      staffId: ana,
      desde: MIERCOLES,
      hasta: MIERCOLES,
      ahora: AHORA,
    });

    await admin.from('otp_codes').delete().eq('phone', OTRO);
    await sembrarCodigo(OTRO, '141414');
    const v = await verificarCodigo({ negocio, telefono: OTRO, codigo: '141414', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    // Dos citas: la de OTRO se intenta mover encima de una que ya existe.
    const suya = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio: dia.cupos[0].inicio,
      token: v.token,
      nombre: 'Quien mueve',
      nota: null,
      ahora: AHORA,
    });
    if (!suya.ok) throw new Error(suya.error);

    const { data: ocupada } = await admin
      .from('appointments')
      .select('start_at')
      .eq('business_id', negocio.id)
      .in('status', ['pending', 'confirmed'])
      .neq('manage_token', suya.cita.token)
      .limit(1)
      .single();

    const r = await reprogramarPorToken({
      token: suya.cita.token,
      inicio: ocupada!.start_at,
      staffId: ana,
      ahora: AHORA,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.cupoOcupado).toBe(true);
  });

  it('fuera del plazo no se mueve sola', async () => {
    await admin.from('otp_codes').delete().eq('phone', TELEFONO);
    await sembrarCodigo(TELEFONO, '151515');
    const v = await verificarCodigo({ negocio, telefono: TELEFONO, codigo: '151515', ahora: AHORA });
    if (!v.ok) throw new Error('no verificó');

    const inicio = await primerCupo();
    const creada = await crearCita({
      negocio,
      servicio,
      staffId: ana,
      inicio,
      token: v.token,
      nombre: null,
      nota: null,
      ahora: AHORA,
    });
    if (!creada.ok) throw new Error(creada.error);

    const casiEncima = new Date(new Date(inicio).getTime() - 60 * 60_000);
    const r = await reprogramarPorToken({
      token: creada.cita.token,
      inicio: new Date(new Date(inicio).getTime() + 3_600_000).toISOString(),
      staffId: ana,
      ahora: casiEncima,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('+573001112233');
  });
});
