import { notFound } from 'next/navigation';
import { z } from 'zod';

import { EditorTrabajador } from '@/components/admin/editor-trabajador';
import { contarCitasProximas, obtenerEquipo } from '@/lib/panel/equipo';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Editar persona' };

export default async function EditarTrabajadorPage({ params }: PageProps<'/panel/equipo/[id]'>) {
  const { negocio } = await requireDueno();
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) notFound();

  // Se busca dentro del equipo de ESTE negocio: un id de otro negocio responde
  // lo mismo que uno que no existe.
  const [equipo, todos, citasProximas] = await Promise.all([
    obtenerEquipo(negocio.id),
    obtenerServicios(negocio.id),
    contarCitasProximas(negocio.id, id, new Date()),
  ]);
  const trabajador = equipo.find((t) => t.id === id);
  if (!trabajador) notFound();

  return (
    <EditorTrabajador
      businessId={negocio.id}
      equipo={equipo}
      servicios={todos.filter((s) => s.activo)}
      citasProximas={citasProximas}
      inicial={{
        id: trabajador.id,
        nombre: trabajador.nombre,
        celular: trabajador.celular ?? '',
        perfil: trabajador.perfil ?? '',
        foto: trabajador.foto,
        activo: trabajador.activo,
        servicios: trabajador.servicios,
      }}
    />
  );
}
