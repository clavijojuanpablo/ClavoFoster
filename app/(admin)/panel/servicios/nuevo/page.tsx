import { EditorServicio } from '@/components/admin/editor-servicio';
import { colorDeServicio } from '@/lib/colores';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Nuevo servicio' };

export default async function NuevoServicioPage() {
  const { negocio } = await requireDueno();
  const servicios = await obtenerServicios(negocio.id);

  return (
    <EditorServicio
      servicios={servicios}
      inicial={{
        id: null,
        nombre: '',
        descripcion: '',
        duracionMinutos: 30,
        precioCop: null,
        // El que le tocaría por posición (las plantillas empiezan en 1): así un
        // servicio nuevo no repite el color del anterior.
        color: colorDeServicio(null, servicios.length + 1),
        activo: true,
      }}
    />
  );
}
