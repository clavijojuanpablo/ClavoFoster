'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { requireNegocio } from '@/lib/tenant';

/**
 * Lo que el negocio hace con una cita desde la agenda (G5).
 *
 * Con sesión: el negocio sale de la sesión y RLS vuelve a exigirlo en la
 * consulta, así que un id de cita de otro negocio no actualiza nada.
 *
 * Marcar **cumplida** es lo que disparará el asiento de ingreso de la épica H.
 * Por eso el `update` exige que la cita todavía no esté cumplida: marcar dos
 * veces no puede terminar en dos ingresos.
 */

const esquema = z.object({
  citaId: z.uuid(),
  estado: z.enum(['completed', 'no_show', 'confirmed', 'cancelled']),
});

export type RespuestaEstado = { ok: true } | { ok: false; error: string };

export async function cambiarEstadoDeCita(peticion: {
  citaId: string;
  estado: 'completed' | 'no_show' | 'confirmed' | 'cancelled';
}): Promise<RespuestaEstado> {
  const datos = esquema.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender el cambio' };

  const { negocio } = await requireNegocio();
  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { citaId, estado } = datos.data;

  const cambios = {
    status: estado,
    // Cada estado limpia las marcas de los otros: una cita que vuelve a
    // confirmarse no puede seguir teniendo fecha de cancelación.
    completed_at: estado === 'completed' ? ahora : null,
    cancelled_at: estado === 'cancelled' ? ahora : null,
    cancelled_by: estado === 'cancelled' ? 'business' : null,
  };

  const { data, error } = await supabase
    .from('appointments')
    .update(cambios)
    .eq('id', citaId)
    .eq('business_id', negocio.id)
    // Idempotencia: si ya está en ese estado, no se vuelve a escribir.
    .neq('status', estado)
    .select('id')
    .maybeSingle();

  if (error) {
    // Devolver una cita cancelada a confirmada puede chocar con otra que ya
    // tomó el cupo. Es un resultado normal del negocio, no una falla.
    if (error.code === '23P01') {
      return { ok: false, error: 'Esa hora ya está ocupada por otra cita' };
    }

    console.error('[agenda] no se pudo cambiar el estado:', {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'No pudimos guardar el cambio. Intenta de nuevo.' };
  }

  // `data` nulo significa que ya estaba así. Para quien lo pidió, está hecho.
  if (data) revalidatePath('/panel/agenda');

  return { ok: true };
}
