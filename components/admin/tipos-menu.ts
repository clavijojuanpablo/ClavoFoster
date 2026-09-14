/** Lo que el layout del panel resuelve en el servidor y le pasa a los menús. */
export type DatosMenu = {
  negocio: { nombre: string; slug: string; publicada: boolean };
  /** Estado de la suscripción en palabras. null para el trabajador, que no la ve. */
  plan: { texto: string; alerta: boolean } | null;
  urlPublica: string;
  rol: 'owner' | 'staff';
};
