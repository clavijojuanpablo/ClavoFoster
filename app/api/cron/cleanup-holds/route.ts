import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Libera las retenciones de cupo vencidas.
 *
 * Cuando alguien escoge una hora, la cita se crea en estado 'pending' con un
 * vencimiento corto. Como el constraint anti-solapamiento cuenta las
 * 'pending', el cupo queda apartado de verdad mientras la persona verifica su
 * celular — sin necesidad de ninguna tabla extra.
 *
 * Si abandona, alguien tiene que soltar el cupo. Eso es esto.
 *
 * Se borran en vez de marcarlas como canceladas: una reserva que nunca se
 * confirmó no es historia del negocio, es basura. La regla 5 de CLAUDE.md
 * protege lo que tiene historia, y esto no la tiene.
 *
 * Usa el cliente privilegiado porque no hay usuario detrás: es uno de los tres
 * usos permitidos. Ver docs/12-convenciones-de-desarrollo.md
 */
export async function POST(request: Request) {
  const esperado = process.env.CRON_SECRET;

  if (!esperado) {
    return Response.json({ error: 'CRON_SECRET no está configurado' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${esperado}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('appointments')
    .delete()
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ liberadas: data?.length ?? 0 });
}
