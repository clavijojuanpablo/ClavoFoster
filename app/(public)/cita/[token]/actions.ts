'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { cancelarPorToken } from '@/lib/booking/gestion';

/**
 * Cancelar la cita desde el link que le llegó al cliente (F6).
 *
 * Sin sesión. El token es el único permiso, y apunta a una sola cita.
 */

const esquema = z.object({ token: z.string().min(16).max(200) });

export type RespuestaCancelacion = { ok: true } | { ok: false; error: string };

export async function cancelarCita(peticion: { token: string }): Promise<RespuestaCancelacion> {
  const datos = esquema.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No encontramos esa cita' };

  const resultado = await cancelarPorToken(datos.data.token);

  if (resultado.ok) revalidatePath(`/cita/${datos.data.token}`);

  return resultado;
}
