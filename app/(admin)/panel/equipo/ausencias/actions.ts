'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { citasQueSeCruzan, type CitaAfectada } from '@/lib/panel/bloqueos';
import { createClient } from '@/lib/supabase/server';
import { requireDueno } from '@/lib/tenant';
import { esquemaBloqueo, rangoDelBloqueo } from '@/lib/validation/bloqueo';
import { erroresPorCampo } from '@/lib/validation/negocio';

export type EstadoBloqueo = {
  error: string | null;
  campos: Record<string, string>;
  /**
   * Hay citas en el rango y falta confirmar. `firma` identifica ese rango
   * exacto: si el dueño cambia quién o cuándo, la confirmación ya no vale.
   */
  porConfirmar: { firma: string; citas: CitaAfectada[] } | null;
};

const VACIO: EstadoBloqueo = { error: null, campos: {}, porConfirmar: null };

/**
 * Crea un bloqueo o ausencia (D4).
 *
 * Si hay citas agendadas en ese rango, la primera vez no guarda: devuelve las
 * citas para que el dueño las vea y confirme. Las citas nunca se cancelan
 * solas (docs/13-contratos-de-api.md). La persona sale del formulario y se
 * cruza con el negocio de la sesión; la base lo vuelve a exigir con una llave
 * compuesta.
 */
export async function crearBloqueo(_anterior: EstadoBloqueo, formData: FormData): Promise<EstadoBloqueo> {
  const { negocio } = await requireDueno();

  const datos = esquemaBloqueo.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { ...VACIO, campos: erroresPorCampo(datos.error) };

  const d = datos.data;
  const { inicio, fin } = rangoDelBloqueo(d, negocio.timezone);

  if (fin <= new Date()) {
    return { ...VACIO, campos: { [d.tipo === 'dias' ? 'fechaHasta' : 'hasta']: 'Ese rango ya pasó' } };
  }

  const supabase = await createClient();

  if (d.quien) {
    const { data: persona } = await supabase
      .from('staff')
      .select('id')
      .eq('id', d.quien)
      .eq('business_id', negocio.id)
      .maybeSingle();
    if (!persona) return { ...VACIO, campos: { quien: 'Escoge a alguien de tu equipo' } };
  }

  const firma = `${d.quien ?? 'local'}|${inicio.toISOString()}|${fin.toISOString()}`;

  if (formData.get('confirmado') !== firma) {
    let citas: CitaAfectada[];
    try {
      citas = await citasQueSeCruzan(negocio.id, d.quien, inicio, fin);
    } catch {
      return { ...VACIO, error: 'No pudimos revisar si hay citas en ese rango. Intenta de nuevo' };
    }
    if (citas.length) return { ...VACIO, porConfirmar: { firma, citas } };
  }

  const { error } = await supabase.from('time_off').insert({
    business_id: negocio.id,
    staff_id: d.quien,
    starts_at: inicio.toISOString(),
    ends_at: fin.toISOString(),
    reason: d.motivo,
  });

  if (error) {
    console.error('[bloqueos] no se pudo guardar:', { businessId: negocio.id, code: error.code, message: error.message });
    return { ...VACIO, error: 'No pudimos guardar el bloqueo. Intenta de nuevo' };
  }

  revalidatePath('/panel', 'layout');
  redirect('/panel/equipo/ausencias');
}

/**
 * Quita un bloqueo. Se borra de verdad: no es información con historia
 * contable, y dejarlo marcado solo ensuciaría el cálculo de cupos.
 */
export async function quitarBloqueo(formData: FormData): Promise<void> {
  const { negocio } = await requireDueno();
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from('time_off').delete().eq('id', id.data).eq('business_id', negocio.id);

  if (error) {
    console.error('[bloqueos] no se pudo quitar:', { businessId: negocio.id, code: error.code, message: error.message });
    throw new Error('No pudimos quitar el bloqueo');
  }

  revalidatePath('/panel', 'layout');
}
