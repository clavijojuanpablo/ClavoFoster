'use client';

import { useRef, useState } from 'react';

import { BUCKET_FOTOS, urlDeFoto } from '@/lib/fotos';
import { createClient } from '@/lib/supabase/client';
import { MAX_FOTOS } from '@/lib/validation/perfil';

/**
 * Fotos del local: fachada, sillas, ambiente.
 *
 * Cada foto se reduce en el navegador ANTES de subirla: una foto de celular
 * pesa 3-5 MB y el lado largo queda en 1600 px a unos 200-400 KB. Sin esto la
 * transferencia de imágenes se vuelve el mayor costo de infraestructura
 * (docs/10-costos-de-infraestructura.md) y la subida por datos móviles se
 * eterniza.
 *
 * Subir no es guardar: la foto queda en Storage, pero la lista de
 * `businesses.photos` solo cambia cuando el dueño toca "Guardar".
 */

type Props = {
  /** De la sesión, vía requireDueno(). La política de Storage lo vuelve a verificar. */
  businessId: string;
  fotos: string[];
  onCambio: (fotos: string[]) => void;
};

const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.82;

async function reducirImagen(archivo: File): Promise<Blob> {
  // imageOrientation respeta la rotación EXIF: sin eso, las fotos verticales
  // del celular quedan acostadas.
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(imagen.width, imagen.height));

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no permite procesar imágenes');
  contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo convertir la imagen'))),
      'image/jpeg',
      CALIDAD_JPEG,
    ),
  );
}

export function FotosNegocio({ businessId, fotos, onCambio }: Props) {
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const espacio = MAX_FOTOS - fotos.length;

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);

    const seleccion = Array.from(archivos).slice(0, espacio);
    if (archivos.length > espacio) {
      setError(`Puedes tener hasta ${MAX_FOTOS} fotos. Subimos solo las primeras ${espacio}.`);
    }

    const supabase = createClient();
    const nuevas: string[] = [];
    setSubiendo(seleccion.length);

    for (const archivo of seleccion) {
      try {
        const blob = await reducirImagen(archivo);
        const ruta = `${businessId}/${crypto.randomUUID()}.jpg`;
        const { error: eSubida } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });

        if (eSubida) throw eSubida;
        nuevas.push(ruta);
      } catch (e) {
        console.error('[fotos] no se pudo subir:', e instanceof Error ? e.message : e);
        setError('Una de las fotos no se pudo subir. Revisa tu conexión e intenta de nuevo.');
      } finally {
        setSubiendo((n) => n - 1);
      }
    }

    if (nuevas.length) onCambio([...fotos, ...nuevas]);
    if (input.current) input.current.value = '';
  }

  return (
    <div>
      {fotos.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2">
          {fotos.map((ruta) => (
            <li key={ruta} className="relative aspect-square overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
              {/* <img> y no next/image: ya llegan reducidas, y pasarlas por la
                  optimización de Vercel cobraría dos veces por lo mismo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlDeFoto(ruta)} alt="" className="size-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onCambio(fotos.filter((f) => f !== ruta))}
                className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/70 text-sm text-white"
                aria-label="Quitar foto"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {espacio > 0 && (
        <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600 has-disabled:cursor-wait has-disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400">
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            disabled={subiendo > 0}
            onChange={(e) => subir(e.target.files)}
            className="sr-only"
          />
          {subiendo > 0 ? `Subiendo ${subiendo} foto${subiendo === 1 ? '' : 's'}…` : 'Agregar fotos del local'}
        </label>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
