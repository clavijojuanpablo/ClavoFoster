import Link from 'next/link';

import { FormularioPerfil } from '@/components/admin/formulario-perfil';
import { requireDueno } from '@/lib/tenant';
import { ZONA_HORARIA_POR_DEFECTO, zonasHorariasDisponibles } from '@/lib/validation/perfil';

export const metadata = { title: 'Perfil del negocio' };

/**
 * Perfil del negocio (tarea B4): datos básicos, ubicación, fotos y zona horaria.
 *
 * Solo el dueño. Nada es obligatorio más allá de lo que ya pidió el registro:
 * el negocio puede operar sin dirección ni fotos y completarlas cuando quiera.
 */
export default async function PerfilNegocioPage() {
  const { negocio } = await requireDueno();

  const fotos = Array.isArray(negocio.photos)
    ? negocio.photos.filter((f): f is string => typeof f === 'string')
    : [];

  const zonas = zonasHorariasDisponibles();
  // Una zona válida pero fuera del listado (ej. otra de Europa) no se puede
  // perder al guardar: se agrega para que el selector la muestre.
  if (!zonas.includes(negocio.timezone)) zonas.unshift(negocio.timezone);

  return (
    <main className="mx-auto max-w-xl px-6 pt-12">
      <Link href="/panel" className="text-sm text-neutral-500 underline-offset-2 hover:underline">
        ← Volver al panel
      </Link>
      <h1 className="mt-4 text-xl font-semibold">Perfil del negocio</h1>
      <p className="mt-1 mb-8 text-sm text-neutral-600 dark:text-neutral-400">
        Tu link público es{' '}
        <Link href={`/${negocio.slug}`} className="underline underline-offset-2">
          /{negocio.slug}
        </Link>
        .
      </p>

      <FormularioPerfil
        zonasHorarias={zonas}
        inicial={{
          businessId: negocio.id,
          nombreNegocio: negocio.name,
          categoria: negocio.category,
          celular: negocio.phone ?? '',
          direccion: negocio.address ?? '',
          ciudad: negocio.city ?? '',
          latitud: negocio.latitude === null ? null : Number(negocio.latitude),
          longitud: negocio.longitude === null ? null : Number(negocio.longitude),
          zonaHoraria: negocio.timezone || ZONA_HORARIA_POR_DEFECTO,
          fotos,
        }}
      />
    </main>
  );
}
