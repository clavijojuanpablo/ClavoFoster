import { Agenda } from '@/components/admin/agenda';
import { fechaLocal } from '@/lib/fechas';
import { obtenerAgenda, type VistaAgenda } from '@/lib/panel/agenda';
import { catalogoParaAgendar } from '@/lib/panel/nueva-cita';
import { requireNegocio } from '@/lib/tenant';

export const metadata = { title: 'Agenda' };

/**
 * El calendario del negocio (G1).
 *
 * La pantalla más usada del producto. Qué se está mirando —día, vista y
 * persona— vive en la URL, así que el botón de atrás funciona y un día concreto
 * se puede compartir por link.
 */

type Props = {
  searchParams: Promise<{ fecha?: string; vista?: string; trabajador?: string }>;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function AgendaPage({ searchParams }: Props) {
  const contexto = await requireNegocio();
  const { negocio, rol } = contexto;

  const params = await searchParams;
  const hoy = fechaLocal(negocio.timezone, new Date());

  // Lo que venga mal escrito en la URL no revienta la pantalla: cae en el día
  // de hoy, que es lo que el dueño quería ver de todos modos.
  const fecha = params.fecha && FECHA.test(params.fecha) ? params.fecha : hoy;
  const vista: VistaAgenda = params.vista === 'semana' ? 'semana' : 'dia';

  // El catálogo para "Nueva cita" viene en paralelo: son dos consultas más que
  // no alargan la carga, y así la hoja abre al instante.
  const [datos, catalogo] = await Promise.all([
    obtenerAgenda(contexto, { fecha, vista, trabajador: params.trabajador ?? null }),
    catalogoParaAgendar(contexto),
  ]);

  return (
    <main className="flex flex-col gap-4 px-4 pt-5 lg:px-8 lg:pt-7 lg:pb-8">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-[30px] leading-tight font-bold lg:text-[32px]">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          {rol === 'staff' ? 'Tus citas' : 'Las citas de tu equipo'}
        </p>
      </header>

      <Agenda
        datos={datos}
        timezone={negocio.timezone}
        hoy={hoy}
        businessId={negocio.id}
        puedeEditar
        catalogo={catalogo}
      />
    </main>
  );
}
