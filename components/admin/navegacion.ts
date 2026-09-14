import {
  CalendarDays,
  ChartColumn,
  House,
  Scissors,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Secciones del panel. Una sola definición para el menú lateral (escritorio) y
 * la barra inferior + hoja "Más" (celular).
 *
 * `disponible: false` se muestra con la etiqueta "Pronto" y no navega: el
 * dueño ve hacia dónde va el producto sin caer en una página que no existe.
 * Al terminar la tarea del backlog correspondiente, se cambia a `true`.
 */

export type ItemMenu = {
  etiqueta: string;
  href: string;
  icono: LucideIcon;
  disponible: boolean;
  /** El trabajador solo ve su agenda (docs/02-usuarios-y-flujos.md, flujo 5). */
  soloDueno: boolean;
};

export const MENU_OPERACION: ItemMenu[] = [
  { etiqueta: 'Inicio', href: '/panel', icono: House, disponible: true, soloDueno: false },
  { etiqueta: 'Agenda', href: '/panel/agenda', icono: CalendarDays, disponible: false, soloDueno: false }, // G1
  { etiqueta: 'Clientes', href: '/panel/clientes', icono: Users, disponible: false, soloDueno: true },
];

export const MENU_NEGOCIO: ItemMenu[] = [
  { etiqueta: 'Servicios', href: '/panel/servicios', icono: Scissors, disponible: true, soloDueno: true },
  { etiqueta: 'Equipo', href: '/panel/equipo', icono: UserRound, disponible: false, soloDueno: true }, // D1
  { etiqueta: 'Caja', href: '/panel/caja', icono: Wallet, disponible: false, soloDueno: true }, // H
  { etiqueta: 'Reportes', href: '/panel/reportes', icono: ChartColumn, disponible: false, soloDueno: true }, // K
];

export const RUTA_CONFIGURACION = '/panel/negocio';

export function visiblesPara(items: ItemMenu[], rol: 'owner' | 'staff'): ItemMenu[] {
  return rol === 'owner' ? items : items.filter((i) => !i.soloDueno);
}

/** /panel solo está activo en /panel; las demás, también en sus subrutas. */
export function esRutaActiva(rutaActual: string, href: string): boolean {
  if (href === '/panel') return rutaActual === '/panel';
  return rutaActual === href || rutaActual.startsWith(`${href}/`);
}
