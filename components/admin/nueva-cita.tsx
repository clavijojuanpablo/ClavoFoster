'use client';

import { AlertTriangle, Loader2, UserCheck, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import {
  buscarClienteParaCita,
  crearCitaDesdePanel,
  cuposParaNuevaCita,
} from '@/app/(admin)/panel/agenda/actions';
import { AvisoError, CLASES_CONTROL, Campo } from '@/components/admin/campo';
import { Button } from '@/components/ui/button';
import type { ServicioReservable } from '@/lib/booking/tipos';
import { duracion, pesos } from '@/lib/formato';
import type { ClienteConocido, CupoSugerido } from '@/lib/panel/nueva-cita';
import { NOMBRE_CLIENTE_MAX, NOTA_INTERNA_MAX } from '@/lib/validation/nueva-cita';
import { cn } from '@/lib/utils';

/**
 * Agendar desde el panel (G3): el que llama por teléfono y el que llega sin cita.
 *
 * Sale como hoja, igual que el detalle de la cita, porque se usa en el local
 * con el cliente al frente. Las horas libres se sugieren, pero la hora se puede
 * escribir a mano: el que llega a las 3:07 no espera a las 3:30. Lo único que
 * no deja pasar el servidor es poner a una persona en dos citas a la vez.
 */

type Origen = 'manual' | 'walk_in';

type EstadoCliente =
  | { tipo: 'sin-buscar' }
  | { tipo: 'buscando' }
  | { tipo: 'conocido'; cliente: ClienteConocido }
  | { tipo: 'nuevo' };

type EstadoCupos = { tipo: 'cargando' } | { tipo: 'listo'; cupos: CupoSugerido[] } | { tipo: 'error'; mensaje: string };

export function NuevaCita({
  catalogo,
  timezone,
  hoy,
  fechaInicial,
  personaInicial,
  onCerrar,
  onCreada,
}: {
  catalogo: ServicioReservable[];
  timezone: string;
  hoy: string;
  fechaInicial: string;
  /** La persona que se está mirando en la agenda, si hay una sola. */
  personaInicial: string | null;
  onCerrar: () => void;
  onCreada: (fecha: string) => void;
}) {
  const agendables = catalogo.filter((s) => s.trabajadores.length > 0);
  const primero =
    agendables.find((s) => s.trabajadores.some((t) => t.id === personaInicial)) ?? agendables[0] ?? null;

  const [origen, setOrigen] = useState<Origen>('manual');
  const [serviceId, setServiceId] = useState(primero?.id ?? '');
  const [staffId, setStaffId] = useState(
    primero?.trabajadores.find((t) => t.id === personaInicial)?.id ?? primero?.trabajadores[0]?.id ?? '',
  );
  const [fecha, setFecha] = useState(fechaInicial < hoy ? hoy : fechaInicial);
  const [hora, setHora] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [nota, setNota] = useState('');

  const [cliente, setCliente] = useState<EstadoCliente>({ tipo: 'sin-buscar' });
  const [respuestaCupos, setRespuestaCupos] = useState<{ busqueda: string; estado: EstadoCupos } | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const servicio = agendables.find((s) => s.id === serviceId) ?? null;

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  // Las horas libres se vuelven a pedir cada vez que cambia qué, quién o
  // cuándo. La respuesta se guarda con la búsqueda que la pidió: si no es la de
  // ahora, lo que hay en pantalla es "cargando", sin un estado aparte que
  // sincronizar. `vigente` descarta la respuesta de una búsqueda que ya no aplica.
  const busqueda = `${serviceId}|${staffId}|${fecha}|${recargar}`;
  const cupos: EstadoCupos = respuestaCupos?.busqueda === busqueda ? respuestaCupos.estado : { tipo: 'cargando' };

  useEffect(() => {
    if (!serviceId || !staffId || !fecha) return;
    let vigente = true;

    cuposParaNuevaCita({ serviceId, staffId, fecha }).then((r) => {
      if (!vigente) return;
      setRespuestaCupos({
        busqueda,
        estado: r.ok ? { tipo: 'listo', cupos: r.cupos } : { tipo: 'error', mensaje: r.error },
      });
    });

    return () => {
      vigente = false;
    };
  }, [serviceId, staffId, fecha, busqueda]);

  function escogerServicio(id: string) {
    setServiceId(id);
    const nuevo = agendables.find((s) => s.id === id);
    // Si la persona escogida no presta el servicio nuevo, se pasa a la primera que sí.
    if (nuevo && !nuevo.trabajadores.some((t) => t.id === staffId)) setStaffId(nuevo.trabajadores[0]?.id ?? '');
    setHora('');
  }

  function escogerOrigen(nuevo: Origen) {
    setOrigen(nuevo);
    // El que llegó sin cita se atiende hoy, casi siempre ya.
    if (nuevo === 'walk_in') {
      setFecha(hoy);
      setHora(relojAhora(timezone));
    }
  }

  function buscarCliente() {
    if (telefono.replace(/\D/g, '').length < 7) return;
    setCliente({ tipo: 'buscando' });

    buscarClienteParaCita({ telefono }).then((r) => {
      if (!r.ok) {
        setCliente({ tipo: 'sin-buscar' });
        setCampos((c) => ({ ...c, telefono: r.error }));
        return;
      }
      setCampos((c) => {
        const resto = { ...c };
        delete resto.telefono;
        return resto;
      });
      setCliente(r.cliente ? { tipo: 'conocido', cliente: r.cliente } : { tipo: 'nuevo' });
    });
  }

  function agendar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const faltan: Record<string, string> = {};
    if (!hora) faltan.hora = 'Escoge una hora o escríbela';
    if (telefono.trim().length < 7) faltan.telefono = 'Escribe el celular del cliente';
    if (cliente.tipo !== 'conocido' && !nombre.trim()) faltan.nombre = 'Escribe el nombre del cliente';
    setCampos(faltan);
    if (Object.keys(faltan).length > 0) return;

    empezar(async () => {
      const r = await crearCitaDesdePanel({ serviceId, staffId, fecha, hora, telefono, nombre, nota, origen });
      if (r.ok) {
        onCreada(fecha);
        return;
      }
      setError(r.error);
      setCampos(r.campos);
      if (r.cupoOcupado) setRecargar((n) => n + 1);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva cita"
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Nueva cita</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-tinta"
          >
            <X className="size-5" />
          </button>
        </header>

        {!servicio ? (
          <p className="rounded-2xl bg-muted/60 p-4 text-[15px]">
            Todavía no hay servicios que alguien de tu equipo preste. Agrégalos en Servicios y asígnalos en
            Equipo para poder agendar.
          </p>
        ) : (
          <form onSubmit={agendar} noValidate className="flex flex-col gap-5">
            <div className="flex gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Cómo llegó">
              {(
                [
                  ['manual', 'Llamó o escribió'],
                  ['walk_in', 'Llegó sin cita'],
                ] as const
              ).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={origen === valor}
                  onClick={() => escogerOrigen(valor)}
                  className={cn(
                    'h-9 flex-1 rounded-full text-sm transition',
                    origen === valor
                      ? 'bg-card font-semibold text-tinta shadow-[0_1px_2px_rgba(18,20,18,.08)]'
                      : 'text-muted-foreground hover:text-tinta',
                  )}
                >
                  {texto}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="servicio" className="text-sm font-semibold">
                Servicio
              </label>
              <select
                id="servicio"
                value={serviceId}
                onChange={(e) => escogerServicio(e.target.value)}
                className={CLASES_CONTROL}
              >
                {agendables.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {duracion(s.duracionMinutos)} · {pesos(s.precioCop)}
                  </option>
                ))}
              </select>
            </div>

            {servicio.trabajadores.length > 1 && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold">Quién atiende</legend>
                <div className="flex flex-wrap gap-2">
                  {servicio.trabajadores.map((t) => (
                    <Chip
                      key={t.id}
                      activo={t.id === staffId}
                      onClick={() => {
                        setStaffId(t.id);
                        setHora('');
                      }}
                    >
                      {t.nombre}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo
                name="fecha"
                etiqueta="Día"
                type="date"
                value={fecha}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setFecha(e.target.value);
                  setHora('');
                }}
              />
              <Campo
                name="hora"
                etiqueta="Hora"
                type="time"
                step={60}
                value={hora}
                error={campos.hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>

            <HorasLibres cupos={cupos} escogida={hora} onEscoger={setHora} />

            <div className="flex flex-col gap-3">
              <Campo
                name="telefono"
                etiqueta="Celular del cliente"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="300 123 4567"
                value={telefono}
                error={campos.telefono}
                onChange={(e) => {
                  setTelefono(e.target.value);
                  setCliente({ tipo: 'sin-buscar' });
                }}
                onBlur={buscarCliente}
              />

              {cliente.tipo === 'buscando' && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando cliente...
                </p>
              )}

              {cliente.tipo === 'conocido' ? (
                <ClienteQueVuelve cliente={cliente.cliente} />
              ) : (
                <Campo
                  name="nombre"
                  etiqueta="Nombre"
                  autoComplete="off"
                  maxLength={NOMBRE_CLIENTE_MAX}
                  value={nombre}
                  error={campos.nombre}
                  ayuda={cliente.tipo === 'nuevo' ? 'Es la primera vez que viene.' : undefined}
                  onChange={(e) => setNombre(e.target.value)}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="nota" className="text-sm font-semibold">
                Nota interna <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                id="nota"
                rows={2}
                maxLength={NOTA_INTERNA_MAX}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                aria-invalid={campos.nota ? true : undefined}
                className={cn(CLASES_CONTROL, 'h-auto py-3')}
              />
              <p className="text-[13px] text-muted-foreground">
                {campos.nota ?? 'Solo la ve tu equipo, el cliente no.'}
              </p>
            </div>

            {error && <AvisoError>{error}</AvisoError>}

            <div className="flex flex-col gap-2">
              <Button type="submit" variant="acento" size="lg" disabled={trabajando}>
                {trabajando && <Loader2 className="size-[18px] animate-spin" />}
                {trabajando ? 'Agendando...' : 'Agendar cita'}
              </Button>
              {origen === 'manual' && (
                <p className="text-center text-[13px] text-muted-foreground">
                  Le llega la confirmación por WhatsApp con su link para mover o cancelar.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function HorasLibres({
  cupos,
  escogida,
  onEscoger,
}: {
  cupos: EstadoCupos;
  escogida: string;
  onEscoger: (reloj: string) => void;
}) {
  if (cupos.tipo === 'cargando') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Buscando horas libres...
      </p>
    );
  }

  if (cupos.tipo === 'error') return <p className="text-sm text-muted-foreground">{cupos.mensaje}. Escribe la hora a mano.</p>;

  if (cupos.cupos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No quedan horas libres ese día en el horario. Si igual la vas a atender, escribe la hora a mano.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-tenue uppercase">Horas libres</span>
      <div className="flex flex-wrap gap-2">
        {cupos.cupos.map((c) => (
          <Chip key={c.reloj} activo={c.reloj === escogida} onClick={() => onEscoger(c.reloj)}>
            {c.etiqueta}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ClienteQueVuelve({ cliente }: { cliente: ClienteConocido }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-4 text-[15px]">
      <span className="flex items-center gap-2 font-semibold">
        <UserCheck className="size-[18px]" />
        {cliente.nombre}
      </span>
      {cliente.bloqueado && (
        <span className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Está bloqueado para reservar en línea. Si lo agendas tú, la cita queda.
        </span>
      )}
      {cliente.noAsistio > 0 && (
        <span className="flex items-start gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {cliente.noAsistio === 1 ? 'No llegó a una cita antes.' : `No llegó a ${cliente.noAsistio} citas antes.`}
        </span>
      )}
    </div>
  );
}

function Chip({
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
        'h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
        activo ? 'border-tinta bg-tinta text-white' : 'border-border bg-card text-tinta hover:border-input',
      )}
    >
      {children}
    </button>
  );
}

/** La hora de reloj de ahora en la zona del negocio, 'HH:MM'. Solo corre en el navegador, al tocar. */
function relojAhora(timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
}
