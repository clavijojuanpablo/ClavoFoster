/**
 * La interfaz de notificaciones.
 *
 * Todo mensaje sale por acá, nunca llamando a Meta directo desde una acción.
 * La razón está en `docs/09-notificaciones.md`: dependemos de que Meta no
 * cambie las reglas ni los precios, y ya lo ha hecho. Una interfaz propia deja
 * cambiar de proveedor o caer a email sin reescribir media aplicación.
 */

/**
 * Las plantillas aprobadas por Meta. No se puede mandar texto libre: todo
 * mensaje que inicia una conversación es una plantilla registrada.
 *
 * La tabla completa, con su categoría y su costo, está en
 * `docs/09-notificaciones.md`.
 */
export type PlantillaId =
  | 'auth_otp'
  | 'booking_confirmed'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'owner_new_booking'
  | 'owner_cancelled'
  | 'trial_ending'
  | 'payment_failed'
  | 'review_request';

export type Mensaje = {
  /** Celular en E.164. */
  para: string;
  plantilla: PlantillaId;
  /**
   * Los valores que van en los huecos de la plantilla, en orden. Meta los
   * numera {{1}}, {{2}}…, así que acá van como lista y no como objeto.
   */
  variables: string[];
};

export type Enviado = {
  /** El id que devuelve el proveedor, para rastrear el mensaje después. */
  referencia: string;
  costoUsd?: number;
};

export interface CanalDeNotificacion {
  nombre: 'whatsapp' | 'email' | 'sms';
  enviar(mensaje: Mensaje): Promise<Enviado>;
}
