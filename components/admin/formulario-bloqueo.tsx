'use client';

import { ChevronDown } from 'lucide-react';
import { useActionState, useState } from 'react';

import { crearBloqueo, type EstadoBloqueo } from '@/app/(admin)/panel/equipo/ausencias/actions';
import { AvisoError, Campo, CLASES_CONTROL } from '@/components/admin/campo';
import { Button } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import { fechaCorta, hora } from '@/lib/formato';
import { enviarSinReiniciar } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { MOTIVO_MAX } from '@/lib/validation/bloqueo';

const INICIAL: EstadoBloqueo = { error: null, campos: {}, porConfirmar: null };

const CLASES_CHIP =
  'flex h-10 cursor-pointer items-center rounded-full border border-input px-4 text-sm transition peer-checked:border-tinta peer-checked:bg-tinta peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-lima/40 hover:border-tinta';

/** Nuevo bloqueo o ausencia (D4): de una persona o del local, por horas o por días. */
export function FormularioBloqueo({
  personas,
  timezone,
  hoy,
}: {
  personas: { id: string; nombre: string }[];
  timezone: string;
  /** 'YYYY-MM-DD' en la zona del negocio. */
  hoy: string;
}) {
  const [estado, crear, creando] = useActionState(crearBloqueo, INICIAL);
  const [tipo, setTipo] = useState<'horas' | 'dias'>('horas');
  const [quien, setQuien] = useState(personas[0]?.id ?? 'local');
  const [fecha, setFecha] = useState(hoy);
  const [desde, setDesde] = useState('12:00');
  const [hasta, setHasta] = useState('14:00');
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [motivo, setMotivo] = useState('');
  // Cualquier cambio después de ver las citas invalida la confirmación: se
  // vuelve a revisar el rango nuevo antes de guardar.
  const [confirmacionVigente, setConfirmacionVigente] = useState(false);

  const porConfirmar = confirmacionVigente ? estado.porConfirmar : null;

  function cambio<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setConfirmacionVigente(false);
    };
  }

  return (
    <Tarjeta className="flex flex-col gap-4 p-[18px] lg:p-6">
      <h2 className="text-lg font-bold">Nuevo bloqueo</h2>

      <form
        onSubmit={(e) => {
          setConfirmacionVigente(true);
          enviarSinReiniciar(crear)(e);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="tipo" value={tipo} />
        {porConfirmar && <input type="hidden" name="confirmado" value={porConfirmar.firma} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="quien" className="text-sm font-semibold">
            Quién no atiende
          </label>
          <div className="relative">
            <select
              id="quien"
              name="quien"
              value={quien}
              onChange={(e) => cambio(setQuien)(e.target.value)}
              className={cn(CLASES_CONTROL, 'appearance-none pr-10')}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
              <option value="local">Todo el local (cerrado)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
          </div>
          {estado.campos.quien && <p className="text-[13px] text-destructive">{estado.campos.quien}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Cuánto tiempo</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['horas', 'Unas horas'],
                ['dias', 'Días completos'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <label key={valor}>
                <input
                  type="radio"
                  name="tipoOpcion"
                  checked={tipo === valor}
                  onChange={() => cambio(setTipo)(valor)}
                  className="peer sr-only"
                />
                <span className={CLASES_CHIP}>{etiqueta}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {tipo === 'horas' ? (
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Campo
              name="fecha"
              etiqueta="Día"
              type="date"
              min={hoy}
              value={fecha}
              onChange={(e) => cambio(setFecha)(e.target.value)}
              error={estado.campos.fecha}
            />
            <Campo
              name="desde"
              etiqueta="Desde"
              type="time"
              step={300}
              value={desde}
              onChange={(e) => cambio(setDesde)(e.target.value)}
              error={estado.campos.desde}
            />
            <Campo
              name="hasta"
              etiqueta="Hasta"
              type="time"
              step={300}
              value={hasta}
              onChange={(e) => cambio(setHasta)(e.target.value)}
              error={estado.campos.hasta}
            />
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo
              name="fechaDesde"
              etiqueta="Primer día"
              type="date"
              min={hoy}
              value={fechaDesde}
              onChange={(e) => {
                cambio(setFechaDesde)(e.target.value);
                if (fechaHasta < e.target.value) setFechaHasta(e.target.value);
              }}
              error={estado.campos.fechaDesde}
            />
            <Campo
              name="fechaHasta"
              etiqueta="Último día"
              type="date"
              min={fechaDesde}
              value={fechaHasta}
              onChange={(e) => cambio(setFechaHasta)(e.target.value)}
              ayuda="Incluido: ese día tampoco se atiende."
              error={estado.campos.fechaHasta}
            />
          </div>
        )}

        <Campo
          name="motivo"
          etiqueta="Motivo · opcional"
          maxLength={MOTIVO_MAX}
          placeholder="Vacaciones, cita médica, festivo…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          ayuda="Solo lo ves tú."
          error={estado.campos.motivo}
        />

        {estado.error && <AvisoError>{estado.error}</AvisoError>}

        {porConfirmar && (
          <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-estado-espera-fondo p-4">
            <p className="text-[15px] font-semibold">
              {porConfirmar.citas.length === 1
                ? 'Hay una cita agendada en ese rango'
                : `Hay ${porConfirmar.citas.length} citas agendadas en ese rango`}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Si bloqueas, esas citas <strong className="font-semibold text-tinta">no se cancelan</strong>: tendrás que
              moverlas o avisarle a cada cliente.
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {porConfirmar.citas.slice(0, 10).map((c) => (
                <li key={c.id}>
                  {fechaCorta(timezone, new Date(c.inicio))}, {hora(timezone, c.inicio)} · {c.cliente} · {c.servicio}
                  {quien === 'local' && c.trabajador && ` · ${c.trabajador}`}
                </li>
              ))}
              {porConfirmar.citas.length > 10 && (
                <li className="text-muted-foreground">y {porConfirmar.citas.length - 10} más</li>
              )}
            </ul>
          </div>
        )}

        <Button type="submit" size="lg" disabled={creando} className="w-full sm:w-auto sm:self-end">
          {creando ? 'Revisando…' : porConfirmar ? 'Bloquear de todas formas' : 'Bloquear'}
        </Button>
      </form>
    </Tarjeta>
  );
}
