'use client';

import { Check } from 'lucide-react';
import { useActionState, useState } from 'react';

import { cambiarEstadoServicio, guardarServicio, type EstadoServicio } from '@/app/(admin)/panel/servicios/actions';
import { AvisoError, Campo, CLASES_CONTROL } from '@/components/admin/campo';
import { Button } from '@/components/ui/button';
import { COLORES_SERVICIO } from '@/lib/colores';
import { duracion as textoDuracion, pesos } from '@/lib/formato';
import { cn } from '@/lib/utils';
import {
  DESCRIPCION_MAX,
  DURACION_MAX,
  DURACION_MIN,
  DURACIONES_SUGERIDAS,
  formatearPrecio,
  leerPrecio,
  NOMBRE_MAX,
} from '@/lib/validation/servicio';

export type ServicioInicial = {
  /** null al crear. */
  id: string | null;
  nombre: string;
  descripcion: string;
  duracionMinutos: number;
  /** null al crear: el campo arranca vacío, no en $0. */
  precioCop: number | null;
  color: string;
  activo: boolean;
};

const INICIAL: EstadoServicio = { error: null, campos: {} };

const CLASES_CHIP =
  'flex h-10 cursor-pointer items-center rounded-full border border-input px-3.5 text-sm transition peer-checked:border-tinta peer-checked:bg-tinta peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-lima/40 hover:border-tinta';

/** Crear y editar un servicio (tarea C1). Maqueta en docs/15-sistema-de-diseno.md. */
export function FormularioServicio({ inicial }: { inicial: ServicioInicial }) {
  const [estado, guardar, guardando] = useActionState(guardarServicio, INICIAL);
  const [estadoActivo, cambiarEstado, cambiando] = useActionState(cambiarEstadoServicio, INICIAL);

  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [minutos, setMinutos] = useState(String(inicial.duracionMinutos));
  const [otra, setOtra] = useState(!(DURACIONES_SUGERIDAS as readonly number[]).includes(inicial.duracionMinutos));
  const [precio, setPrecio] = useState(inicial.precioCop === null ? '' : formatearPrecio(inicial.precioCop));
  const [color, setColor] = useState(inicial.color);

  const ocupado = guardando || cambiando;
  const error = estado.error ?? estadoActivo.error;

  // Vista previa: solo lo que ya se entiende, sin inventar valores.
  const minutosPrevia = Number(minutos);
  const precioPrevia = leerPrecio(precio);

  function escribirPrecio(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 9);
    setPrecio(digitos === '' ? '' : formatearPrecio(Number(digitos)));
  }

  return (
    <form action={guardar} noValidate className="flex flex-1 flex-col">
      <input type="hidden" name="id" value={inicial.id ?? ''} />

      <div className="flex flex-col gap-5 p-[18px] lg:px-6 lg:py-5">
        <Campo
          name="nombre"
          etiqueta="Nombre"
          required
          maxLength={NOMBRE_MAX}
          placeholder="Corte de cabello"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={estado.campos.nombre}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="descripcion" className="text-sm font-semibold">
            Descripción <span className="font-normal text-tenue">· opcional</span>
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            maxLength={DESCRIPCION_MAX}
            placeholder="Lavado, corte y peinado"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            aria-invalid={estado.campos.descripcion ? true : undefined}
            className={cn(CLASES_CONTROL, 'h-auto resize-none py-3')}
          />
          {estado.campos.descripcion && <p className="text-[13px] text-destructive">{estado.campos.descripcion}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Duración</legend>
          <input type="hidden" name="duracion" value={minutos} />
          <div className="flex flex-wrap gap-2">
            {DURACIONES_SUGERIDAS.map((m) => (
              <label key={m}>
                <input
                  type="radio"
                  name="duracionOpcion"
                  value={m}
                  checked={!otra && minutos === String(m)}
                  onChange={() => {
                    setOtra(false);
                    setMinutos(String(m));
                  }}
                  className="peer sr-only"
                />
                <span className={CLASES_CHIP}>{textoDuracion(m)}</span>
              </label>
            ))}
            <label>
              <input
                type="radio"
                name="duracionOpcion"
                value="otra"
                checked={otra}
                onChange={() => setOtra(true)}
                className="peer sr-only"
              />
              <span className={cn(CLASES_CHIP, 'border-dashed text-muted-foreground')}>Otra</span>
            </label>
          </div>
          {otra && (
            <div className="flex items-center gap-2.5">
              <label htmlFor="duracionOtra" className="sr-only">
                Duración en minutos
              </label>
              <input
                id="duracionOtra"
                type="number"
                inputMode="numeric"
                min={DURACION_MIN}
                max={DURACION_MAX}
                step={5}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                aria-invalid={estado.campos.duracion ? true : undefined}
                className={cn(CLASES_CONTROL, 'w-28')}
              />
              <span className="text-sm text-muted-foreground">
                minutos
                {minutosPrevia >= 60 && minutosPrevia <= DURACION_MAX && ` · ${textoDuracion(minutosPrevia)}`}
              </span>
            </div>
          )}
          {estado.campos.duracion ? (
            <p className="text-[13px] text-destructive">{estado.campos.duracion}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Incluye el tiempo de preparación o limpieza, si lo necesitas.
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio" className="text-sm font-semibold">
            Precio
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tenue">$</span>
            <input
              id="precio"
              name="precio"
              inputMode="numeric"
              autoComplete="off"
              placeholder="30.000"
              value={precio}
              onChange={(e) => escribirPrecio(e.target.value)}
              aria-invalid={estado.campos.precio ? true : undefined}
              aria-describedby={estado.campos.precio ? 'precio-error' : undefined}
              className={cn(CLASES_CONTROL, 'pl-8 font-heading text-lg font-semibold')}
            />
          </div>
          {estado.campos.precio && (
            <p id="precio-error" className="text-[13px] text-destructive">
              {estado.campos.precio}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Color en la agenda</legend>
          <div className="flex flex-wrap gap-2.5">
            {COLORES_SERVICIO.map((c) => (
              <label key={c.valor} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c.valor}
                  checked={color === c.valor}
                  onChange={() => setColor(c.valor)}
                  className="peer sr-only"
                />
                <span
                  title={c.nombre}
                  className="flex size-9 items-center justify-center rounded-[11px] text-white ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-tinta peer-focus-visible:ring-4 peer-focus-visible:ring-lima"
                  style={{ background: c.valor }}
                >
                  {color === c.valor && <Check className="size-4" strokeWidth={2.6} />}
                  <span className="sr-only">{c.nombre}</span>
                </span>
              </label>
            ))}
          </div>
          {estado.campos.color && <p className="text-[13px] text-destructive">{estado.campos.color}</p>}
        </fieldset>

        <div className="flex flex-col gap-2 rounded-2xl bg-papel px-4 py-3.5">
          <span className="text-xs font-semibold tracking-[0.06em] text-tenue uppercase">Así lo ve tu cliente</span>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold">{nombre.trim() || 'Nombre del servicio'}</span>
              <span className="truncate text-[13px] text-muted-foreground">
                {minutosPrevia >= DURACION_MIN && minutosPrevia <= DURACION_MAX ? textoDuracion(minutosPrevia) : '—'}
                {descripcion.trim() && ` · ${descripcion.trim()}`}
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold">
              {typeof precioPrevia === 'number' ? pesos(precioPrevia) : '—'}
            </span>
          </div>
        </div>

        {error && <AvisoError>{error}</AvisoError>}

        {/* En celular va al final del formulario: la barra fija solo lleva Guardar. */}
        {inicial.id && (
          <div className="flex flex-col items-start gap-1 border-t border-linea pt-4 sm:hidden">
            <BotonEstado activo={inicial.activo} accion={cambiarEstado} cambiando={cambiando} disabled={ocupado} />
            {inicial.activo && (
              <p className="text-[13px] text-muted-foreground">
                Deja de aparecer en tu página. Las citas ya agendadas se mantienen.
              </p>
            )}
          </div>
        )}
      </div>

      {inicial.id && <input type="hidden" name="activo" value={inicial.activo ? 'false' : 'true'} />}

      {/*
        En celular queda pegado encima de la barra de navegación inferior, como
        en Perfil del negocio.
      */}
      <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] mt-auto flex items-center justify-between gap-2 rounded-b-[20px] border-t border-linea bg-card px-[18px] py-3 lg:bottom-0 lg:px-6 lg:py-4">
        {inicial.id ? (
          <span className="hidden sm:block">
            <BotonEstado activo={inicial.activo} accion={cambiarEstado} cambiando={cambiando} disabled={ocupado} />
          </span>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button type="submit" size="lg" disabled={ocupado} className="w-full sm:w-auto sm:px-7">
          {guardando ? 'Guardando…' : inicial.id ? 'Guardar cambios' : 'Crear servicio'}
        </Button>
      </div>
    </form>
  );
}

function BotonEstado({
  activo,
  accion,
  cambiando,
  disabled,
}: {
  activo: boolean;
  accion: (formData: FormData) => void;
  cambiando: boolean;
  disabled: boolean;
}) {
  return (
    <Button type="submit" variant={activo ? 'destructive' : 'outline'} formAction={accion} disabled={disabled}>
      {cambiando ? 'Un momento…' : activo ? 'Desactivar servicio' : 'Reactivar servicio'}
    </Button>
  );
}
