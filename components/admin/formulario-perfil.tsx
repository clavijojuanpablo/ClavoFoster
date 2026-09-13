'use client';

import dynamic from 'next/dynamic';
import { useActionState, useState, useTransition } from 'react';

import {
  buscarDireccion,
  guardarPerfil,
  type EstadoPerfil,
  type ResultadoDireccion,
} from '@/app/(admin)/panel/negocio/actions';
import { AvisoError, Campo, CLASES_BOTON_PRIMARIO } from '@/components/admin/campo';
import { FotosNegocio } from '@/components/admin/fotos-negocio';
import { CATEGORIAS } from '@/lib/validation/negocio';

// Leaflet usa `window` al importarse: se carga solo en el navegador.
const MapaUbicacion = dynamic(() => import('@/components/admin/mapa-ubicacion'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-md border border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700">
      Cargando mapa…
    </div>
  ),
});

export type PerfilInicial = {
  businessId: string;
  nombreNegocio: string;
  categoria: string;
  celular: string;
  publicada: boolean;
  slug: string;
  direccion: string;
  ciudad: string;
  latitud: number | null;
  longitud: number | null;
  zonaHoraria: string;
  fotos: string[];
};

const CLASES_SELECT =
  'mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400';

const CLASES_BOTON_SECUNDARIO =
  'shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900';

const INICIAL: EstadoPerfil = { error: null, campos: {}, guardadoEn: null };

export function FormularioPerfil({
  inicial,
  zonasHorarias,
}: {
  inicial: PerfilInicial;
  zonasHorarias: string[];
}) {
  const [estado, accion, guardando] = useActionState(guardarPerfil, INICIAL);

  // Estado controlado: el mapa, el buscador y el GPS escriben en los mismos
  // campos, y no se pueden perder cuando el formulario se reinicia al guardar.
  const [nombre, setNombre] = useState(inicial.nombreNegocio);
  const [categoria, setCategoria] = useState(inicial.categoria);
  const [celular, setCelular] = useState(inicial.celular);
  const [publicada, setPublicada] = useState(inicial.publicada);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [ciudad, setCiudad] = useState(inicial.ciudad);
  const [zona, setZona] = useState(inicial.zonaHoraria);
  const [ubicacion, setUbicacion] = useState({ latitud: inicial.latitud, longitud: inicial.longitud });
  const [fotos, setFotos] = useState(inicial.fotos);

  const [resultados, setResultados] = useState<ResultadoDireccion[]>([]);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();
  const [localizando, setLocalizando] = useState(false);

  function buscar() {
    setAvisoUbicacion(null);
    iniciarBusqueda(async () => {
      const r = await buscarDireccion(ciudad ? `${direccion}, ${ciudad}` : direccion);
      if (!r.ok) {
        setResultados([]);
        setAvisoUbicacion(r.mensaje);
      } else if (!r.resultados.length) {
        setResultados([]);
        setAvisoUbicacion('No encontramos esa dirección. Marca tu local tocando el mapa');
      } else {
        setResultados(r.resultados);
      }
    });
  }

  function usarResultado(r: ResultadoDireccion) {
    setUbicacion({ latitud: r.latitud, longitud: r.longitud });
    if (r.ciudad && !ciudad) setCiudad(r.ciudad);
    setResultados([]);
    setAvisoUbicacion('Ajusta el pin si no quedó justo en tu puerta.');
  }

  function usarMiUbicacion() {
    setAvisoUbicacion(null);
    if (!('geolocation' in navigator)) {
      setAvisoUbicacion('Tu navegador no permite ubicarte. Marca tu local tocando el mapa');
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setLocalizando(false);
        setUbicacion({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude });
        setAvisoUbicacion('Ajusta el pin si no quedó justo en tu puerta.');
      },
      () => {
        setLocalizando(false);
        setAvisoUbicacion('No pudimos ubicarte. Marca tu local tocando el mapa');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const guardadoReciente = estado.guardadoEn !== null && !guardando;

  return (
    <form action={accion} className="space-y-8" noValidate>
      <section>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-300 p-4 has-checked:border-green-700 has-checked:bg-green-50 dark:border-neutral-700 dark:has-checked:border-green-600 dark:has-checked:bg-green-950/40">
          <input
            type="checkbox"
            name="publicada"
            checked={publicada}
            onChange={(e) => setPublicada(e.target.checked)}
            className="mt-0.5 size-4 accent-green-700"
          />
          <span className="text-sm">
            <span className="block font-medium">
              {publicada ? 'Tu página pública está visible' : 'Tu página pública está oculta'}
            </span>
            <span className="mt-0.5 block text-neutral-600 dark:text-neutral-400">
              {publicada
                ? `Cualquiera con tu link /${inicial.slug} puede verla.`
                : 'Actívala cuando quieras que tus clientes vean tu link. El cambio se aplica al guardar.'}
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">Datos básicos</h2>

        <Campo
          name="nombreNegocio"
          etiqueta="Nombre del negocio"
          required
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={estado.campos.nombreNegocio}
        />

        <div>
          <label htmlFor="categoria" className="block text-sm font-medium">
            Tipo de negocio
          </label>
          <select
            id="categoria"
            name="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={CLASES_SELECT}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nombre}
              </option>
            ))}
          </select>
          {estado.campos.categoria && <p className="mt-1 text-xs text-red-600">{estado.campos.categoria}</p>}
        </div>

        <Campo
          name="celular"
          etiqueta="Celular del negocio"
          type="tel"
          inputMode="tel"
          required
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          ayuda="Aparece en tu página para que los clientes te escriban."
          error={estado.campos.celular}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-neutral-500">Ubicación</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Toca el mapa o arrastra el pin hasta la puerta de tu local.
          </p>
        </div>

        <Campo
          name="direccion"
          etiqueta="Dirección"
          autoComplete="street-address"
          maxLength={200}
          placeholder="Calle 85 #12-34, local 2"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          error={estado.campos.direccion}
        />

        <Campo
          name="ciudad"
          etiqueta="Ciudad"
          autoComplete="address-level2"
          maxLength={80}
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          error={estado.campos.ciudad}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={buscar}
            disabled={buscando || direccion.trim().length < 5}
            className={CLASES_BOTON_SECUNDARIO}
          >
            {buscando ? 'Buscando…' : 'Buscar en el mapa'}
          </button>
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={localizando}
            className={CLASES_BOTON_SECUNDARIO}
          >
            {localizando ? 'Ubicando…' : 'Estoy en el local'}
          </button>
        </div>

        {resultados.length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-300 text-sm dark:divide-neutral-800 dark:border-neutral-700">
            {resultados.map((r) => (
              <li key={`${r.latitud},${r.longitud}`}>
                <button
                  type="button"
                  onClick={() => usarResultado(r)}
                  className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  {r.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        )}

        {avisoUbicacion && (
          <p aria-live="polite" className="text-xs text-neutral-600 dark:text-neutral-400">
            {avisoUbicacion}
          </p>
        )}

        <MapaUbicacion
          latitud={ubicacion.latitud}
          longitud={ubicacion.longitud}
          onCambio={(latitud, longitud) => setUbicacion({ latitud, longitud })}
        />
        <input type="hidden" name="latitud" value={ubicacion.latitud ?? ''} />
        <input type="hidden" name="longitud" value={ubicacion.longitud ?? ''} />
        {(estado.campos.latitud || estado.campos.longitud) && (
          <p className="text-xs text-red-600">{estado.campos.latitud ?? estado.campos.longitud}</p>
        )}
        {ubicacion.latitud === null && (
          <p className="text-xs text-neutral-500">Todavía no has marcado la ubicación.</p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-neutral-500">Fotos del local</h2>
          <p className="mt-1 text-xs text-neutral-500">Opcional. Puedes agregarlas cuando quieras.</p>
        </div>
        <FotosNegocio businessId={inicial.businessId} fotos={fotos} onCambio={setFotos} />
        <input type="hidden" name="fotos" value={JSON.stringify(fotos)} />
        {estado.campos.fotos && <p className="text-xs text-red-600">{estado.campos.fotos}</p>}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Zona horaria</h2>
        <label htmlFor="zonaHoraria" className="sr-only">
          Zona horaria
        </label>
        <select
          id="zonaHoraria"
          name="zonaHoraria"
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          className={CLASES_SELECT}
        >
          {zonasHorarias.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Con ella se muestran las horas de tus citas. En Colombia es America/Bogota.
        </p>
        {estado.campos.zonaHoraria && (
          <p className="mt-1 text-xs text-red-600">{estado.campos.zonaHoraria}</p>
        )}
      </section>

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      {/* z-[1100]: los controles de Leaflet usan z-index 1000 y taparían el botón. */}
      <div className="sticky bottom-0 z-[1100] -mx-6 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <button type="submit" disabled={guardando} className={CLASES_BOTON_PRIMARIO}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {guardadoReciente && !estado.error && !Object.keys(estado.campos).length && (
          <p role="status" className="mt-2 text-center text-xs text-green-700 dark:text-green-500">
            Cambios guardados.
          </p>
        )}
      </div>
    </form>
  );
}
