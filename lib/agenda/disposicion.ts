/**
 * Cómo se acomodan los bloques en una columna del calendario.
 *
 * LÓGICA PURA, igual que `lib/scheduling`: no toca la base, no lee el reloj, no
 * importa React. Recibe rangos y devuelve posiciones. Es lo que permite probar
 * el caso feo —tres citas encimadas— sin montar una pantalla.
 *
 * Ver `docs/15-sistema-de-diseno.md` y la tarea G1 de `docs/03-backlog.md`.
 */

export type Rango = {
  /** Minutos desde la medianoche local. Puede pasarse de 1440 si cruza el día. */
  desdeMinuto: number;
  hastaMinuto: number;
};

export type Colocado<T> = {
  bloque: T;
  desdeMinuto: number;
  hastaMinuto: number;
  /** En qué carril va, de 0 en adelante. */
  carril: number;
  /** Cuántos carriles tiene el grupo con el que se cruza. */
  carriles: number;
};

/**
 * Reparte los bloques en carriles para que ninguno tape a otro.
 *
 * La restricción `appointments_sin_solapamiento` impide que dos citas *activas*
 * de la misma persona se crucen, así que lo normal es un solo carril. Pero una
 * cita cumplida y una nueva confirmada a la misma hora sí pueden convivir —esa
 * restricción no las cuenta—, y una pantalla que dibuje una encima de la otra
 * estaría mintiendo. De ahí que esto exista.
 *
 * El ancho se reparte por GRUPO de bloques encadenados, no por bloque: si A se
 * cruza con B y B con C, los tres quedan a un tercio aunque A y C no se toquen.
 * Es lo que hace que las columnas queden alineadas y no escalonadas.
 */
export function colocarEnCarriles<T extends Rango>(bloques: T[]): Colocado<T>[] {
  const ordenados = [...bloques].sort(
    (a, b) => a.desdeMinuto - b.desdeMinuto || a.hastaMinuto - b.hastaMinuto,
  );

  const colocados: Colocado<T>[] = [];
  /** Hasta qué minuto llega lo último puesto en cada carril. */
  let finDeCarril: number[] = [];
  /** Los índices de `colocados` del grupo que se está armando. */
  let grupo: number[] = [];
  let finDelGrupo = -Infinity;

  const cerrarGrupo = () => {
    for (const i of grupo) colocados[i].carriles = finDeCarril.length;
    grupo = [];
    finDeCarril = [];
    finDelGrupo = -Infinity;
  };

  for (const bloque of ordenados) {
    // Empieza cuando el grupo anterior ya terminó: son cosas independientes.
    if (bloque.desdeMinuto >= finDelGrupo) cerrarGrupo();

    // El primer carril donde ya no hay nada. Uno nuevo si todos están ocupados.
    let carril = finDeCarril.findIndex((fin) => fin <= bloque.desdeMinuto);
    if (carril === -1) carril = finDeCarril.length;

    finDeCarril[carril] = bloque.hastaMinuto;
    finDelGrupo = Math.max(finDelGrupo, bloque.hastaMinuto);

    grupo.push(colocados.length);
    colocados.push({
      bloque,
      desdeMinuto: bloque.desdeMinuto,
      hastaMinuto: bloque.hastaMinuto,
      carril,
      carriles: 1,
    });
  }

  cerrarGrupo();

  return colocados;
}

/**
 * De qué hora a qué hora se dibuja el día.
 *
 * Se estira para que quepa todo lo que hay —jornadas, citas y bloqueos—, se
 * redondea a horas enteras para que la regla de la izquierda se lea, y nunca
 * baja de la franja mínima: un día sin nada no puede salir como una raya de dos
 * píxeles.
 */
export function ventanaDelDia(
  rangos: Rango[],
  opciones: { minimoDesde?: number; minimoHasta?: number } = {},
): { desdeMinuto: number; hastaMinuto: number } {
  const minimoDesde = opciones.minimoDesde ?? 8 * 60;
  const minimoHasta = opciones.minimoHasta ?? 20 * 60;

  let desde = minimoDesde;
  let hasta = minimoHasta;

  for (const r of rangos) {
    desde = Math.min(desde, r.desdeMinuto);
    hasta = Math.max(hasta, r.hastaMinuto);
  }

  return {
    desdeMinuto: Math.max(0, Math.floor(desde / 60) * 60),
    // Una cita que termina a las 19:05 necesita que el día llegue a las 20:00.
    hastaMinuto: Math.min(24 * 60, Math.ceil(hasta / 60) * 60),
  };
}

/** Las horas en punto que llevan etiqueta en la regla de la izquierda. */
export function horasDeLaRegla(desdeMinuto: number, hastaMinuto: number): number[] {
  const horas: number[] = [];
  for (let m = Math.ceil(desdeMinuto / 60) * 60; m <= hastaMinuto; m += 60) horas.push(m);
  return horas;
}

/**
 * Recorta un intervalo real al día que se está mirando, en minutos locales.
 *
 * Una cita que empezó ayer a las 11 de la noche se dibuja desde el minuto 0 de
 * hoy, no en un negativo que la sacaría de la pantalla. Devuelve null si no
 * toca el día.
 */
export function recortarAlDia(
  intervalo: { inicio: Date; fin: Date },
  dia: { desde: Date; hasta: Date },
): Rango | null {
  const inicio = Math.max(intervalo.inicio.getTime(), dia.desde.getTime());
  const fin = Math.min(intervalo.fin.getTime(), dia.hasta.getTime());

  if (fin <= inicio) return null;

  const minutosDelDia = (t: number) => Math.round((t - dia.desde.getTime()) / 60_000);

  return { desdeMinuto: minutosDelDia(inicio), hastaMinuto: minutosDelDia(fin) };
}
