'use client';

import { Camera } from 'lucide-react';
import { useActionState, useRef, useState } from 'react';

import {
  cambiarEstadoTrabajador,
  guardarTrabajador,
  type EstadoTrabajador,
} from '@/app/(admin)/panel/equipo/actions';
import { AvatarTrabajador } from '@/components/admin/avatar-trabajador';
import { AvisoError, Campo, CLASES_CONTROL } from '@/components/admin/campo';
import { Button } from '@/components/ui/button';
import { BUCKET_FOTOS } from '@/lib/fotos';
import { duracion } from '@/lib/formato';
import { enviarSinReiniciar } from '@/lib/formularios';
import { reducirImagen } from '@/lib/imagenes';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { carpetaEquipo, NOMBRE_TRABAJADOR_MAX, PERFIL_MAX } from '@/lib/validation/trabajador';

export type TrabajadorInicial = {
  /** null al crear. */
  id: string | null;
  nombre: string;
  celular: string;
  perfil: string;
  foto: string | null;
  activo: boolean;
  servicios: string[];
};

export type ServicioParaMarcar = { id: string; nombre: string; duracionMinutos: number; color: string };

const INICIAL: EstadoTrabajador = { error: null, campos: {} };

/** Una foto de perfil se ve pequeña: 600 px sobran y pesa unos 60 KB. */
const LADO_FOTO_PX = 600;

/** Crear y editar a una persona del equipo y los servicios que presta (D1 y D2). */
export function FormularioTrabajador({
  businessId,
  inicial,
  servicios,
  citasProximas,
}: {
  /** De la sesión, vía requireDueno(). La política de Storage lo vuelve a verificar. */
  businessId: string;
  inicial: TrabajadorInicial;
  /** Solo los servicios activos: los demás no se pueden reservar. */
  servicios: ServicioParaMarcar[];
  /** null si no se pudo saber. */
  citasProximas: number | null;
}) {
  const [estado, guardar, guardando] = useActionState(guardarTrabajador, INICIAL);
  const [estadoActivo, cambiarEstado, cambiando] = useActionState(cambiarEstadoTrabajador, INICIAL);

  const [nombre, setNombre] = useState(inicial.nombre);
  const [celular, setCelular] = useState(inicial.celular);
  const [perfil, setPerfil] = useState(inicial.perfil);
  const [foto, setFoto] = useState(inicial.foto);
  const [marcados, setMarcados] = useState(() => new Set(inicial.servicios));
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  // Si la persona ya quedó creada en un intento anterior, reintentar edita.
  const id = estado.idCreado ?? inicial.id;
  const ocupado = guardando || cambiando || subiendo;
  const error = estado.error ?? estadoActivo.error;
  const todos = servicios.length > 0 && servicios.every((s) => marcados.has(s.id));

  async function subirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setErrorFoto(null);
    setSubiendo(true);
    try {
      const blob = await reducirImagen(archivo, LADO_FOTO_PX);
      const ruta = `${carpetaEquipo(businessId)}/${crypto.randomUUID()}.jpg`;
      const { error: eSubida } = await createClient()
        .storage.from(BUCKET_FOTOS)
        .upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (eSubida) throw eSubida;
      setFoto(ruta);
    } catch (e) {
      console.error('[equipo] no se pudo subir la foto:', e instanceof Error ? e.message : e);
      setErrorFoto('No se pudo subir la foto. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSubiendo(false);
      if (inputFoto.current) inputFoto.current.value = '';
    }
  }

  function alternar(servicioId: string) {
    setMarcados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(servicioId)) nuevo.delete(servicioId);
      else nuevo.add(servicioId);
      return nuevo;
    });
  }

  return (
    <form onSubmit={enviarSinReiniciar(guardar, { estado: cambiarEstado })} noValidate className="flex flex-1 flex-col">
      <input type="hidden" name="id" value={id ?? ''} />
      <input type="hidden" name="foto" value={foto ?? ''} />

      <div className="flex flex-col gap-5 p-[18px] lg:px-6 lg:py-5">
        <div className="flex items-center gap-4">
          <AvatarTrabajador nombre={nombre} foto={foto} className="size-[72px] text-xl" />
          <div className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap gap-1">
              <label
                className={cn(
                  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-semibold transition hover:bg-muted has-focus-visible:ring-4 has-focus-visible:ring-lima/40',
                  subiendo && 'cursor-wait opacity-60',
                )}
              >
                <input
                  ref={inputFoto}
                  type="file"
                  accept="image/*"
                  disabled={ocupado}
                  onChange={(e) => subirFoto(e.target.files?.[0])}
                  className="sr-only"
                />
                <Camera className="size-4" />
                {subiendo ? 'Subiendo…' : foto ? 'Cambiar foto' : 'Subir foto'}
              </label>
              {foto && !subiendo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFoto(null)}>
                  Quitar
                </Button>
              )}
            </div>
            <span className="text-[13px] text-muted-foreground">Opcional. Aparece en tu página.</span>
            {errorFoto && <span className="text-[13px] text-destructive">{errorFoto}</span>}
            {estado.campos.foto && <span className="text-[13px] text-destructive">{estado.campos.foto}</span>}
          </div>
        </div>

        <Campo
          name="nombre"
          etiqueta="Nombre"
          required
          maxLength={NOMBRE_TRABAJADOR_MAX}
          autoComplete="off"
          placeholder="Andrés Gómez"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={estado.campos.nombre}
        />

        <Campo
          name="celular"
          etiqueta="Celular · opcional"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="300 123 4567"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          ayuda="Solo lo ves tú, no aparece en tu página."
          error={estado.campos.celular}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="perfil" className="text-sm font-semibold">
            Perfil <span className="font-normal text-tenue">· opcional</span>
          </label>
          <textarea
            id="perfil"
            name="perfil"
            rows={2}
            maxLength={PERFIL_MAX}
            placeholder="Especialista en degradados y barba"
            value={perfil}
            onChange={(e) => setPerfil(e.target.value)}
            aria-invalid={estado.campos.perfil ? true : undefined}
            className={cn(CLASES_CONTROL, 'h-auto resize-none py-3')}
          />
          {estado.campos.perfil && <p className="text-[13px] text-destructive">{estado.campos.perfil}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 flex w-full items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">Servicios que presta</span>
            {servicios.length > 1 && (
              <button
                type="button"
                onClick={() => setMarcados(new Set(todos ? [] : servicios.map((s) => s.id)))}
                className="text-[13px] font-semibold text-muted-foreground underline-offset-4 hover:text-tinta hover:underline"
              >
                {todos ? 'Quitar todos' : 'Marcar todos'}
              </button>
            )}
          </legend>

          {servicios.length === 0 ? (
            <p className="rounded-xl bg-papel px-3.5 py-3 text-[13px] text-muted-foreground">
              No tienes servicios activos. Créalos en Servicios y vuelve a marcarlos aquí.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-xl border border-input">
              {servicios.map((s) => (
                <li key={s.id}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5 transition hover:bg-muted/60 has-focus-visible:bg-lima/15">
                    <input
                      type="checkbox"
                      name="servicios"
                      value={s.id}
                      checked={marcados.has(s.id)}
                      onChange={() => alternar(s.id)}
                      className="size-[18px] shrink-0 accent-tinta"
                    />
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-[4px]" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{s.nombre}</span>
                    <span className="shrink-0 text-[13px] text-muted-foreground">{duracion(s.duracionMinutos)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {servicios.length > 0 && marcados.size === 0 && (
            <p className="text-[13px] text-estado-espera">Sin servicios marcados, nadie podrá reservar con esta persona.</p>
          )}
        </fieldset>

        {error && <AvisoError>{error}</AvisoError>}

        {/* En celular va al final del formulario: la barra fija solo lleva Guardar. */}
        {inicial.id && (
          <div className="flex flex-col items-start gap-1 border-t border-linea pt-4 sm:hidden">
            <BotonEstado activo={inicial.activo} cambiando={cambiando} disabled={ocupado} />
            <AvisoCitas activo={inicial.activo} citasProximas={citasProximas} />
          </div>
        )}
      </div>

      {inicial.id && <input type="hidden" name="activo" value={inicial.activo ? 'false' : 'true'} />}

      <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] mt-auto flex flex-col gap-2 rounded-b-[20px] border-t border-linea bg-card px-[18px] py-3 lg:bottom-0 lg:px-6 lg:py-4">
        <div className="flex items-center justify-between gap-2">
          {inicial.id ? (
            <span className="hidden sm:block">
              <BotonEstado activo={inicial.activo} cambiando={cambiando} disabled={ocupado} />
            </span>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="submit" size="lg" disabled={ocupado} className="w-full sm:w-auto sm:px-7">
            {guardando ? 'Guardando…' : id ? 'Guardar cambios' : 'Agregar al equipo'}
          </Button>
        </div>
        {inicial.id && (
          <span className="hidden sm:block">
            <AvisoCitas activo={inicial.activo} citasProximas={citasProximas} />
          </span>
        )}
      </div>
    </form>
  );
}

function BotonEstado({
  activo,
  cambiando,
  disabled,
}: {
  activo: boolean;
  cambiando: boolean;
  disabled: boolean;
}) {
  return (
    <Button type="submit" variant={activo ? 'destructive' : 'outline'} data-accion="estado" disabled={disabled}>
      {cambiando ? 'Un momento…' : activo ? 'Desactivar' : 'Reactivar'}
    </Button>
  );
}

/** Antes de desactivar: las citas que ya tiene no se cancelan solas. */
function AvisoCitas({ activo, citasProximas }: { activo: boolean; citasProximas: number | null }) {
  if (!activo) return null;
  if (citasProximas === null || citasProximas === 0) {
    return <p className="text-[13px] text-muted-foreground">Al desactivar deja de aparecer en tu página.</p>;
  }
  return (
    <p className="text-[13px] text-estado-espera">
      Tiene {citasProximas} {citasProximas === 1 ? 'cita agendada' : 'citas agendadas'} desde hoy. Si la desactivas, esas
      citas se mantienen: tendrás que moverlas o cancelarlas tú.
    </p>
  );
}
