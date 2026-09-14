'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { requireDueno } from '@/lib/tenant';
import { erroresPorCampo } from '@/lib/validation/negocio';
import { esquemaServicio } from '@/lib/validation/servicio';

export type EstadoServicio = {
  error: string | null;
  campos: Record<string, string>;
};

const NO_EXISTE = 'No encontramos ese servicio. Vuelve a la lista y ábrelo de nuevo';

/**
 * Crea o edita un servicio del negocio de la sesión (tarea C1).
 *
 * El negocio sale de requireDueno(), nunca del formulario. Al editar, el id
 * del servicio sí viene del formulario: la consulta lo cruza con el negocio de
 * la sesión y RLS vuelve a exigir que sea del dueño.
 *
 * Cambiar el precio o la duración no toca las citas ya agendadas: cada cita
 * guarda los suyos (regla 4 de CLAUDE.md).
 */
export async function guardarServicio(_anterior: EstadoServicio, formData: FormData): Promise<EstadoServicio> {
  const { negocio } = await requireDueno();

  const datos = esquemaServicio.safeParse({
    id: formData.get('id') ?? '',
    nombre: formData.get('nombre') ?? '',
    descripcion: formData.get('descripcion') ?? '',
    duracion: formData.get('duracion') ?? '',
    precio: formData.get('precio') ?? '',
    color: formData.get('color') ?? '',
  });

  if (!datos.success) {
    const campos = erroresPorCampo(datos.error);
    if (campos.id) return { error: NO_EXISTE, campos: {} };
    return { error: null, campos };
  }

  const d = datos.data;
  const supabase = await createClient();
  const fila = {
    name: d.nombre,
    description: d.descripcion,
    duration_minutes: d.duracion,
    price_cop: d.precio,
    color: d.color,
  };

  if (d.id) {
    const { data, error } = await supabase
      .from('services')
      .update(fila)
      .eq('id', d.id)
      .eq('business_id', negocio.id)
      .select('id');

    if (error) return errorAlGuardar(negocio.id, error);
    if (!data.length) return { error: NO_EXISTE, campos: {} };
  } else {
    // Al final de la lista. Reordenar llega con la tarea C3.
    const { data: ultimo, error: eOrden } = await supabase
      .from('services')
      .select('display_order')
      .eq('business_id', negocio.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eOrden) return errorAlGuardar(negocio.id, eOrden);

    const { error } = await supabase
      .from('services')
      .insert({ ...fila, business_id: negocio.id, display_order: (ultimo?.display_order ?? 0) + 1 });

    if (error) return errorAlGuardar(negocio.id, error);
  }

  revalidatePath('/panel', 'layout');
  revalidatePath(`/${negocio.slug}`);
  redirect('/panel/servicios');
}

/**
 * Desactiva o reactiva un servicio. Nunca lo borra (regla 5 de CLAUDE.md): un
 * servicio con citas pasadas sostiene la contabilidad del negocio.
 *
 * Desactivado deja de aparecer en la página pública y no se puede reservar.
 * Las citas que ya estaban agendadas con él se mantienen.
 */
export async function cambiarEstadoServicio(_anterior: EstadoServicio, formData: FormData): Promise<EstadoServicio> {
  const { negocio } = await requireDueno();

  const datos = z
    .object({ id: z.uuid(), activo: z.enum(['true', 'false']).transform((v) => v === 'true') })
    .safeParse({ id: formData.get('id'), activo: formData.get('activo') });

  if (!datos.success) return { error: NO_EXISTE, campos: {} };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .update({ is_active: datos.data.activo })
    .eq('id', datos.data.id)
    .eq('business_id', negocio.id)
    .select('id');

  if (error) return errorAlGuardar(negocio.id, error);
  if (!data.length) return { error: NO_EXISTE, campos: {} };

  revalidatePath('/panel', 'layout');
  revalidatePath(`/${negocio.slug}`);
  redirect('/panel/servicios');
}

function errorAlGuardar(businessId: string, error: { code: string; message: string }): EstadoServicio {
  console.error('[servicios] no se pudo guardar:', { businessId, code: error.code, message: error.message });
  return { error: 'No pudimos guardar el servicio. Intenta de nuevo', campos: {} };
}
