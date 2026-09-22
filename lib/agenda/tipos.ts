import { sumarDias } from '@/lib/fechas';
import type { Enums } from '@/lib/types/database';

/**
 * Lo que viaja del servidor al calendario del navegador.
 *
 * Vive aparte de `lib/panel/agenda.ts` porque ese módulo es `server-only` —lee
 * cookies para resolver la sesión— y estos tipos los necesita también el
 * componente que corre en el navegador.
 */

export type VistaAgenda = 'dia' | 'semana';

export type CitaEnAgenda = {
  id: string;
  inicio: string;
  fin: string;
  estado: Enums<'appointment_status'>;
  cliente: string;
  telefono: string | null;
  servicio: string;
  color: string;
  staffId: string;
  trabajador: string;
  precioCop: number;
  duracionMinutos: number;
  notaDelCliente: string | null;
  notaInterna: string | null;
};

export type TurnoEnAgenda = { staffId: string; weekday: number; desde: string; hasta: string };

export type BloqueoEnAgenda = {
  id: string;
  /** null: el local entero. */
  staffId: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
};

export type TrabajadorEnAgenda = { id: string; nombre: string; fotoUrl: string | null };

export type DatosAgenda = {
  vista: VistaAgenda;
  /** El día que se está mirando, 'YYYY-MM-DD' local. */
  fecha: string;
  /** Los días que se dibujan: uno en vista de día, siete en la de semana. */
  dias: string[];
  /** Solo los que se dibujan como columna; en semana, la persona escogida. */
  trabajadores: TrabajadorEnAgenda[];
  /** Todo el equipo activo, para el selector. */
  equipo: TrabajadorEnAgenda[];
  citas: CitaEnAgenda[];
  turnos: TurnoEnAgenda[];
  bloqueos: BloqueoEnAgenda[];
};

/**
 * La semana empieza el lunes: es como se piensa la semana laboral acá, y deja
 * el fin de semana junto al final en vez de partido.
 */
export function lunesDeLaSemana(fecha: string): string {
  // Mediodía en UTC: lejos de cualquier borde, y la fecha es una etiqueta de
  // calendario, no un instante.
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();

  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}
