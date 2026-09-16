'use server';

import { obtenerCatalogoReservable, obtenerVentanaDeCupos, type VentanaDeCupos } from '@/lib/booking/disponibilidad';
import { getNegocioPublico } from '@/lib/tenant';
import { esquemaCupos, type PeticionDeCupos } from '@/lib/validation/reserva';

/**
 * Cupos disponibles para la página pública de reserva (tareas F2 y F3).
 *
 * Sin sesión: la llama un desconocido desde el navegador, así que todo lo que
 * entra se valida y el negocio se deriva del slug. Lo único que sale de acá son
 * horas libres — nunca quién tiene cita ni a qué hora está ocupado alguien.
 */

export type RespuestaCupos = { ok: true; ventana: VentanaDeCupos } | { ok: false; error: string };

export async function cuposDisponibles(peticion: PeticionDeCupos): Promise<RespuestaCupos> {
  const datos = esquemaCupos.safeParse(peticion);
  if (!datos.success) return { ok: false, error: 'No pudimos entender la búsqueda' };

  const { slug, serviceId, staffId, desde } = datos.data;

  // Acá se deriva el negocio, y es lo único que autoriza la consulta: si el
  // slug no está publicado, RLS no devuelve nada y no hay cupos que dar.
  const negocio = await getNegocioPublico(slug);
  if (!negocio) return { ok: false, error: 'Este negocio no está disponible' };

  const servicio = (await obtenerCatalogoReservable(negocio)).find((s) => s.id === serviceId);
  if (!servicio) return { ok: false, error: 'Ese servicio ya no está disponible' };

  try {
    const ventana = await obtenerVentanaDeCupos({ negocio, servicio, staffId, desde, ahora: new Date() });
    return { ok: true, ventana };
  } catch (error) {
    console.error('[reservar] no se pudieron calcular los cupos:', {
      negocio: slug,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: 'No pudimos cargar los horarios. Intenta de nuevo.' };
  }
}
