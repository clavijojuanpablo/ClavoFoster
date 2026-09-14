import { FormularioPerfil } from '@/components/admin/formulario-perfil';
import { env } from '@/lib/env';
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 lg:px-8 lg:pt-7">
      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold lg:text-[32px]">Perfil del negocio</h1>
        <p className="text-sm text-muted-foreground">Lo que ven tus clientes y dónde te encuentran.</p>
      </header>

      <FormularioPerfil
        zonasHorarias={zonas}
        inicial={{
          businessId: negocio.id,
          nombreNegocio: negocio.name,
          categoria: negocio.category,
          celular: negocio.phone ?? '',
          publicada: negocio.is_published,
          slug: negocio.slug,
          urlPublica: `${env.NEXT_PUBLIC_APP_URL}/${negocio.slug}`,
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
