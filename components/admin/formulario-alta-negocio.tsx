'use client';

import { useActionState, useEffect, useState } from 'react';

import {
  crearNegocio,
  verificarSlug,
  type DisponibilidadSlug,
  type EstadoAltaNegocio,
} from '@/app/(admin)/bienvenida/actions';
import { AvisoError, Campo, CLASES_BOTON_PRIMARIO } from '@/components/admin/campo';
import { CATEGORIAS, SLUG_MAX, sugerirSlug } from '@/lib/validation/negocio';

type Props = {
  /** Lo que escribió al registrarse, guardado en los metadatos del usuario. */
  nombreInicial: string;
  celularInicial: string;
  /** Dominio que se muestra delante del link, ej. "clavo-foster.vercel.app". */
  dominio: string;
};

export function FormularioAltaNegocio({ nombreInicial, celularInicial, dominio }: Props) {
  const inicial: EstadoAltaNegocio = {
    error: null,
    campos: {},
    valores: {
      nombreNegocio: nombreInicial,
      celular: celularInicial,
      categoria: '',
      slug: sugerirSlug(nombreInicial),
    },
  };

  const [estado, accion, enviando] = useActionState(crearNegocio, inicial);

  // El link se sugiere desde el nombre mientras el dueño no lo toque. En cuanto
  // lo edita a mano, se respeta lo que escribió.
  const [slug, setSlug] = useState(estado.valores.slug);
  const [slugEditado, setSlugEditado] = useState(false);
  const disponibilidad = useDisponibilidadSlug(slug);

  // Un error del envío manda sobre la revisión en vivo, pero solo mientras el
  // slug siga siendo el que se envió. Si lo cambia, vuelve a mandar la revisión.
  const errorEnvioSlug = slug === estado.valores.slug ? estado.campos.slug : undefined;

  const usarSlug = (nuevo: string) => {
    setSlugEditado(true);
    setSlug(nuevo);
  };

  return (
    <form action={accion} className="space-y-6" noValidate>
      <fieldset>
        <legend className="text-sm font-medium">¿Qué tipo de negocio es?</legend>
        <p className="mt-1 text-xs text-neutral-500">
          Con esto te dejamos cargados servicios típicos con precios de referencia. Los ajustas
          después.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIAS.map((c) => (
            <label
              key={c.valor}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 px-3 py-2.5 text-sm has-checked:border-neutral-900 has-checked:bg-neutral-100 dark:border-neutral-700 dark:has-checked:border-neutral-300 dark:has-checked:bg-neutral-900"
            >
              <input
                type="radio"
                name="categoria"
                value={c.valor}
                required
                defaultChecked={estado.valores.categoria === c.valor}
                className="accent-neutral-900"
              />
              {c.nombre}
            </label>
          ))}
        </div>
        {estado.campos.categoria && (
          <p className="mt-1 text-xs text-red-600">{estado.campos.categoria}</p>
        )}
      </fieldset>

      <Campo
        name="nombreNegocio"
        etiqueta="Nombre del negocio"
        autoComplete="organization"
        required
        maxLength={80}
        defaultValue={estado.valores.nombreNegocio}
        onChange={(e) => {
          if (!slugEditado) setSlug(sugerirSlug(e.target.value));
        }}
        error={estado.campos.nombreNegocio}
      />

      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Tu link para reservar
        </label>
        <div className="mt-1 flex items-stretch">
          <span className="flex max-w-[45%] items-center truncate rounded-l-md border border-r-0 border-neutral-300 bg-neutral-100 px-2 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
            {dominio}/
          </span>
          <input
            id="slug"
            name="slug"
            required
            maxLength={SLUG_MAX}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={slug}
            onChange={(e) => usarSlug(e.target.value.toLowerCase())}
            aria-invalid={
              errorEnvioSlug || disponibilidad?.estado === 'invalido' || disponibilidad?.estado === 'tomado'
                ? true
                : undefined
            }
            aria-describedby="slug-ayuda"
            className="w-full min-w-0 rounded-r-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400"
          />
        </div>
        <div id="slug-ayuda" aria-live="polite" className="mt-1 text-xs">
          <EstadoSlug
            slug={slug}
            errorEnvio={errorEnvioSlug}
            disponibilidad={disponibilidad}
            onUsar={usarSlug}
          />
        </div>
      </div>

      <Campo
        name="celular"
        etiqueta="Celular del negocio"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="300 123 4567"
        defaultValue={estado.valores.celular}
        error={estado.campos.celular}
      />

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      <button type="submit" disabled={enviando} className={CLASES_BOTON_PRIMARIO}>
        {enviando ? 'Creando tu negocio…' : 'Crear mi negocio'}
      </button>
    </form>
  );
}

const ESPERA_REVISION_MS = 400;

/**
 * Revisa el slug en el servidor cuando el dueño deja de escribir.
 *
 * Devuelve null mientras no hay respuesta para el slug ACTUAL. Una respuesta
 * que llega tarde para un slug que ya cambió se descarta: si no, "barberia"
 * podría mostrarse como libre después de que el dueño escribió "barber".
 */
function useDisponibilidadSlug(slug: string): DisponibilidadSlug | null {
  const [revision, setRevision] = useState<{ slug: string; resultado: DisponibilidadSlug } | null>(
    null,
  );

  useEffect(() => {
    let vigente = true;

    const temporizador = setTimeout(() => {
      verificarSlug(slug)
        .catch((): DisponibilidadSlug => ({ estado: 'desconocido' }))
        .then((resultado) => {
          if (vigente) setRevision({ slug, resultado });
        });
    }, ESPERA_REVISION_MS);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [slug]);

  return revision?.slug === slug ? revision.resultado : null;
}

function EstadoSlug({
  slug,
  errorEnvio,
  disponibilidad,
  onUsar,
}: {
  slug: string;
  errorEnvio: string | undefined;
  disponibilidad: DisponibilidadSlug | null;
  onUsar: (slug: string) => void;
}) {
  if (errorEnvio) return <p className="text-red-600">{errorEnvio}</p>;

  if (!slug) {
    return <p className="text-neutral-500">Es el que vas a poner en tu Instagram y tu WhatsApp.</p>;
  }

  if (!disponibilidad) return <p className="text-neutral-500">Revisando si está libre…</p>;

  switch (disponibilidad.estado) {
    case 'disponible':
      return <p className="text-green-700 dark:text-green-500">Está libre. Es tuyo si lo quieres.</p>;
    case 'invalido':
      return <p className="text-red-600">{disponibilidad.mensaje}</p>;
    case 'tomado':
      return (
        <p className="text-red-600">
          Ya lo tiene otro negocio.
          {disponibilidad.sugerencia && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onUsar(disponibilidad.sugerencia!)}
                className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
              >
                Usar {disponibilidad.sugerencia}
              </button>
            </>
          )}
        </p>
      );
    case 'desconocido':
      return <p className="text-neutral-500">Es el que vas a poner en tu Instagram y tu WhatsApp.</p>;
  }
}