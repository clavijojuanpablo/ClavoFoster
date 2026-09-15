'use client';

import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { BUCKET_FOTOS, urlDeFoto } from '@/lib/fotos';
import { reducirImagen } from '@/lib/imagenes';
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
        const blob = await reducirImagen(archivo, 1600);
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
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((ruta) => (
          <li key={ruta} className="relative aspect-square overflow-hidden rounded-[14px] bg-muted">
            {/* <img> y no next/image: ya llegan reducidas, y pasarlas por la
                optimización de Vercel cobraría dos veces por lo mismo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlDeFoto(ruta)} alt="" className="size-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => onCambio(fotos.filter((f) => f !== ruta))}
              className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-tinta/75 text-white transition hover:bg-tinta"
              aria-label="Quitar foto"
            >
              <X className="size-3.5" strokeWidth={3} />
            </button>
          </li>
        ))}

        {espacio > 0 && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[#bdbab0] text-[13px] font-semibold text-muted-foreground transition hover:border-tinta hover:text-tinta has-disabled:cursor-wait has-disabled:opacity-60 has-focus-visible:ring-4 has-focus-visible:ring-lima/40">
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                disabled={subiendo > 0}
                onChange={(e) => subir(e.target.files)}
                className="sr-only"
              />
              <ImagePlus className="size-[22px]" strokeWidth={1.8} />
              {subiendo > 0 ? `Subiendo ${subiendo}…` : 'Agregar'}
            </label>
          </li>
        )}
      </ul>
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
