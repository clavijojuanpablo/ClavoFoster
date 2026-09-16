import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

import type { Mensaje } from './tipos';
import { whatsapp } from './whatsapp';

export { whatsappConfigurado } from './whatsapp';
export type { Mensaje, PlantillaId } from './tipos';

/**
 * Manda un mensaje y lo deja anotado en `notification_log`.
 *
 * **Nunca tumba lo que la llamó.** Que Meta esté caído no puede impedir que una
 * cita se guarde: la cita es el hecho, el mensaje es el aviso. El error queda
 * en el registro y en la tabla, y devuelve `false`.
 *
 * El registro sirve para dos cosas muy concretas: ver qué se le mandó a un
 * cliente cuando reclama, y sumar el costo real de WhatsApp contra lo que dice
 * `docs/10-costos-de-infraestructura.md`.
 */
export async function notificar(
  mensaje: Mensaje & { businessId: string; appointmentId?: string },
): Promise<boolean> {
  const supabase = createAdminClient();
  const { businessId, appointmentId, ...envio } = mensaje;

  const comun = {
    business_id: businessId,
    appointment_id: appointmentId ?? null,
    channel: 'whatsapp' as const,
    template: envio.plantilla,
    recipient: envio.para,
  };

  try {
    const { referencia, costoUsd } = await whatsapp.enviar(envio);

    await supabase.from('notification_log').insert({
      ...comun,
      status: 'sent',
      provider_ref: referencia,
      cost_usd: costoUsd ?? null,
      sent_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    console.error('[notificaciones] no se pudo enviar:', { plantilla: envio.plantilla, detalle });

    await supabase.from('notification_log').insert({ ...comun, status: 'failed', error: detalle });

    return false;
  }
}
