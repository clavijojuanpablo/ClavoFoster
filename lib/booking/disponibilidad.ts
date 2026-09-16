import 'server-only';

import { fechaLocal, fechasEntre, rangoDelDia, sumarDias } from '@/lib/fechas';
import { calcularCuposEnRango } from '@/lib/scheduling/availability';
import type { Intervalo, TurnoSemanal } from '@/lib/scheduling/types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NegocioPublico } from '@/lib/tenant';

import type { Cupo, DiaDisponible, ServicioReservable, VentanaDeCupos } from './tipos';

export type { Cupo, DiaDisponible, ServicioReservable, TrabajadorDelServicio, VentanaDeCupos } from './tipos';

/**
 * Disponibilidad pública: acá el motor de cupos se conecta con la base.
 *
 * Es la operación más usada del producto (docs/13-contratos-de-api.md) y la
 * única del flujo público que necesita leer horarios, bloqueos y citas —datos
 * que RLS le esconde al anónimo, y con razón—. Por eso usa el cliente
 * privilegiado: el cliente final no tiene sesión que RLS pueda evaluar.
 *
 * Las dos barreras que quedan sin RLS, y que este módulo respeta siempre:
 *
 *   1. El `business_id` sale del negocio ya verificado por slug, nunca de algo
 *      que mande el navegador (regla 2 de CLAUDE.md). Por eso la función
 *      recibe el `NegocioPublico` completo y no un id suelto.
 *   2. Hacia afuera solo salen HORAS LIBRES. Nunca quién tiene cita, ni a qué
 *      hora está ocupado alguien, ni cuántas citas lleva el día.
 *
 * Los datos se traen UNA vez para todo el rango y el cálculo por día es
 * memoria pura: pedir un mes no puede volverse treinta consultas.
 */

/** Tope por consulta. Pedir un año entero es lo que vuelve esto un cuello de botella. */
export const DIAS_MAX_POR_CONSULTA = 31;

/**
 * Lo reservable del negocio: los servicios activos, cada uno con la gente que
 * lo presta.
 *
 * Son dos consultas para todo el catálogo, no dos por servicio. Se trae entero
 * porque el cliente cambia de servicio y de persona mientras escoge, y cada
 * cambio no puede costar una ida a la base: lo único que se recalcula sobre la
 * marcha son los cupos.
 *
 * Un servicio que no presta nadie sale con `trabajadores: []`. Existe, pero no
 * se puede reservar todavía, y eso se le explica al cliente.
 */
export async function obtenerCatalogoReservable(negocio: NegocioPublico): Promise<ServicioReservable[]> {
  const supabase = createAdminClient();

  const [{ data: servicios, error: errorServicios }, { data: presta, error: errorPresta }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_minutes, price_cop, buffer_before_minutes, buffer_after_minutes, display_order')
      .eq('business_id', negocio.id)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('staff_services')
      .select('service_id, duration_override_minutes, price_override_cop, staff(id, name, photo_url, is_active, display_order)')
      .eq('business_id', negocio.id),
  ]);

  if (errorServicios || errorPresta) {
    console.error('[disponibilidad] no se pudo leer el catálogo:', {
      negocio: negocio.slug,
      code: errorServicios?.code ?? errorPresta?.code,
      message: errorServicios?.message ?? errorPresta?.message,
    });
    throw new Error('No pudimos cargar los servicios');
  }

  const habilitados = (presta ?? []).flatMap((p) => (p.staff?.is_active ? [{ ...p, staff: p.staff }] : []));

  return (servicios ?? []).map((servicio) => ({
    id: servicio.id,
    nombre: servicio.name,
    descripcion: servicio.description,
    duracionMinutos: servicio.duration_minutes,
    precioCop: servicio.price_cop,
    bufferAntesMinutos: servicio.buffer_before_minutes,
    bufferDespuesMinutos: servicio.buffer_after_minutes,
    trabajadores: habilitados
      .filter((p) => p.service_id === servicio.id)
      .sort((a, b) => a.staff.display_order - b.staff.display_order || a.staff.name.localeCompare(b.staff.name, 'es'))
      .map((p) => ({
        id: p.staff.id,
        nombre: p.staff.name,
        fotoUrl: p.staff.photo_url,
        // El maestro cobra más y demora distinto que el aprendiz: si esa
        // persona tiene su propio número, manda el suyo.
        duracionMinutos: p.duration_override_minutes ?? servicio.duration_minutes,
        precioCop: p.price_override_cop ?? servicio.price_cop,
      })),
  }));
}

/**
 * Cupos libres del servicio entre dos fechas locales, ambas incluidas.
 *
 * Con `staffId` en null se combinan los cupos de todos los que prestan el
 * servicio; si dos coinciden en la misma hora se devuelve uno solo, el de
 * quien lleve menos citas ese día, para repartir el trabajo.
 */
export async function obtenerDisponibilidad(input: {
  negocio: NegocioPublico;
  servicio: ServicioReservable;
  /** null = cualquiera disponible. */
  staffId: string | null;
  desde: string;
  hasta: string;
  ahora: Date;
}): Promise<DiaDisponible[]> {
  const { negocio, servicio, staffId, desde, hasta, ahora } = input;

  const fechas = fechasEntre(desde, hasta);
  if (fechas.length === 0) return [];
  if (fechas.length > DIAS_MAX_POR_CONSULTA) {
    throw new Error(`El rango no puede pasar de ${DIAS_MAX_POR_CONSULTA} días`);
  }

  const candidatos = staffId ? servicio.trabajadores.filter((t) => t.id === staffId) : servicio.trabajadores;
  // El staffId llegó del navegador: si no presta este servicio, no hay cupos.
  // No es un error que valga la pena explicar; son días vacíos.
  if (candidatos.length === 0) return fechas.map((fecha) => ({ fecha, cupos: [] }));

  const ids = candidatos.map((t) => t.id);
  const ventanaDesde = rangoDelDia(negocio.timezone, fechas[0]).desde;
  const ventanaHasta = rangoDelDia(negocio.timezone, fechas[fechas.length - 1]).hasta;

  const supabase = createAdminClient();

  const [
    { data: horarios, error: errorHorarios },
    { data: bloqueos, error: errorBloqueos },
    { data: citas, error: errorCitas },
  ] = await Promise.all([
    supabase
      .from('working_hours')
      .select('staff_id, weekday, starts_at, ends_at')
      .eq('business_id', negocio.id)
      .in('staff_id', ids),
    // staff_id nulo es el local entero: le cae a todos.
    supabase
      .from('time_off')
      .select('staff_id, starts_at, ends_at')
      .eq('business_id', negocio.id)
      .lt('starts_at', ventanaHasta.toISOString())
      .gt('ends_at', ventanaDesde.toISOString()),
    // Las canceladas y las que no asistieron no ocupan: su cupo vuelve a estar libre.
    supabase
      .from('appointments')
      .select('staff_id, start_at, end_at, buffer_before_minutes, buffer_after_minutes')
      .eq('business_id', negocio.id)
      .in('staff_id', ids)
      .in('status', ['pending', 'confirmed'])
      .lt('start_at', ventanaHasta.toISOString())
      .gt('end_at', ventanaDesde.toISOString()),
  ]);

  if (errorHorarios || errorBloqueos || errorCitas) {
    console.error('[disponibilidad] no se pudo calcular:', {
      negocio: negocio.slug,
      code: errorHorarios?.code ?? errorBloqueos?.code ?? errorCitas?.code,
      message: errorHorarios?.message ?? errorBloqueos?.message ?? errorCitas?.message,
    });
    throw new Error('No pudimos cargar los horarios disponibles');
  }

  const reglas = {
    timezone: negocio.timezone,
    granularidadMinutos: negocio.slot_granularity_minutes,
    anticipacionMinimaMinutos: negocio.min_notice_minutes,
    ventanaMaximaDias: negocio.max_advance_days,
    alinearAlReloj: negocio.align_to_clock,
  };

  const cierresDelLocal: Intervalo[] = (bloqueos ?? []).filter((b) => b.staff_id === null).map(aIntervalo);

  // Los cupos de todos, agrupados por día y por instante. La carga del día se
  // cuenta de paso, para repartir el trabajo cuando el cliente no escoge.
  const porDia = new Map<string, Map<number, Cupo[]>>(fechas.map((f) => [f, new Map()]));
  const carga = new Map<string, number>();

  for (const trabajador of candidatos) {
    const turnos: TurnoSemanal[] = (horarios ?? [])
      .filter((h) => h.staff_id === trabajador.id)
      .map((h) => ({ weekday: h.weekday, desde: h.starts_at, hasta: h.ends_at }));

    const suyas = (citas ?? []).filter((c) => c.staff_id === trabajador.id);

    const ocupado: Intervalo[] = [
      ...cierresDelLocal,
      ...(bloqueos ?? []).filter((b) => b.staff_id === trabajador.id).map(aIntervalo),
      // La cita ocupa su rango con buffers, los mismos números que guarda la
      // base en `blocked_range`.
      ...suyas.map((c) => ({
        inicio: new Date(new Date(c.start_at).getTime() - c.buffer_before_minutes * 60_000),
        fin: new Date(new Date(c.end_at).getTime() + c.buffer_after_minutes * 60_000),
      })),
    ];

    for (const cita of suyas) {
      const clave = `${trabajador.id}|${fechaLocalDeIso(negocio.timezone, cita.start_at)}`;
      carga.set(clave, (carga.get(clave) ?? 0) + 1);
    }

    const dias = calcularCuposEnRango({
      fechas,
      turnos,
      ocupado,
      servicio: {
        duracionMinutos: trabajador.duracionMinutos,
        bufferAntesMinutos: servicio.bufferAntesMinutos,
        bufferDespuesMinutos: servicio.bufferDespuesMinutos,
      },
      reglas,
      ahora,
    });

    for (const dia of dias) {
      const instantes = porDia.get(dia.fecha)!;
      for (const cupo of dia.cupos) {
        const lista = instantes.get(cupo.getTime()) ?? [];
        lista.push({ inicio: cupo.toISOString(), staffId: trabajador.id, staffNombre: trabajador.nombre });
        instantes.set(cupo.getTime(), lista);
      }
    }
  }

  const orden = new Map(candidatos.map((t, i) => [t.id, i]));

  return fechas.map((fecha) => {
    const instantes = [...porDia.get(fecha)!.entries()].sort(([a], [b]) => a - b);

    return {
      fecha,
      cupos: instantes.map(([, disponibles]) =>
        // El de menos carga ese día; a igual carga, el orden del equipo, que no
        // depende de cómo haya devuelto las filas la base.
        disponibles.reduce((mejor, otro) => {
          const cargaMejor = carga.get(`${mejor.staffId}|${fecha}`) ?? 0;
          const cargaOtro = carga.get(`${otro.staffId}|${fecha}`) ?? 0;
          if (cargaOtro !== cargaMejor) return cargaOtro < cargaMejor ? otro : mejor;
          return orden.get(otro.staffId)! < orden.get(mejor.staffId)! ? otro : mejor;
        }),
      ),
    };
  });
}

/** Cuántos días trae cada tanda de la tira de días. Menos de 31, el tope de la consulta. */
export const DIAS_POR_VENTANA = 14;

/**
 * Una tanda de días con sus cupos, recortada a la ventana de reserva del
 * negocio.
 *
 * El motor ya descarta los cupos que se pasen de `max_advance_days`; acá se
 * recorta además la tira de días, para no pintar quince días vacíos cuando solo
 * quedan tres.
 */
export async function obtenerVentanaDeCupos(input: {
  negocio: NegocioPublico;
  servicio: ServicioReservable;
  staffId: string | null;
  desde: string;
  ahora: Date;
}): Promise<VentanaDeCupos> {
  const { negocio, servicio, staffId, desde, ahora } = input;

  const ultimoDia = sumarDias(fechaLocal(negocio.timezone, ahora), negocio.max_advance_days);
  const tope = sumarDias(desde, DIAS_POR_VENTANA - 1);
  const hasta = tope < ultimoDia ? tope : ultimoDia;

  if (hasta < desde) return { dias: [], siguienteDesde: null };

  const dias = await obtenerDisponibilidad({ negocio, servicio, staffId, desde, hasta, ahora });
  const siguiente = sumarDias(hasta, 1);

  return { dias, siguienteDesde: siguiente <= ultimoDia ? siguiente : null };
}

function aIntervalo(rango: { starts_at: string; ends_at: string }): Intervalo {
  return { inicio: new Date(rango.starts_at), fin: new Date(rango.ends_at) };
}

function fechaLocalDeIso(timezone: string, iso: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
