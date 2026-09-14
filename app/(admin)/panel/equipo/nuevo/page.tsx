import { EditorTrabajador } from '@/components/admin/editor-trabajador';
import { obtenerEquipo } from '@/lib/panel/equipo';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Agregar persona' };

export default async function NuevoTrabajadorPage() {
  const { negocio } = await requireDueno();
  const [equipo, todos] = await Promise.all([obtenerEquipo(negocio.id), obtenerServicios(negocio.id)]);
  const servicios = todos.filter((s) => s.activo);

  return (
    <EditorTrabajador
      businessId={negocio.id}
      equipo={equipo}
      servicios={servicios}
      citasProximas={null}
      inicial={{
        id: null,
        nombre: '',
        celular: '',
        perfil: '',
        foto: null,
        activo: true,
        // En la mayoría de negocios pequeños todos hacen de todo: se arranca
        // con todo marcado y se desmarca lo que no.
        servicios: servicios.map((s) => s.id),
      }}
    />
  );
}
