import { notFound } from 'next/navigation';
import { z } from 'zod';

import { EditorServicio } from '@/components/admin/editor-servicio';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Editar servicio' };

export default async function EditarServicioPage({ params }: PageProps<'/panel/servicios/[id]'>) {
  const { negocio } = await requireDueno();
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) notFound();

  // Se busca dentro de los servicios de ESTE negocio: un id de otro negocio
  // responde lo mismo que uno que no existe.
  const servicios = await obtenerServicios(negocio.id);
  const servicio = servicios.find((s) => s.id === id);
  if (!servicio) notFound();

  return (
    <EditorServicio
      servicios={servicios}
      inicial={{
        id: servicio.id,
        nombre: servicio.nombre,
        descripcion: servicio.descripcion ?? '',
        duracionMinutos: servicio.duracionMinutos,
        precioCop: servicio.precioCop,
        color: servicio.color,
        activo: servicio.activo,
      }}
    />
  );
}
