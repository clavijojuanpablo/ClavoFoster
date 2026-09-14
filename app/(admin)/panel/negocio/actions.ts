'use server';

import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import { BUCKET_FOTOS } from '@/lib/fotos';
import { createClient } from '@/lib/supabase/server';
import { requireDueno } from '@/lib/tenant';
import { erroresPorCampo } from '@/lib/validation/negocio';
import { esquemaPerfil } from '@/lib/validation/perfil';

export type EstadoPerfil = {
  error: string | null;
  campos: Record<string, string>;
  guardadoEn: number | null;
};

/**
 * Guarda el perfil del negocio de la sesión (tarea B4).
 *
 * El negocio sale de requireDueno(), no del formulario. Ni el slug ni el estado
 * de la suscripción están acá: la base tampoco deja cambiarlos con la sesión
 * del dueño (migración 20260912140001).
 */
export async function guardarPerfil(
  _anterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const { negocio } = await requireDueno();

  const datos = esquemaPerfil(negocio.id).safeParse({
    nombreNegocio: formData.get('nombreNegocio') ?? '',
    categoria: formData.get('categoria') ?? '',
    celular: formData.get('celular') ?? '',
    publicada: formData.get('publicada') ?? undefined,
    direccion: formData.get('direccion') ?? '',
    ciudad: formData.get('ciudad') ?? '',
    latitud: formData.get('latitud') ?? '',
    longitud: formData.get('longitud') ?? '',
    zonaHoraria: formData.get('zonaHoraria') ?? '',
    fotos: formData.get('fotos') ?? '[]',
  });

  if (!datos.success) {
    return { error: null, campos: erroresPorCampo(datos.error), guardadoEn: null };
  }

  const d = datos.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('businesses')
    .update({
      name: d.nombreNegocio,
      category: d.categoria,
      phone: d.celular,
      is_published: d.publicada,
      address: d.direccion,
      city: d.ciudad,
      latitude: d.latitud,
      longitude: d.longitud,
      timezone: d.zonaHoraria,
      photos: d.fotos,
    })
    .eq('id', negocio.id);

  if (error) {
    if (error.hint === 'zona_horaria_invalida') {
      return { error: null, campos: { zonaHoraria: 'Escoge una zona horaria de la lista' }, guardadoEn: null };
    }
    console.error('[perfil] no se pudo guardar:', { businessId: negocio.id, code: error.code, message: error.message });
    return { error: 'No pudimos guardar los cambios. Intenta de nuevo', campos: {}, guardadoEn: null };
  }

  // Las fotos que quitó se borran de Storage solo después de guardar: si se
  // borraran al tocar la X y no guardara, la tabla apuntaría a archivos que ya
  // no existen.
  const anteriores = Array.isArray(negocio.photos) ? (negocio.photos as unknown[]) : [];
  const quitadas = anteriores.filter(
    (ruta): ruta is string => typeof ruta === 'string' && !d.fotos.includes(ruta),
  );

  if (quitadas.length) {
    const { error: eBorrar } = await supabase.storage.from(BUCKET_FOTOS).remove(quitadas);
    if (eBorrar) {
      // El perfil ya quedó bien guardado; lo que sobra es un archivo huérfano.
      // Se registra para limpiarlo, pero no se le muestra error al dueño.
      console.error('[perfil] fotos sin borrar de Storage:', { businessId: negocio.id, message: eBorrar.message });
    }
  }

  revalidatePath('/panel', 'layout');
  revalidatePath(`/${negocio.slug}`);

  return { error: null, campos: {}, guardadoEn: Date.now() };
}

export type ResultadoDireccion = {
  etiqueta: string;
  latitud: number;
  longitud: number;
  ciudad: string | null;
};

export type BusquedaDireccion =
  | { ok: true; resultados: ResultadoDireccion[] }
  | { ok: false; mensaje: string };

type LugarNominatim = {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string };
};

/**
 * Busca una dirección en OpenStreetMap (Nominatim) para centrar el mapa.
 *
 * Solo se llama al tocar "Buscar", nunca mientras escribe: la política de uso
 * del servicio gratuito es de máximo una petición por segundo y prohíbe el
 * autocompletado. Si no encuentra la dirección, el dueño igual puede mover el
 * pin a mano, que es lo que de verdad se guarda.
 */
export async function buscarDireccion(consulta: string): Promise<BusquedaDireccion> {
  await requireDueno();

  const q = consulta.trim().slice(0, 200);
  if (q.length < 5) {
    return { ok: false, mensaje: 'Escribe la dirección con la ciudad, por ejemplo "Calle 85 #12-34, Bogotá"' };
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'co');
  url.searchParams.set('limit', '5');

  try {
    const respuesta = await fetch(url, {
      headers: {
        // Nominatim exige identificar la aplicación.
        'User-Agent': `Bookia/0.1 (${env.NEXT_PUBLIC_APP_URL})`,
        'Accept-Language': 'es',
      },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });

    if (!respuesta.ok) {
      console.error('[perfil] Nominatim respondió', respuesta.status);
      return { ok: false, mensaje: 'El buscador de direcciones no responde. Marca tu local moviendo el pin' };
    }

    const lugares = (await respuesta.json()) as LugarNominatim[];

    return {
      ok: true,
      resultados: lugares.map((l) => ({
        etiqueta: l.display_name,
        latitud: Number(l.lat),
        longitud: Number(l.lon),
        ciudad: l.address?.city ?? l.address?.town ?? l.address?.municipality ?? l.address?.village ?? null,
      })),
    };
  } catch (error) {
    console.error('[perfil] búsqueda de dirección falló:', error instanceof Error ? error.message : error);
    return { ok: false, mensaje: 'No pudimos buscar la dirección. Marca tu local moviendo el pin' };
  }
}
