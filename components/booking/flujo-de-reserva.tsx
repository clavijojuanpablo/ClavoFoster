'use client';

import { Check, ChevronDown, Clock, Loader2, Users } from 'lucide-react';
import { useState, useTransition } from 'react';

import { cuposDisponibles } from '@/app/(public)/[slug]/reservar/actions';
import { AvatarTrabajador } from '@/components/admin/avatar-trabajador';
import { Button } from '@/components/ui/button';
import type { Cupo, ServicioReservable, VentanaDeCupos } from '@/lib/booking/tipos';
import { duracion, hora, pesos } from '@/lib/formato';
import { cn } from '@/lib/utils';

/**
 * Los tres pasos de la reserva: servicio, con quién, y día y hora (F2 y F3).
 *
 * Todo en una sola pantalla que va creciendo, no en un asistente con "siguiente":
 * en un celular, volver atrás a cambiar el servicio tiene que ser tocar el
 * servicio, no deshacer tres pantallas.
 *
 * El catálogo llega completo desde el servidor. Lo único que se pide al cambiar
 * de servicio, de persona o de tanda de días son los cupos.
 */

/** 'cualquiera' es "el primero disponible": lo que escoge casi todo el mundo. */
const CUALQUIERA = 'cualquiera';

type Props = {
  slug: string;
  timezone: string;
  dejaEscogerPersona: boolean;
  /** Hoy en la zona del negocio, no la del navegador. */
  hoy: string;
  catalogo: ServicioReservable[];
  servicioInicial: string | null;
  ventanaInicial: VentanaDeCupos | null;
};

export function FlujoDeReserva({
  slug,
  timezone,
  dejaEscogerPersona,
  hoy,
  catalogo,
  servicioInicial,
  ventanaInicial,
}: Props) {
  const [servicioId, setServicioId] = useState(servicioInicial);
  const [quien, setQuien] = useState<string>(CUALQUIERA);
  const [ventana, setVentana] = useState<VentanaDeCupos | null>(ventanaInicial);
  const [fecha, setFecha] = useState<string | null>(primerDiaConCupos(ventanaInicial));
  const [elegido, setElegido] = useState<Cupo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  const servicio = catalogo.find((s) => s.id === servicioId) ?? null;

  /**
   * Pide una tanda de cupos. `acumular` es el "Ver más días": los días nuevos
   * se pegan a los que ya están en pantalla en vez de reemplazarlos.
   */
  function pedirCupos(opciones: { servicio: ServicioReservable; quien: string; desde: string; acumular?: boolean }) {
    setError(null);
    empezar(async () => {
      const respuesta = await cuposDisponibles({
        slug,
        serviceId: opciones.servicio.id,
        staffId: opciones.quien,
        desde: opciones.desde,
      });

      if (!respuesta.ok) {
        setError(respuesta.error);
        return;
      }

      const nueva = opciones.acumular
        ? { ...respuesta.ventana, dias: [...(ventana?.dias ?? []), ...respuesta.ventana.dias] }
        : respuesta.ventana;

      setVentana(nueva);
      // Se salta al primer día con horas libres. Al acumular solo si todavía no
      // había ninguno escogido: si el cliente ya estaba mirando un día, ese día
      // se queda donde está.
      setFecha((actual) => (opciones.acumular && actual ? actual : primerDiaConCupos(nueva)));
    });
  }

  function escogerServicio(nuevo: ServicioReservable) {
    setServicioId(nuevo.id);
    setQuien(CUALQUIERA);
    setElegido(null);
    setVentana(null);
    setFecha(null);
    if (nuevo.trabajadores.length > 0) pedirCupos({ servicio: nuevo, quien: CUALQUIERA, desde: hoy });
  }

  function escogerQuien(nuevo: string) {
    if (!servicio) return;
    setQuien(nuevo);
    setElegido(null);
    setVentana(null);
    pedirCupos({ servicio, quien: nuevo, desde: hoy });
  }

  const dia = ventana?.dias.find((d) => d.fecha === fecha) ?? null;
  const hayAlgunCupo = !!ventana?.dias.some((d) => d.cupos.length > 0);

  return (
    <div className="flex flex-col gap-7">
      <Paso numero={1} titulo="¿Qué te vas a hacer?">
        <ul className="flex flex-col gap-2.5">
          {catalogo.map((s) => {
            const activo = s.id === servicioId;
            const sinNadie = s.trabajadores.length === 0;

            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => !sinNadie && escogerServicio(s)}
                  aria-pressed={activo}
                  disabled={sinNadie}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[18px] border px-4 py-3.5 text-left transition',
                    activo ? 'border-tinta bg-tinta text-white' : 'border-border bg-card hover:border-input',
                    sinNadie && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-semibold">{s.nombre}</span>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[13px]',
                        activo ? 'text-[#9da29a]' : 'text-muted-foreground',
                      )}
                    >
                      <Clock className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {sinNadie ? 'Sin horarios por ahora' : duracion(s.duracionMinutos)}
                        {s.descripcion && !sinNadie && ` · ${s.descripcion}`}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-base font-bold">{pesos(s.precioCop)}</span>
                  {activo && <Check className="size-5 shrink-0 text-lima" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Paso>

      {servicio && dejaEscogerPersona && servicio.trabajadores.length > 1 && (
        <Paso numero={2} titulo="¿Con quién?">
          <ul className="flex flex-wrap gap-2">
            <li>
              <ChipPersona activo={quien === CUALQUIERA} onClick={() => escogerQuien(CUALQUIERA)}>
                <span className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Users className="size-[18px] text-muted-foreground" />
                </span>
                El primero disponible
              </ChipPersona>
            </li>
            {servicio.trabajadores.map((t) => (
              <li key={t.id}>
                <ChipPersona activo={quien === t.id} onClick={() => escogerQuien(t.id)}>
                  <AvatarTrabajador nombre={t.nombre} foto={t.fotoUrl} className="size-9" />
                  {t.nombre}
                </ChipPersona>
              </li>
            ))}
          </ul>
        </Paso>
      )}

      {servicio && (
        <Paso numero={dejaEscogerPersona && servicio.trabajadores.length > 1 ? 3 : 2} titulo="¿Cuándo?">
          {error ? (
            <Aviso>
              {error}{' '}
              <button
                type="button"
                onClick={() => pedirCupos({ servicio, quien, desde: hoy })}
                className="font-semibold text-tinta underline underline-offset-4"
              >
                Reintentar
              </button>
            </Aviso>
          ) : !ventana ? (
            <Cargando />
          ) : ventana.dias.length === 0 ? (
            <Aviso>Este negocio no está recibiendo reservas por ahora.</Aviso>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Tira de días. Se desliza con el dedo; el día sin cupos se ve pero no se toca. */}
              <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ventana.dias.map((d) => (
                  <li key={d.fecha} className="snap-start">
                    <ChipDia
                      fecha={d.fecha}
                      esHoy={d.fecha === hoy}
                      cupos={d.cupos.length}
                      activo={d.fecha === fecha}
                      onClick={() => {
                        setFecha(d.fecha);
                        setElegido(null);
                      }}
                    />
                  </li>
                ))}
                {ventana.siguienteDesde && (
                  <li className="snap-start">
                    <button
                      type="button"
                      disabled={cargando}
                      onClick={() =>
                        pedirCupos({ servicio, quien, desde: ventana.siguienteDesde!, acumular: true })
                      }
                      className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-input bg-card text-[11px] font-semibold text-muted-foreground transition hover:border-tinta hover:text-tinta disabled:opacity-50"
                    >
                      {cargando ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4 -rotate-90" />}
                      Más días
                    </button>
                  </li>
                )}
              </ul>

              {cargando && !dia ? (
                <Cargando />
              ) : !dia?.cupos.length ? (
                <Aviso>
                  {hayAlgunCupo
                    ? 'Ese día no tiene horas libres. Escoge otro.'
                    : 'No hay horas libres en estos días.'}
                  {!hayAlgunCupo && ventana.siguienteDesde && ' Toca "Más días" para buscar más adelante.'}
                </Aviso>
              ) : (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {dia.cupos.map((cupo) => {
                    const activo = elegido?.inicio === cupo.inicio && elegido.staffId === cupo.staffId;

                    return (
                      <li key={`${cupo.inicio}|${cupo.staffId}`}>
                        <button
                          type="button"
                          onClick={() => setElegido(cupo)}
                          aria-pressed={activo}
                          className={cn(
                            'h-11 w-full rounded-xl border text-[15px] font-semibold transition',
                            activo
                              ? 'border-tinta bg-tinta text-white'
                              : 'border-border bg-card text-tinta hover:border-input',
                          )}
                        >
                          {hora(timezone, cupo.inicio)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Paso>
      )}

      {servicio && elegido && (
        <Resumen
          servicio={servicio}
          cupo={elegido}
          timezone={timezone}
          // Con "el primero disponible" sí se dice a quién le tocó: la gente
          // quiere saberlo antes de confirmar, no al llegar al local.
          mostrarQuien={quien === CUALQUIERA || servicio.trabajadores.length > 1}
        />
      )}
    </div>
  );
}

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2.5 text-[22px] font-bold">
        <span className="flex size-6 items-center justify-center rounded-full bg-tinta text-xs font-bold text-lima">
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function ChipPersona({
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
        'flex items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-[15px] font-semibold transition',
        activo ? 'border-tinta bg-tinta text-white' : 'border-border bg-card text-tinta hover:border-input',
      )}
    >
      {children}
    </button>
  );
}

function ChipDia({
  fecha,
  esHoy,
  cupos,
  activo,
  onClick,
}: {
  fecha: string;
  esHoy: boolean;
  cupos: number;
  activo: boolean;
  onClick: () => void;
}) {
  const { diaSemana, numero } = partesDelDia(fecha);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cupos === 0}
      aria-pressed={activo}
      aria-label={`${diaSemana} ${numero}${cupos === 0 ? ', sin horas libres' : `, ${cupos} horas libres`}`}
      className={cn(
        'flex h-[72px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl border transition',
        activo ? 'border-tinta bg-tinta text-white' : 'border-border bg-card text-tinta hover:border-input',
        cupos === 0 && 'cursor-not-allowed border-dashed opacity-45',
      )}
    >
      <span className={cn('text-[11px] font-semibold uppercase', activo ? 'text-[#9da29a]' : 'text-tenue')}>
        {esHoy ? 'Hoy' : diaSemana}
      </span>
      <span className="font-heading text-xl font-bold">{numero}</span>
    </button>
  );
}

function Resumen({
  servicio,
  cupo,
  timezone,
  mostrarQuien,
}: {
  servicio: ServicioReservable;
  cupo: Cupo;
  timezone: string;
  mostrarQuien: boolean;
}) {
  const persona = servicio.trabajadores.find((t) => t.id === cupo.staffId);

  return (
    <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-papel from-70% to-transparent px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-[20px] bg-tinta p-3 pl-[18px] text-white">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold">
            {diaYHora(cupo.inicio, timezone)}
          </span>
          <span className="truncate text-[13px] text-[#9da29a]">
            {servicio.nombre}
            {mostrarQuien && ` · ${cupo.staffNombre}`} · {pesos(persona?.precioCop ?? servicio.precioCop)}
          </span>
        </span>
        <Button variant="acento" className="shrink-0" disabled>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function Cargando() {
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Buscando horas libres…
    </p>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{children}</p>;
}

function primerDiaConCupos(ventana: VentanaDeCupos | null): string | null {
  return ventana?.dias.find((d) => d.cupos.length > 0)?.fecha ?? null;
}

/**
 * 'mié' y '17' del chip del día.
 *
 * La fecha ya viene siendo un día del calendario del negocio, no un instante:
 * se formatea en UTC al mediodía justamente para que ni la zona del navegador
 * ni un cambio de horario la corran un día.
 */
function partesDelDia(fecha: string): { diaSemana: string; numero: string } {
  const instante = new Date(`${fecha}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).formatToParts(
    instante,
  );

  return {
    diaSemana: (partes.find((p) => p.type === 'weekday')?.value ?? '').replace('.', ''),
    numero: partes.find((p) => p.type === 'day')?.value ?? '',
  };
}

/** "mié 17 de sep · 10:30 a. m." */
function diaYHora(inicio: string, timezone: string): string {
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(inicio))
    .replace(/\./g, '')
    .replace(',', '');

  return `${fecha} · ${hora(timezone, inicio)}`;
}
