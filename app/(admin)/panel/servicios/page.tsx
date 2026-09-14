import { ListaServicios } from '@/components/admin/lista-servicios';
import { obtenerServicios } from '@/lib/panel/servicios';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Servicios' };

/**
 * Servicios del negocio (tarea C1): lo que ofrece, cuánto dura y cuánto cuesta.
 *
 * Solo el dueño. Los servicios no se borran: se desactivan y quedan en su
 * propia pestaña, porque sostienen las citas y la contabilidad pasadas.
 */
export default async function ServiciosPage({ searchParams }: PageProps<'/panel/servicios'>) {
  const { negocio } = await requireDueno();
  const { ver } = await searchParams;
  const servicios = await obtenerServicios(negocio.id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 pt-5 lg:px-8 lg:pt-7 lg:pb-8">
      <ListaServicios servicios={servicios} vista={ver === 'desactivados' ? 'desactivados' : 'activos'} />
    </main>
  );
}
