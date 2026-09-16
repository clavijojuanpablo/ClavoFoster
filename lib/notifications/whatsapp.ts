import 'server-only';

import type { CanalDeNotificacion, Enviado, Mensaje } from './tipos';

/**
 * WhatsApp Cloud API (Meta, directo).
 *
 * **Funciona sin credenciales, a propósito.** Mientras no existan
 * `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` el canal entra en *modo consola*: no
 * manda nada y escribe el mensaje en el registro del servidor. Así el flujo de
 * reserva se puede construir y probar entero sin esperar a que Meta apruebe el
 * número y las plantillas, que es un trámite y no una tarea de programación.
 *
 * El día que lleguen las credenciales no hay que tocar nada más que el entorno:
 * este mismo archivo empieza a llamar a Meta solo.
 *
 * Ver `docs/09-notificaciones.md`.
 */

const VERSION_API = 'v21.0';

/** Si el canal está de verdad conectado con Meta o solo escribiendo en el log. */
export function whatsappConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export const whatsapp: CanalDeNotificacion = {
  nombre: 'whatsapp',

  async enviar(mensaje: Mensaje): Promise<Enviado> {
    if (!whatsappConfigurado()) return modoConsola(mensaje);

    const respuesta = await fetch(
      `https://graph.facebook.com/${VERSION_API}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: mensaje.para,
          type: 'template',
          template: {
            name: mensaje.plantilla,
            language: { code: 'es' },
            components: mensaje.variables.length
              ? [
                  {
                    type: 'body',
                    parameters: mensaje.variables.map((text) => ({ type: 'text', text })),
                  },
                ]
              : [],
          },
        }),
      },
    );

    if (!respuesta.ok) {
      // El cuerpo del error de Meta dice qué pasó (plantilla sin aprobar,
      // número fuera de la lista de pruebas, token vencido). Sin él, depurar
      // esto es adivinar.
      const detalle = await respuesta.text().catch(() => '');
      throw new Error(`WhatsApp respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }

    const datos = (await respuesta.json()) as { messages?: { id: string }[] };

    return { referencia: datos.messages?.[0]?.id ?? 'sin-referencia' };
  },
};

/**
 * Sin credenciales: el mensaje va al registro del servidor.
 *
 * El código del OTP sale en claro acá. Es exactamente lo que se necesita para
 * probar en local, y es también la razón por la que este modo NO puede quedar
 * encendido con clientes reales: cualquiera con acceso a los registros vería
 * los códigos. `whatsappConfigurado()` existe para que la aplicación pueda
 * avisarlo en pantalla.
 */
function modoConsola(mensaje: Mensaje): Enviado {
  console.warn(
    `[whatsapp] SIN CREDENCIALES — no se envió nada.\n` +
      `  plantilla: ${mensaje.plantilla}\n` +
      `  para:      ${mensaje.para}\n` +
      `  variables: ${mensaje.variables.join(' | ')}`,
  );

  return { referencia: `consola:${Date.now()}` };
}
