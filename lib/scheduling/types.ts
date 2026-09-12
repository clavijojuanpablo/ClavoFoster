/**
 * Tipos del motor de agendamiento.
 *
 * Todo instante es un Date en UTC. Las horas locales solo aparecen como
 * cadenas 'HH:MM' en los horarios semanales, que son horas de reloj
 * recurrentes y no instantes.
 *
 * Ver docs/06-motor-de-agendamiento.md
 */

/** Un rango de tiempo. `fin` nunca es anterior a `inicio`. */
export type Intervalo = {
  inicio: Date;
  fin: Date;
};

/** Un turno del horario semanal: "lunes de 9:00 a 13:00". */
export type TurnoSemanal = {
  /** 0 = domingo, 6 = sábado. */
  weekday: number;
  /** Hora local del negocio, 'HH:MM'. */
  desde: string;
  /** Hora local del negocio, 'HH:MM'. */
  hasta: string;
};

/** Lo que se va a agendar. Las duraciones vienen de la cita, no del servicio. */
export type ServicioAAgendar = {
  duracionMinutos: number;
  bufferAntesMinutos: number;
  bufferDespuesMinutos: number;
};

/** Configuración de reserva del negocio. */
export type ReglasDeReserva = {
  /** Zona IANA, ej. 'America/Bogota'. */
  timezone: string;
  /** Cada cuántos minutos se ofrece un cupo. */
  granularidadMinutos: number;
  /** No se puede reservar para dentro de menos de esto. */
  anticipacionMinimaMinutos: number;
  /** Cuántos días hacia adelante se puede reservar. */
  ventanaMaximaDias: number;
  /**
   * Si es true, los cupos se redondean al siguiente múltiplo de la
   * granularidad contado desde la medianoche local. Si es false —el valor por
   * defecto— se anclan al inicio del hueco libre, que desperdicia menos
   * tiempo. Ver docs/06-motor-de-agendamiento.md
   */
  alinearAlReloj: boolean;
};

export type EntradaDisponibilidad = {
  /** Fecha en hora local del negocio, 'YYYY-MM-DD'. */
  fecha: string;
  /** Horario semanal del trabajador. */
  turnos: TurnoSemanal[];
  /**
   * Rangos ya ocupados: citas (con sus buffers ya sumados) y bloqueos.
   * Pueden venir desordenados y solapados.
   */
  ocupado: Intervalo[];
  servicio: ServicioAAgendar;
  reglas: ReglasDeReserva;
  /**
   * El "ahora" se recibe, no se lee del reloj del sistema. Es lo que hace que
   * este motor se pueda probar sin esperar a que llegue una fecha.
   */
  ahora: Date;
};
