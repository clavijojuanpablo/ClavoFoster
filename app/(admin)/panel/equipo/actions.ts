'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { BUCKET_FOTOS } from '@/lib/fotos';
import { obtenerCitasProximas } from '@/lib/panel/equipo';
import { citasFueraDelHorario } from '@/lib/scheduling/horario';
import { createClient } from '@/lib/supabase/server';
import { requireDueno } from '@/lib/tenant';
import { esquemaHorario } from '@/lib/validation/horario';
import { erroresPorCampo } from '@/lib/validation/negocio';
import { esquemaTrabajador } from '@/lib/validation/trabajador';

export type EstadoTrabajador = {
  error: string | null;
  campos: Record<string, string>;
  /**
   * Id de la persona si ya quedó creada pero algo falló después (los
   * servicios). El formulario lo usa para que reintentar edite en vez de crear
   * a la misma persona dos veces.
   */
  idCreado?: string;
};

const NO_EXISTE = 'No encontramos a esa persona. Vuelve a Equipo y ábrela de nuevo';

/**
 * Crea o edita a una persona del equipo y los servicios que presta (D1 y D2).
 *
 * El negocio sale de requireDueno(), nunca del formulario. El id de la
 * persona, los servicios y la foto sí vienen del formulario: todos se cruzan
 * con el negocio de la sesión, y la base lo vuelve a exigir con RLS, CHECK y
 * llaves compuestas.
 */
export async function guardarTrabajador(_anterior: EstadoTrabajador, formData: FormData): Promise<EstadoTrabajador> {
  const { negocio } = await requireDueno();

  const datos = esquemaTrabajador(negocio.id).safeParse({
    id: formData.get('id') ?? '',
    nombre: formData.get('nombre') ?? '',
    celular: formData.get('celular') ?? '',
    perfil: formData.get('perfil') ?? '',
    foto: formData.get('foto') ?? '',
    servicios: formData.getAll('servicios'),
  });

  if (!datos.success) {
    const campos = erroresPorCampo(datos.error);
    if (campos.id) return { error: NO_EXISTE, campos: {} };
    if (campos.servicios) return { error: 'No pudimos leer los servicios. Recarga la página', campos: {} };
    return { error: null, campos };
  }

  const d = datos.data;
  const supabase = await createClient();
  const fila = { name: d.nombre, phone: d.celular, bio: d.perfil, photo_url: d.foto };

  let staffId: string;
  let fotoAnterior: string | null = null;

  if (d.id) {
    const { data: actual } = await supabase
      .from('staff')
      .select('photo_url')
      .eq('id', d.id)
      .eq('business_id', negocio.id)
      .maybeSingle();
    if (!actual) return { error: NO_EXISTE, campos: {} };
    fotoAnterior = actual.photo_url;

    const { error } = await supabase.from('staff').update(fila).eq('id', d.id).eq('business_id', negocio.id);
    if (error) return errorAlGuardar(negocio.id, error);
    staffId = d.id;
  } else {
    // Al final de la lista, como los servicios.
    const { data: ultimo, error: eOrden } = await supabase
      .from('staff')
      .select('display_order')
      .eq('business_id', negocio.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eOrden) return errorAlGuardar(negocio.id, eOrden);

    const { data: creado, error } = await supabase
      .from('staff')
      .insert({ ...fila, business_id: negocio.id, display_order: (ultimo?.display_order ?? 0) + 1 })
      .select('id')
      .single();
    if (error) return errorAlGuardar(negocio.id, error);
    staffId = creado.id;
  }

  const errorServicios = await sincronizarServicios(supabase, negocio.id, staffId, d.servicios);
  if (errorServicios) {
    console.error('[equipo] no se guardaron los servicios:', { businessId: negocio.id, message: errorServicios });
    return {
      error: 'Guardamos los datos, pero no los servicios que presta. Toca Guardar otra vez',
      campos: {},
      idCreado: staffId,
    };
  }

  // La foto reemplazada se borra solo después de guardar: si se borrara al
  // escoger la nueva y no guardara, la fila apuntaría a un archivo que no existe.
  if (fotoAnterior && fotoAnterior !== d.foto) {
    const { error } = await supabase.storage.from(BUCKET_FOTOS).remove([fotoAnterior]);
    if (error) console.error('[equipo] foto anterior sin borrar:', { businessId: negocio.id, message: error.message });
  }

  revalidatePath('/panel', 'layout');
  revalidatePath(`/${negocio.slug}`);
  redirect('/panel/equipo');
}

/**
 * Deja en staff_services exactamente los servicios marcados, entre los activos.
 *
 * Los enlaces con servicios desactivados no se tocan: el formulario no los
 * muestra, y reactivar un servicio no debería obligar a volver a asignarlo.
 * Los que ya existían se conservan tal cual (con sus precios y duraciones
 * propios, cuando existan).
 */
async function sincronizarServicios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  staffId: string,
  marcados: string[],
): Promise<string | null> {
  const { data: activos, error: eActivos } = await supabase
    .from('services')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true);
  if (eActivos) return eActivos.message;

  const idsActivos = new Set(activos.map((s) => s.id));
  const aQuitar = [...idsActivos].filter((id) => !marcados.includes(id));
  const aDejar = marcados.filter((id) => idsActivos.has(id));

  if (aQuitar.length) {
    const { error } = await supabase
      .from('staff_services')
      .delete()
      .eq('staff_id', staffId)
      .in('service_id', aQuitar);
    if (error) return error.message;
  }

  if (aDejar.length) {
    const { error } = await supabase
      .from('staff_services')
      .upsert(
        aDejar.map((serviceId) => ({ staff_id: staffId, service_id: serviceId, business_id: businessId })),
        { onConflict: 'staff_id,service_id', ignoreDuplicates: true },
      );
    if (error) return error.message;
  }

  return null;
}

/**
 * Desactiva o reactiva a una persona del equipo. Nunca la borra (regla 5 de
 * CLAUDE.md): sus citas pasadas sostienen la contabilidad.
 *
 * Desactivada deja de aparecer en la página pública y no recibe reservas. Las
 * citas que ya tenía se mantienen: cancelarle citas a alguien automáticamente
 * es justo lo que no se debe hacer (docs/13-contratos-de-api.md).
 */
export async function cambiarEstadoTrabajador(
  _anterior: EstadoTrabajador,
  formData: FormData,
): Promise<EstadoTrabajador> {
  const { negocio } = await requireDueno();

  const datos = z
    .object({ id: z.uuid(), activo: z.enum(['true', 'false']).transform((v) => v === 'true') })
    .safeParse({ id: formData.get('id'), activo: formData.get('activo') });

  if (!datos.success) return { error: NO_EXISTE, campos: {} };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff')
    .update({ is_active: datos.data.activo })
    .eq('id', datos.data.id)
    .eq('business_id', negocio.id)
    .select('id');

  if (error) return errorAlGuardar(negocio.id, error);
  if (!data.length) return { error: NO_EXISTE, campos: {} };

  revalidatePath('/panel', 'layout');
  revalidatePath(`/${negocio.slug}`);
  redirect('/panel/equipo');
}

function errorAlGuardar(businessId: string, error: { code: string; message: string }): EstadoTrabajador {
  console.error('[equipo] no se pudo guardar:', { businessId, code: error.code, message: error.message });
  return { error: 'No pudimos guardar los cambios. Intenta de nuevo', campos: {} };
}

export type EstadoHorario = {
  error: string | null;
  campos: Record<string, string>;
  guardadoEn: number | null;
  /** Citas ya agendadas que quedaron por fuera del horario nuevo. */
  citasFuera: { id: string; inicio: string; cliente: string; servicio: string }[];
};

/**
 * Reemplaza el horario semanal de una persona (D3).
 *
 * El reemplazo es todo o nada, en guardar_horario() dentro de la base. Las
 * citas que ya estaban agendadas no se mueven ni se cancelan: se devuelven las
 * que quedaron por fuera del horario nuevo para que el dueño decida qué hacer
 * con cada una (docs/13-contratos-de-api.md).
 */
export async function guardarHorario(_anterior: EstadoHorario, formData: FormData): Promise<EstadoHorario> {
  const { negocio } = await requireDueno();
  const vacio: EstadoHorario = { error: null, campos: {}, guardadoEn: null, citasFuera: [] };

  const datos = esquemaHorario.safeParse({
    staffId: formData.get('staffId') ?? '',
    turnos: formData.get('turnos') ?? '',
  });

  if (!datos.success) {
    const campos = erroresPorCampo(datos.error);
    if (campos.staffId) return { ...vacio, error: NO_EXISTE };
    if (campos.turnos) return { ...vacio, error: campos.turnos };
    return { ...vacio, campos };
  }

  const { staffId, turnos } = datos.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('guardar_horario', { p_staff_id: staffId, p_turnos: turnos });

  if (error) {
    if (error.hint === 'sin_permiso') return { ...vacio, error: NO_EXISTE };
    if (error.hint === 'turnos_solapados') return { ...vacio, error: 'Dos turnos del mismo día se cruzan. Revísalos' };
    console.error('[equipo] no se pudo guardar el horario:', { businessId: negocio.id, code: error.code, message: error.message });
    return { ...vacio, error: 'No pudimos guardar el horario. Intenta de nuevo' };
  }

  revalidatePath('/panel', 'layout');

  // El horario ya quedó guardado: si revisar las citas falla, se avisa sin
  // decir que no se guardó.
  try {
    const citas = await obtenerCitasProximas(negocio.id, staffId, new Date());
    const fuera = citasFueraDelHorario(citas, turnos, negocio.timezone);
    return {
      ...vacio,
      guardadoEn: Date.now(),
      citasFuera: fuera.map(({ id, inicio, cliente, servicio }) => ({ id, inicio, cliente, servicio })),
    };
  } catch {
    return {
      ...vacio,
      guardadoEn: Date.now(),
      error: 'Guardamos el horario, pero no pudimos revisar si alguna cita quedó por fuera',
    };
  }
}
