'use client';

import { ChevronDown, LocateFixed, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useActionState, useState, useTransition, type ReactNode } from 'react';

import {
  buscarDireccion,
  guardarPerfil,
  type EstadoPerfil,
  type ResultadoDireccion,
} from '@/app/(admin)/panel/negocio/actions';
import { AvisoError, Campo, CLASES_CONTROL } from '@/components/admin/campo';
import { CopiarLink } from '@/components/admin/copiar-link';
import { FotosNegocio } from '@/components/admin/fotos-negocio';
import { Button } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import { enviarSinReiniciar } from '@/lib/formularios';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from '@/lib/validation/negocio';

// Leaflet usa `window` al importarse: se carga solo en el navegador.
const MapaUbicacion = dynamic(() => import('@/components/admin/mapa-ubicacion'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">
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
  urlPublica: string;
  direccion: string;
  ciudad: string;
  latitud: number | null;
  longitud: number | null;
  zonaHoraria: string;
  fotos: string[];
};

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

  const guardadoReciente =
    estado.guardadoEn !== null && !guardando && !estado.error && !Object.keys(estado.campos).length;

  return (
    <form onSubmit={enviarSinReiniciar(accion)} className="flex flex-col gap-3.5" noValidate>
      {/* Página pública */}
      <Tarjeta tono="oscura" className="flex flex-col gap-3.5 p-[18px]">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">
              {publicada ? 'Tu página está visible' : 'Tu página está oculta'}
            </span>
            <span className="text-[13px] text-[#9da29a]">
              {publicada ? 'Tus clientes ya pueden verla' : 'Actívala cuando quieras recibir reservas'}
            </span>
          </span>
          <input
            type="checkbox"
            name="publicada"
            checked={publicada}
            onChange={(e) => setPublicada(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="flex h-8 w-[52px] shrink-0 rounded-full bg-[#3a3e3a] p-[3px] transition peer-checked:justify-end peer-checked:bg-lima peer-focus-visible:ring-4 peer-focus-visible:ring-lima/40"
          >
            <span className={cn('size-[26px] rounded-full transition', publicada ? 'bg-tinta' : 'bg-papel')} />
          </span>
        </label>
        <div className="flex h-12 items-center gap-2 rounded-[14px] bg-tinta-suave pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate text-sm text-[#c9ccc5]">
            /<strong className="font-semibold text-papel">{inicial.slug}</strong>
          </span>
          <CopiarLink url={inicial.urlPublica} etiqueta="Copiar" />
        </div>
        {publicada !== inicial.publicada && (
          <span className="text-[13px] text-lima">El cambio se aplica al guardar.</span>
        )}
      </Tarjeta>

      <Seccion titulo="Datos básicos">
        <Campo
          name="nombreNegocio"
          etiqueta="Nombre del negocio"
          required
          maxLength={80}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={estado.campos.nombreNegocio}
        />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">Tipo de negocio</legend>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <label key={c.valor} className="cursor-pointer">
                <input
                  type="radio"
                  name="categoria"
                  value={c.valor}
                  checked={categoria === c.valor}
                  onChange={() => setCategoria(c.valor)}
                  className="peer sr-only"
                />
                <span className="flex h-10 items-center rounded-full border border-input px-4 text-sm transition peer-checked:border-tinta peer-checked:bg-tinta peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-lima/40 hover:border-tinta">
                  {c.nombre}
                </span>
              </label>
            ))}
          </div>
          {estado.campos.categoria && <p className="text-[13px] text-destructive">{estado.campos.categoria}</p>}
        </fieldset>

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
      </Seccion>

      <Seccion titulo="Ubicación" descripcion="Toca el mapa o arrastra el pin hasta la puerta de tu local.">
        <div className="grid gap-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
        </div>

        {resultados.length > 0 && (
          <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-xl border border-border text-sm">
            {resultados.map((r) => (
              <li key={`${r.latitud},${r.longitud}`}>
                <button
                  type="button"
                  onClick={() => usarResultado(r)}
                  className="w-full px-3.5 py-2.5 text-left transition hover:bg-muted"
                >
                  {r.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        )}

        <MapaUbicacion
          latitud={ubicacion.latitud}
          longitud={ubicacion.longitud}
          onCambio={(latitud, longitud) => setUbicacion({ latitud, longitud })}
        />
        <input type="hidden" name="latitud" value={ubicacion.latitud ?? ''} />
        <input type="hidden" name="longitud" value={ubicacion.longitud ?? ''} />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={buscar}
            disabled={buscando || direccion.trim().length < 5}
          >
            <Search />
            {buscando ? 'Buscando…' : 'Buscar'}
          </Button>
          <Button type="button" variant="outline" onClick={usarMiUbicacion} disabled={localizando}>
            <LocateFixed />
            {localizando ? 'Ubicando…' : 'Estoy en el local'}
          </Button>
        </div>

        {avisoUbicacion && (
          <p aria-live="polite" className="text-[13px] text-muted-foreground">
            {avisoUbicacion}
          </p>
        )}
        {(estado.campos.latitud || estado.campos.longitud) && (
          <p className="text-[13px] text-destructive">{estado.campos.latitud ?? estado.campos.longitud}</p>
        )}
        {ubicacion.latitud === null && !avisoUbicacion && (
          <p className="text-[13px] text-muted-foreground">Todavía no has marcado la ubicación.</p>
        )}
      </Seccion>

      <Seccion titulo="Fotos del local" contador={`${fotos.length} de 10`} descripcion="Opcional. Puedes agregarlas cuando quieras.">
        <FotosNegocio businessId={inicial.businessId} fotos={fotos} onCambio={setFotos} />
        <input type="hidden" name="fotos" value={JSON.stringify(fotos)} />
        {estado.campos.fotos && <p className="text-[13px] text-destructive">{estado.campos.fotos}</p>}
      </Seccion>

      <Seccion titulo="Zona horaria" descripcion="Con ella se muestran las horas de tus citas.">
        <label htmlFor="zonaHoraria" className="sr-only">
          Zona horaria
        </label>
        <div className="relative">
          <select
            id="zonaHoraria"
            name="zonaHoraria"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            className={cn(CLASES_CONTROL, 'appearance-none pr-10')}
          >
            {zonasHorarias.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
        </div>
        {estado.campos.zonaHoraria && <p className="text-[13px] text-destructive">{estado.campos.zonaHoraria}</p>}
      </Seccion>

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      {/*
        En celular queda encima de la barra de navegación inferior.
        z-[1100]: los controles de Leaflet usan z-index 1000 y taparían el botón.
      */}
      <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] z-[1100] -mx-4 mt-1 flex flex-col items-center gap-1.5 bg-gradient-to-t from-papel from-70% to-transparent px-4 pt-4 pb-1 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-4">
        <Button type="submit" size="lg" disabled={guardando} className="w-full">
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        {guardadoReciente && (
          <p role="status" className="text-[13px] font-semibold text-estado-neutro">
            Cambios guardados.
          </p>
        )}
      </div>
    </form>
  );
}

function Seccion({
  titulo,
  descripcion,
  contador,
  children,
}: {
  titulo: string;
  descripcion?: string;
  contador?: string;
  children: ReactNode;
}) {
  return (
    <Tarjeta className="flex flex-col gap-3.5 p-[18px] lg:p-6">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">{titulo}</h2>
          {contador && <span className="text-[13px] text-tenue">{contador}</span>}
        </div>
        {descripcion && <p className="text-[13px] text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </Tarjeta>
  );
}
