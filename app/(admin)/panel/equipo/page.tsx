import { ListaEquipo } from '@/components/admin/lista-equipo';
import { obtenerEquipo } from '@/lib/panel/equipo';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Equipo' };

/**
 * Equipo del negocio (D1 y D2): quién atiende y qué servicios presta.
 *
 * Solo el dueño. Nadie se borra: se desactiva, porque sus citas pasadas
 * sostienen la contabilidad.
 */
export default async function EquipoPage({ searchParams }: PageProps<'/panel/equipo'>) {
  const { negocio } = await requireDueno();
  const { ver } = await searchParams;
  const [equipo, servicios] = await Promise.all([obtenerEquipo(negocio.id), obtenerServicios(negocio.id)]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 pt-5 lg:px-8 lg:pt-7 lg:pb-8">
      <ListaEquipo
        equipo={equipo}
        idsServiciosActivos={new Set(servicios.filter((s) => s.activo).map((s) => s.id))}
        vista={ver === 'desactivados' ? 'desactivados' : 'activos'}
      />
    </main>
  );
}
