import 'server-only';

import { colorDeServicio } from '@/lib/colores';
import { resumirCaja } from '@/lib/panel/caja';
import { fechaLocal, rangoDelDia } from '@/lib/fechas';
import { createClient } from '@/lib/supabase/server';
import type { ContextoNegocio } from '@/lib/tenant';
import type { Enums } from '@/lib/types/database';

/**
 * Lo que muestra el Inicio del panel. Todo pasa por RLS con la sesión del
 * usuario: no se filtra por business_id porque la base ya solo devuelve lo de
 * su negocio.
 */

export type CitaDelDia = {
  id: string;
  inicio: string;
  fin: string;
  estado: Enums<'appointment_status'>;
  cliente: string;
  servicio: string;
  trabajador: string;
  color: string;
};

export type PasoPendiente = {
  clave: 'link' | 'servicios' | 'ubicacion' | 'equipo' | 'horarios' | 'publicar';
  etiqueta: string;
  hecho: boolean;
  /** null mientras la pantalla para resolverlo no exista. */
  href: string | null;
};

export type ResumenDelDia = {
  fecha: string;
  citas: CitaDelDia[];
  /** null para el trabajador: la caja es solo del dueño. */
  caja: ReturnType<typeof resumirCaja> | null;
  /** null para el trabajador. */
  pasos: PasoPendiente[] | null;
};

export async function obtenerResumenDelDia(
  { negocio, rol, staffId }: ContextoNegocio,
  ahora: Date,
): Promise<ResumenDelDia> {
  const supabase = await createClient();
  const fecha = fechaLocal(negocio.timezone, ahora);
  const { desde, hasta } = rangoDelDia(negocio.timezone, fecha);

  let consultaCitas = supabase
    .from('appointments')
    .select('id, start_at, end_at, status, customers(name), staff(name), services(name, color, display_order)')
    .gte('start_at', desde.toISOString())
    .lt('start_at', hasta.toISOString())
    // 'pending' es la retención de cupo mientras un cliente confirma: todavía
    // no es una cita, no se le muestra al negocio.
    .neq('status', 'pending')
    .order('start_at');

  // El trabajador ve solo su agenda (flujo 5). La política de RLS le deja ver
  // todo el negocio; este filtro es de producto, no de seguridad.
  if (rol === 'staff' && staffId) consultaCitas = consultaCitas.eq('staff_id', staffId);

  const esDueno = rol === 'owner';

  const [citas, movimientos, servicios, trabajadores, horarios] = await Promise.all([
    consultaCitas,
    esDueno
      ? supabase.from('ledger_entries').select('direction, amount_cop, payment_method, reverses_id').eq('occurred_on', fecha)
      : null,
    esDueno ? supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true) : null,
    esDueno ? supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true) : null,
    esDueno ? supabase.from('working_hours').select('id', { count: 'exact', head: true }) : null,
  ]);

  if (citas.error) throw new Error(`No se pudieron leer las citas de hoy: ${citas.error.message}`);

  // La caja no es crítica para el Inicio: si falla, se registra y la tarjeta
  // muestra que no pudo cargar, en vez de tumbar toda la página.
  if (movimientos?.error) {
    console.error('[panel] no se pudo leer la caja:', { businessId: negocio.id, message: movimientos.error.message });
  }

  return {
    fecha,
    citas: (citas.data ?? []).map((c) => ({
      id: c.id,
      inicio: c.start_at,
      fin: c.end_at,
      estado: c.status,
      cliente: c.customers?.name ?? 'Cliente',
      servicio: c.services?.name ?? 'Servicio',
      trabajador: c.staff?.name ?? '',
      color: colorDeServicio(c.services?.color ?? null, c.services?.display_order ?? 0),
    })),
    caja: movimientos && !movimientos.error ? resumirCaja(movimientos.data ?? []) : null,
    pasos: esDueno
      ? [
          { clave: 'link', etiqueta: 'Tipo de negocio y link', hecho: true, href: null },
          { clave: 'servicios', etiqueta: 'Revisa tus servicios', hecho: (servicios?.count ?? 0) > 0, href: '/panel/servicios' },
          { clave: 'ubicacion', etiqueta: 'Marca tu ubicación', hecho: negocio.latitude !== null, href: '/panel/negocio' },
          { clave: 'equipo', etiqueta: 'Agrega a tu equipo', hecho: (trabajadores?.count ?? 0) > 0, href: null },
          { clave: 'horarios', etiqueta: 'Define los horarios', hecho: (horarios?.count ?? 0) > 0, href: null },
          { clave: 'publicar', etiqueta: 'Publica tu página', hecho: negocio.is_published, href: '/panel/negocio' },
        ]
      : null,
  };
}
