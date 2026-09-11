/**
 * Datos de demostración para desarrollo.
 *
 *   npm run db:seed
 *
 * Crea una barbería completa con trabajadores, horarios, clientes, citas y
 * movimientos contables, para poder ver la aplicación con datos reales en vez
 * de pantallas vacías.
 *
 * Es idempotente: borra el negocio de demostración y lo vuelve a crear.
 *
 * NUNCA correr esto contra el proyecto de producción.
 * Ver docs/12-convenciones-de-desarrollo.md
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error('Faltan variables de entorno. Revisa .env.local');
  process.exit(1);
}

const SLUG = 'barberia-demo';
const EMAIL = 'demo@barberia.test';
const PASSWORD = 'demo12345';
const TZ_OFFSET_HORAS = 5; // America/Bogota = UTC-5, sin horario de verano

const admin = createClient(url, secretKey, { auth: { persistSession: false } });

const revisar = (error, paso) => {
  if (error) {
    console.error(`\n✗ ${paso}: ${error.message}`);
    process.exit(1);
  }
};

/** Un instante UTC a partir de una hora local de Bogotá. */
function instante(diasDesdeHoy, horaLocal, minutoLocal = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + diasDesdeHoy);
  d.setUTCHours(horaLocal + TZ_OFFSET_HORAS, minutoLocal, 0, 0);
  return d;
}

async function limpiar() {
  const { data: existente } = await admin
    .from('businesses')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle();

  if (existente) {
    await admin.from('businesses').delete().eq('id', existente.id);
    console.log('  · negocio anterior eliminado');
  }

  const { data: usuarios } = await admin.auth.admin.listUsers();
  const previo = usuarios?.users.find((u) => u.email === EMAIL);
  if (previo) {
    await admin.auth.admin.deleteUser(previo.id);
    console.log('  · usuario anterior eliminado');
  }
}

async function main() {
  console.log('\nSembrando datos de demostración...\n');

  console.log('Limpiando');
  await limpiar();

  // --- Dueño ---------------------------------------------------------------
  console.log('Creando dueño');
  const { error: eUser } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  revisar(eUser, 'crear usuario');

  // Se usa la sesión real del dueño, no la llave secreta: así el seed pasa por
  // las mismas políticas de RLS que la aplicación.
  const comoDueno = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error: eLogin } = await comoDueno.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  revisar(eLogin, 'iniciar sesión');

  // --- Negocio -------------------------------------------------------------
  console.log('Creando negocio');
  const { data: businessId, error: eBiz } = await comoDueno.rpc('create_business', {
    p_name: 'Barbería El Demo',
    p_slug: SLUG,
    p_category: 'barbershop',
    p_phone: '+573001112233',
  });
  revisar(eBiz, 'create_business');

  const { error: ePub } = await admin
    .from('businesses')
    .update({
      is_published: true,
      status: 'active',
      address: 'Calle 85 #12-34',
      city: 'Bogotá',
      latitude: 4.6717,
      longitude: -74.0536,
      brand_color: '#1f2937',
    })
    .eq('id', businessId);
  revisar(ePub, 'publicar negocio');

  const { data: servicios } = await comoDueno
    .from('services')
    .select('id, name, duration_minutes, price_cop, buffer_before_minutes, buffer_after_minutes')
    .eq('business_id', businessId)
    .order('display_order');

  // --- Trabajadores --------------------------------------------------------
  console.log('Creando trabajadores');
  const { data: trabajadores, error: eStaff } = await comoDueno
    .from('staff')
    .insert([
      { business_id: businessId, name: 'Andrés Gómez', display_order: 1, commission_pct: 50 },
      { business_id: businessId, name: 'Julián Ríos', display_order: 2, commission_pct: 45 },
      { business_id: businessId, name: 'Camilo Vega', display_order: 3, commission_pct: 40 },
    ])
    .select('id, name');
  revisar(eStaff, 'crear trabajadores');

  // Todos prestan todos los servicios
  const relaciones = trabajadores.flatMap((t) =>
    servicios.map((s) => ({ staff_id: t.id, service_id: s.id, business_id: businessId })),
  );
  revisar((await comoDueno.from('staff_services').insert(relaciones)).error, 'staff_services');

  // --- Horarios ------------------------------------------------------------
  // Lunes a viernes con turno partido; sábado corrido. Domingo cerrado.
  console.log('Creando horarios');
  const horarios = [];
  for (const t of trabajadores) {
    for (let weekday = 1; weekday <= 5; weekday++) {
      horarios.push(
        { business_id: businessId, staff_id: t.id, weekday, starts_at: '09:00', ends_at: '13:00' },
        { business_id: businessId, staff_id: t.id, weekday, starts_at: '14:00', ends_at: '19:00' },
      );
    }
    horarios.push({
      business_id: businessId,
      staff_id: t.id,
      weekday: 6,
      starts_at: '09:00',
      ends_at: '17:00',
    });
  }
  revisar((await comoDueno.from('working_hours').insert(horarios)).error, 'horarios');

  // --- Clientes ------------------------------------------------------------
  console.log('Creando clientes');
  const nombres = [
    'Camila Restrepo', 'Juan Pablo Díaz', 'Mariana Ospina', 'Santiago Moreno',
    'Valentina Cruz', 'Sebastián Lara', 'Daniela Peña', 'Tomás Herrera',
  ];
  const { data: clientes, error: eCli } = await comoDueno
    .from('customers')
    .insert(
      nombres.map((name, i) => ({
        business_id: businessId,
        name,
        phone: `+5730055500${String(i + 10).padStart(2, '0')}`,
        notes: i === 0 ? 'El 3 a los lados, no le gusta la máquina en la nuca' : null,
      })),
    )
    .select('id, name');
  revisar(eCli, 'crear clientes');

  // --- Citas ---------------------------------------------------------------
  // Horas fijas que no se solapan: el constraint de la base rechazaría
  // cualquier traslape para el mismo trabajador.
  console.log('Creando citas');
  const horas = [
    [9, 0],
    [10, 30],
    [14, 0],
    [15, 30],
    [17, 0],
  ];
  const citas = [];
  let n = 0;

  for (let dia = -6; dia <= 7; dia++) {
    const fecha = instante(dia, 12);
    if (fecha.getUTCDay() === 0) continue; // domingo cerrado

    for (const t of trabajadores) {
      for (const [h, m] of horas) {
        n++;
        if (n % 3 === 0) continue; // dejar huecos libres en la agenda

        const servicio = servicios[n % servicios.length];
        const inicio = instante(dia, h, m);
        const fin = new Date(inicio.getTime() + servicio.duration_minutes * 60000);
        const pasada = inicio.getTime() < Date.now();

        citas.push({
          business_id: businessId,
          customer_id: clientes[n % clientes.length].id,
          staff_id: t.id,
          service_id: servicio.id,
          start_at: inicio.toISOString(),
          end_at: fin.toISOString(),
          price_cop: servicio.price_cop,
          duration_minutes: servicio.duration_minutes,
          buffer_before_minutes: servicio.buffer_before_minutes,
          buffer_after_minutes: servicio.buffer_after_minutes,
          status: pasada ? (n % 11 === 0 ? 'no_show' : 'completed') : 'confirmed',
          source: n % 5 === 0 ? 'manual' : 'online',
          completed_at: pasada && n % 11 !== 0 ? inicio.toISOString() : null,
        });
      }
    }
  }

  const { data: citasCreadas, error: eCitas } = await comoDueno
    .from('appointments')
    .insert(citas)
    .select('id, status, price_cop, staff_id, start_at');
  revisar(eCitas, 'crear citas');

  // --- Contabilidad --------------------------------------------------------
  console.log('Creando movimientos contables');
  const { data: catServicios } = await comoDueno
    .from('ledger_categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'Servicios')
    .single();

  const { data: catInsumos } = await comoDueno
    .from('ledger_categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'Insumos')
    .single();

  // Cada cita cumplida entra como ingreso, tal como lo hará la aplicación.
  const ingresos = citasCreadas
    .filter((c) => c.status === 'completed')
    .map((c, i) => ({
      business_id: businessId,
      direction: 'income',
      amount_cop: c.price_cop,
      occurred_on: c.start_at.slice(0, 10),
      category_id: catServicios.id,
      payment_method: i % 3 === 0 ? 'nequi' : i % 4 === 0 ? 'card' : 'cash',
      appointment_id: c.id,
      staff_id: c.staff_id,
    }));

  const egresos = [-5, -3, -1].map((dia) => ({
    business_id: businessId,
    direction: 'expense',
    amount_cop: 85000,
    occurred_on: instante(dia, 12).toISOString().slice(0, 10),
    category_id: catInsumos.id,
    payment_method: 'cash',
    description: 'Compra de insumos',
  }));

  revisar(
    (await comoDueno.from('ledger_entries').insert([...ingresos, ...egresos])).error,
    'contabilidad',
  );

  // --- Resumen -------------------------------------------------------------
  console.log('\n✓ Listo\n');
  console.log(`  Negocio      Barbería El Demo`);
  console.log(`  Página       /${SLUG}`);
  console.log(`  Entrar con   ${EMAIL}  /  ${PASSWORD}`);
  console.log(`  Trabajadores ${trabajadores.length}`);
  console.log(`  Servicios    ${servicios.length}`);
  console.log(`  Clientes     ${clientes.length}`);
  console.log(`  Citas        ${citasCreadas.length}`);
  console.log(`  Ingresos     ${ingresos.length}`);
  console.log('');
}

main().catch((e) => {
  console.error('\n✗ Falló el seed:', e.message);
  process.exit(1);
});
