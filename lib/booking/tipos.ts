/**
 * Lo que viaja del servidor al navegador en la reserva pública.
 *
 * Vive aparte de `disponibilidad.ts` porque ese módulo es `server-only` —lleva
 * el cliente privilegiado— y estos tipos los necesita también el componente que
 * corre en el navegador.
 *
 * Regla de lo que puede estar acá: horas libres y catálogo. Nunca citas, ni
 * clientes, ni la agenda de nadie.
 */

export type Cupo = {
  /** Instante de inicio del servicio, ISO 8601 en UTC. */
  inicio: string;
  staffId: string;
  staffNombre: string;
};

export type DiaDisponible = {
  /** 'YYYY-MM-DD' en hora local del negocio. */
  fecha: string;
  cupos: Cupo[];
};

export type VentanaDeCupos = {
  dias: DiaDisponible[];
  /**
   * Desde dónde arranca la siguiente tanda de días, o null si ya se llegó
   * hasta donde el negocio deja reservar.
   */
  siguienteDesde: string | null;
};

export type TrabajadorDelServicio = {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  /** Ya resuelta con el número propio de esa persona, si tiene. */
  duracionMinutos: number;
  precioCop: number;
};

export type ServicioReservable = {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracionMinutos: number;
  precioCop: number;
  bufferAntesMinutos: number;
  bufferDespuesMinutos: number;
  trabajadores: TrabajadorDelServicio[];
};
