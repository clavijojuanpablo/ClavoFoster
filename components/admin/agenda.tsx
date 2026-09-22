'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Calendario } from '@/components/admin/calendario';
import { DetalleCita } from '@/components/admin/detalle-cita';
import { NuevaCita } from '@/components/admin/nueva-cita';
import { Button } from '@/components/ui/button';
import type { ServicioReservable } from '@/lib/booking/tipos';
import { fechaLarga } from '@/lib/formato';
import { sumarDias } from '@/lib/fechas';
import { lunesDeLaSemana, type CitaEnAgenda, type DatosAgenda } from '@/lib/agenda/tipos';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * La agenda: controles, calendario, detalle de la cita y cita nueva (G1, G2, G3
 * y G5).
 *
 * Todo el estado de "qué se está mirando" vive en la URL, no en React. Así el
 * botón de atrás del navegador funciona, un link a un día concreto se puede
 * compartir, y volver de otra pantalla no pierde el día que se estaba viendo.
 */

export function Agenda({
  datos,
  timezone,
  hoy,
  businessId,
  puedeEditar,
  catalogo,
}: {
  datos: DatosAgenda;
  timezone: string;
  hoy: string;
  businessId: string;
  puedeEditar: boolean;
  /** Lo que se puede agendar desde el panel. */
  catalogo: ServicioReservable[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [abierta, setAbierta] = useState<CitaEnAgenda | null>(null);
  const [creando, setCreando] = useState(false);
  // El "+" de la barra del celular llega con ?nueva=1, desde cualquier pantalla.
  const pedidaPorLink = params.get('nueva') === '1';
  const hojaNueva = puedeEditar && (creando || pedidaPorLink);

  function cerrarNueva(cambios: Record<string, string | null> = {}) {
    setCreando(false);
    if (pedidaPorLink || Object.keys(cambios).length > 0) ir({ ...cambios, nueva: null });
  }

  useRefrescoEnVivo(businessId, () => router.refresh());

  function ir(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(params);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    router.push(`/panel/agenda?${nuevos}`, { scroll: false });
  }

  const paso = datos.vista === 'semana' ? 7 : 1;
  const anterior = sumarDias(datos.fecha, -paso);
  const siguiente = sumarDias(datos.fecha, paso);

  // La cita abierta se vuelve a leer de los datos frescos: después de marcarla
  // cumplida, el detalle no puede seguir mostrando el estado viejo.
  const enPantalla = abierta ? (datos.citas.find((c) => c.id === abierta.id) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5">
          <BotonRedondo etiqueta="Anterior" onClick={() => ir({ fecha: anterior })}>
            <ChevronLeft className="size-5" />
          </BotonRedondo>
          <BotonRedondo etiqueta="Siguiente" onClick={() => ir({ fecha: siguiente })}>
            <ChevronRight className="size-5" />
          </BotonRedondo>
        </div>

        <button
          type="button"
          onClick={() => ir({ fecha: hoy })}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-sm font-semibold transition hover:bg-muted',
            esHoyEnPantalla(datos, hoy) && 'border-tinta bg-tinta text-white hover:bg-tinta/85',
          )}
        >
          <CalendarDays className="size-4" />
          Hoy
        </button>

        <span className="order-last w-full text-[15px] font-semibold first-letter:uppercase sm:order-none sm:w-auto sm:flex-1">
          {titulo(datos, timezone)}
        </span>

        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(['dia', 'semana'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => ir({ vista: v })}
              aria-current={datos.vista === v ? 'true' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition',
                datos.vista === v
                  ? 'bg-card font-semibold text-tinta shadow-[0_1px_2px_rgba(18,20,18,.08)]'
                  : 'text-muted-foreground hover:text-tinta',
              )}
            >
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>

        {puedeEditar && (
          <Button size="sm" className="h-9" onClick={() => setCreando(true)}>
            <Plus />
            Nueva cita
          </Button>
        )}
      </div>

      {/*
        En vista de semana las columnas son los días, así que hay que escoger a
        una persona. En vista de día el selector filtra, y "Todos" es lo normal.
      */}
      {datos.equipo.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {datos.vista === 'dia' && (
            <ChipEquipo activo={datos.trabajadores.length > 1} onClick={() => ir({ trabajador: null })}>
              Todos
            </ChipEquipo>
          )}
          {datos.equipo.map((t) => (
            <ChipEquipo
              key={t.id}
              activo={datos.trabajadores.length === 1 && datos.trabajadores[0]?.id === t.id}
              onClick={() => ir({ trabajador: t.id })}
            >
              {t.nombre}
            </ChipEquipo>
          ))}
        </div>
      )}

      <Calendario datos={datos} timezone={timezone} hoy={hoy} onAbrirCita={setAbierta} />

      {enPantalla && (
        <DetalleCita
          cita={enPantalla}
          timezone={timezone}
          puedeEditar={puedeEditar}
          onCerrar={() => setAbierta(null)}
        />
      )}

      {hojaNueva && (
        <NuevaCita
          catalogo={catalogo}
          timezone={timezone}
          hoy={hoy}
          fechaInicial={datos.fecha}
          personaInicial={datos.trabajadores.length === 1 ? (datos.trabajadores[0]?.id ?? null) : null}
          onCerrar={() => cerrarNueva()}
          // La cita recién hecha tiene que verse: se va al día en que quedó.
          onCreada={(fecha) => cerrarNueva(fecha !== datos.fecha ? { fecha } : {})}
        />
      )}
    </div>
  );
}

/**
 * Si alguien reserva mientras el dueño mira la pantalla, la cita aparece sola.
 *
 * Se escucha el cambio y se recarga la página del servidor, en vez de meter la
 * fila que llega en el estado: la carga real trae el nombre del cliente y el
 * del servicio, que el evento de Realtime no incluye. Es una consulta de más a
 * cambio de no tener dos caminos por los que los datos pueden entrar.
 */
function useRefrescoEnVivo(businessId: string, alCambiar: () => void) {
  useEffect(() => {
    const supabase = createClient();

    const canal = supabase
      .channel(`agenda:${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `business_id=eq.${businessId}` },
        alCambiar,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
    // `alCambiar` es router.refresh, estable entre renders; volver a suscribirse
    // en cada render abriría y cerraría el canal sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);
}

function BotonRedondo({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex size-9 items-center justify-center rounded-full text-tinta transition hover:bg-muted"
    >
      {children}
    </button>
  );
}

function ChipEquipo({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
        activo ? 'border-tinta bg-tinta text-white' : 'border-border bg-card text-tinta hover:border-input',
      )}
    >
      {children}
    </button>
  );
}

function esHoyEnPantalla(datos: DatosAgenda, hoy: string): boolean {
  return datos.vista === 'semana' ? lunesDeLaSemana(datos.fecha) === lunesDeLaSemana(hoy) : datos.fecha === hoy;
}

function titulo(datos: DatosAgenda, timezone: string): string {
  if (datos.vista === 'dia') return fechaLarga(timezone, new Date(`${datos.fecha}T12:00:00Z`));

  const primero = new Date(`${datos.dias[0]}T12:00:00Z`);
  const ultimo = new Date(`${datos.dias[datos.dias.length - 1]}T12:00:00Z`);
  const corto = (d: Date) =>
    new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' })
      .format(d)
      .replace('.', '');

  return `${corto(primero)} – ${corto(ultimo)}`;
}
