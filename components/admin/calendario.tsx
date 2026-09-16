'use client';

import { Ban, Clock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  colocarEnCarriles,
  horasDeLaRegla,
  recortarAlDia,
  ventanaDelDia,
  type Rango,
} from '@/lib/agenda/disposicion';
import { rangoDelDia } from '@/lib/fechas';
import { hora } from '@/lib/formato';
import type { CitaEnAgenda, DatosAgenda } from '@/lib/agenda/tipos';
import { partirHora } from '@/lib/scheduling/timezone';
import { cn } from '@/lib/utils';

/**
 * El calendario del panel (G1).
 *
 * Es la pantalla más usada del producto. Dos vistas con la misma rejilla:
 * en **día**, una columna por persona; en **semana**, una columna por día de
 * una sola persona. En celular las columnas se deslizan de lado; no se apilan,
 * porque perder la referencia de la hora es perder el calendario.
 *
 * La regla de las horas queda fija a la izquierda y el cuerpo se desliza junto
 * con ella, así que a las 4 de la tarde todavía se sabe qué hora se está
 * mirando.
 */

/** Píxeles por minuto. Una hora son 64 px: cabe un nombre y una hora sin apretar. */
const PX_POR_MINUTO = 64 / 60;
/** Debajo de esto el bloque no aguanta dos líneas de texto. */
const MINUTOS_PARA_DOS_LINEAS = 40;

type Columna = {
  clave: string;
  titulo: string;
  subtitulo?: string;
  /** El día que representa la columna, 'YYYY-MM-DD'. */
  fecha: string;
  staffId: string;
  esHoy: boolean;
};

export function Calendario({
  datos,
  timezone,
  hoy,
  onAbrirCita,
}: {
  datos: DatosAgenda;
  timezone: string;
  /** Hoy en la zona del negocio, no la del navegador. */
  hoy: string;
  onAbrirCita: (cita: CitaEnAgenda) => void;
}) {
  const columnas: Columna[] = useMemo(() => {
    if (datos.vista === 'semana') {
      const persona = datos.trabajadores[0];
      if (!persona) return [];

      return datos.dias.map((fecha) => ({
        clave: fecha,
        titulo: diaDeLaSemanaCorto(fecha),
        subtitulo: numeroDelDia(fecha),
        fecha,
        staffId: persona.id,
        esHoy: fecha === hoy,
      }));
    }

    return datos.trabajadores.map((t) => ({
      clave: t.id,
      titulo: t.nombre,
      fecha: datos.fecha,
      staffId: t.id,
      esHoy: datos.fecha === hoy,
    }));
  }, [datos, hoy]);

  // Los rangos de todas las columnas mandan sobre la altura de la rejilla: si
  // una sola persona entra a las 7, el día arranca a las 7 para todos, porque
  // si no las columnas quedarían desalineadas.
  const { desdeMinuto, hastaMinuto } = useMemo(() => {
    const rangos: Rango[] = [];

    for (const columna of columnas) {
      const dia = rangoDelDia(timezone, columna.fecha);

      for (const turno of turnosDe(datos, columna)) rangos.push(turno);
      for (const cita of citasDe(datos, columna)) {
        const r = recortarAlDia({ inicio: new Date(cita.inicio), fin: new Date(cita.fin) }, dia);
        if (r) rangos.push(r);
      }
    }

    return ventanaDelDia(rangos);
  }, [columnas, datos, timezone]);

  const alto = (hastaMinuto - desdeMinuto) * PX_POR_MINUTO;
  const horas = horasDeLaRegla(desdeMinuto, hastaMinuto);

  if (columnas.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Todavía no hay nadie en el equipo.{' '}
        <Link href="/panel/equipo" className="font-semibold text-tinta underline underline-offset-4">
          Agrega a tu primera persona
        </Link>{' '}
        para ver la agenda.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex overflow-x-auto">
        {/* La regla de horas no se desliza en horizontal: es la referencia. */}
        <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card">
          <div className="h-12 border-b border-border" />
          <div className="relative w-12" style={{ height: alto }}>
            {horas.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-tenue tabular-nums"
                style={{ top: (m - desdeMinuto) * PX_POR_MINUTO }}
              >
                {etiquetaDeHora(m)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-fit flex-1">
          {columnas.map((columna) => (
            <ColumnaDelCalendario
              key={columna.clave}
              columna={columna}
              datos={datos}
              timezone={timezone}
              desdeMinuto={desdeMinuto}
              hastaMinuto={hastaMinuto}
              horas={horas}
              alto={alto}
              anchoFijo={columnas.length <= 2}
              onAbrirCita={onAbrirCita}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColumnaDelCalendario({
  columna,
  datos,
  timezone,
  desdeMinuto,
  hastaMinuto,
  horas,
  alto,
  anchoFijo,
  onAbrirCita,
}: {
  columna: Columna;
  datos: DatosAgenda;
  timezone: string;
  desdeMinuto: number;
  hastaMinuto: number;
  horas: number[];
  alto: number;
  anchoFijo: boolean;
  onAbrirCita: (cita: CitaEnAgenda) => void;
}) {
  const dia = useMemo(() => rangoDelDia(timezone, columna.fecha), [timezone, columna.fecha]);

  const turnos = useMemo(() => turnosDe(datos, columna), [datos, columna]);

  const bloqueos = useMemo(
    () =>
      datos.bloqueos
        .filter((b) => b.staffId === null || b.staffId === columna.staffId)
        .map((b) => ({
          motivo: b.motivo,
          ...recortarAlDia({ inicio: new Date(b.inicio), fin: new Date(b.fin) }, dia),
        }))
        .filter((b): b is { motivo: string | null } & Rango => b.desdeMinuto !== undefined),
    [datos.bloqueos, columna.staffId, dia],
  );

  const citas = useMemo(() => {
    const recortadas = citasDe(datos, columna).flatMap((cita) => {
      const r = recortarAlDia({ inicio: new Date(cita.inicio), fin: new Date(cita.fin) }, dia);
      return r ? [{ ...r, cita }] : [];
    });

    return colocarEnCarriles(recortadas);
  }, [datos, columna, dia]);

  const minutoAhora = useMinutoActual(timezone, columna.esHoy);

  const arriba = (minuto: number) => (minuto - desdeMinuto) * PX_POR_MINUTO;

  return (
    <div
      className={cn(
        'flex flex-col border-r border-border last:border-r-0',
        anchoFijo ? 'min-w-[180px] flex-1' : 'w-[160px] shrink-0 sm:w-auto sm:min-w-[150px] sm:flex-1',
      )}
    >
      <div
        className={cn(
          'sticky top-0 z-10 flex h-12 shrink-0 items-center justify-center gap-1.5 border-b border-border bg-card px-2',
          columna.esHoy && 'bg-lima/20',
        )}
      >
        <span className="truncate text-[13px] font-semibold">{columna.titulo}</span>
        {columna.subtitulo && (
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums',
              columna.esHoy && 'bg-tinta text-lima',
            )}
          >
            {columna.subtitulo}
          </span>
        )}
      </div>

      <div className="relative" style={{ height: alto }}>
        {/*
          Fuera del horario: el fondo dice, sin palabras, cuándo esta persona no
          trabaja. Es lo que hace que un almuerzo o un sábado corto se vean de
          un vistazo en vez de tener que abrir el horario.
        */}
        {huecosFueraDelTurno(turnos, desdeMinuto, hastaMinuto).map((hueco, i) => (
          <div
            key={`fuera-${i}`}
            className="absolute inset-x-0 bg-muted/70"
            style={{ top: arriba(hueco.desdeMinuto), height: (hueco.hastaMinuto - hueco.desdeMinuto) * PX_POR_MINUTO }}
          />
        ))}

        {horas.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 border-t border-border/70"
            style={{ top: arriba(m) }}
          />
        ))}

        {bloqueos.map((b, i) => (
          <div
            key={`bloqueo-${i}`}
            title={b.motivo ?? 'Bloqueado'}
            className="absolute inset-x-0 flex items-start justify-center overflow-hidden border-y border-border/60 px-1 pt-1"
            style={{
              top: arriba(b.desdeMinuto),
              height: (b.hastaMinuto - b.desdeMinuto) * PX_POR_MINUTO,
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(18,20,18,.07) 0 4px, transparent 4px 10px)',
            }}
          >
            <span className="flex items-center gap-1 truncate text-[11px] font-semibold text-muted-foreground">
              <Ban className="size-3 shrink-0" />
              {b.motivo ?? 'Bloqueado'}
            </span>
          </div>
        ))}

        {citas.map(({ bloque, carril, carriles }) => (
          <BloqueDeCita
            key={bloque.cita.id}
            cita={bloque.cita}
            timezone={timezone}
            top={arriba(bloque.desdeMinuto)}
            alto={(bloque.hastaMinuto - bloque.desdeMinuto) * PX_POR_MINUTO}
            minutos={bloque.hastaMinuto - bloque.desdeMinuto}
            carril={carril}
            carriles={carriles}
            onAbrir={() => onAbrirCita(bloque.cita)}
          />
        ))}

        {minutoAhora !== null && minutoAhora >= desdeMinuto && minutoAhora <= hastaMinuto && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: arriba(minutoAhora) }}
            aria-hidden="true"
          >
            <span className="size-2 shrink-0 rounded-full bg-destructive" />
            <span className="h-px flex-1 bg-destructive" />
          </div>
        )}
      </div>
    </div>
  );
}

function BloqueDeCita({
  cita,
  timezone,
  top,
  alto,
  minutos,
  carril,
  carriles,
  onAbrir,
}: {
  cita: CitaEnAgenda;
  timezone: string;
  top: number;
  alto: number;
  minutos: number;
  carril: number;
  carriles: number;
  onAbrir: () => void;
}) {
  const cumplida = cita.estado === 'completed';
  const noLlego = cita.estado === 'no_show';

  return (
    <button
      type="button"
      onClick={onAbrir}
      // El color del servicio nunca va solo: el nombre está siempre al lado.
      // Ver docs/15-sistema-de-diseno.md
      className={cn(
        'absolute overflow-hidden rounded-lg border border-l-[3px] bg-card px-1.5 py-1 text-left transition hover:z-10 hover:shadow-[0_2px_8px_rgba(18,20,18,.12)]',
        cumplida && 'opacity-65',
        noLlego && 'border-dashed',
      )}
      style={{
        top: top + 1,
        height: Math.max(alto - 2, 18),
        left: `calc(${(carril / carriles) * 100}% + 2px)`,
        width: `calc(${100 / carriles}% - 4px)`,
        borderLeftColor: cita.color,
        borderColor: noLlego ? undefined : `${cita.color}55`,
      }}
    >
      <span className={cn('block truncate text-[12px] font-semibold', cumplida && 'line-through')}>
        {cita.cliente}
      </span>
      {minutos >= MINUTOS_PARA_DOS_LINEAS && (
        <span className="block truncate text-[11px] text-muted-foreground">
          {hora(timezone, cita.inicio)} · {cita.servicio}
        </span>
      )}
      {noLlego && minutos >= MINUTOS_PARA_DOS_LINEAS * 1.5 && (
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-destructive">
          <Clock className="size-3" />
          No llegó
        </span>
      )}
    </button>
  );
}

/**
 * El minuto local actual, refrescado cada minuto. null si la columna no es hoy.
 *
 * Arranca en null a propósito: el servidor no puede saber qué hora es en el
 * navegador, y pintar la línea de "ahora" en el primer render rompería la
 * hidratación. Aparece un instante después, ya montado.
 */
function useMinutoActual(timezone: string, activo: boolean): number | null {
  const [minuto, setMinuto] = useState<number | null>(null);

  useEffect(() => {
    if (!activo) return;

    const calcular = () => {
      const reloj = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
      const { hora: h, minuto: m } = partirHora(reloj);
      setMinuto(h * 60 + m);
    };

    calcular();
    const id = setInterval(calcular, 60_000);
    return () => clearInterval(id);
  }, [activo, timezone]);

  return activo ? minuto : null;
}

function turnosDe(datos: DatosAgenda, columna: Columna): Rango[] {
  const weekday = new Date(`${columna.fecha}T12:00:00Z`).getUTCDay();

  return datos.turnos
    .filter((t) => t.staffId === columna.staffId && t.weekday === weekday)
    .map((t) => ({
      desdeMinuto: enMinutos(t.desde),
      hastaMinuto: enMinutos(t.hasta),
    }))
    .sort((a, b) => a.desdeMinuto - b.desdeMinuto);
}

function citasDe(datos: DatosAgenda, columna: Columna): CitaEnAgenda[] {
  return datos.citas.filter((c) => c.staffId === columna.staffId);
}

/** Lo que queda por fuera de los turnos, para pintarlo apagado. */
function huecosFueraDelTurno(turnos: Rango[], desde: number, hasta: number): Rango[] {
  if (turnos.length === 0) return [{ desdeMinuto: desde, hastaMinuto: hasta }];

  const huecos: Rango[] = [];
  let cursor = desde;

  for (const turno of turnos) {
    if (turno.desdeMinuto > cursor) huecos.push({ desdeMinuto: cursor, hastaMinuto: turno.desdeMinuto });
    cursor = Math.max(cursor, turno.hastaMinuto);
  }

  if (cursor < hasta) huecos.push({ desdeMinuto: cursor, hastaMinuto: hasta });

  return huecos;
}

function enMinutos(hhmm: string): number {
  const { hora: h, minuto: m } = partirHora(hhmm);
  return h * 60 + m;
}

/** "9 a.m." — corto porque vive en una columna de 48 px. */
function etiquetaDeHora(minuto: number): string {
  const h = Math.floor(minuto / 60) % 24;
  const sufijo = h < 12 ? 'a' : 'p';
  const doce = h % 12 === 0 ? 12 : h % 12;
  return `${doce} ${sufijo}m`;
}

function diaDeLaSemanaCorto(fecha: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short' })
    .format(new Date(`${fecha}T12:00:00Z`))
    .replace('.', '');
}

function numeroDelDia(fecha: string): string {
  return String(Number(fecha.slice(8, 10)));
}

