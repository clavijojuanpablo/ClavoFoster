import Link from 'next/link';

import { cerrarSesion } from '@/app/(admin)/login/actions';
import { createClient } from '@/lib/supabase/server';
import { requireNegocio } from '@/lib/tenant';

export const metadata = { title: 'Panel' };

/**
 * Panel del negocio.
 *
 * Por ahora solo confirma que la resolución de tenant y la sesión funcionan.
 * El calendario de verdad llega en la épica G.
 */
export default async function PanelPage() {
  const { negocio, rol } = await requireNegocio();
  const supabase = await createClient();

  // No se filtra por business_id: RLS ya devuelve únicamente lo del negocio de
  // la sesión. Si esta consulta trajera datos de otro negocio, la prueba de
  // aislamiento habría fallado antes de llegar acá.
  const { data: proximas } = await supabase
    .from('appointments')
    .select('id, start_at, status, price_cop, customers(name), staff(name), services(name)')
    .gte('start_at', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])
    .order('start_at')
    .limit(8);

  const hora = new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: negocio.timezone,
  });

  const precio = (cop: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(cop);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-semibold">{negocio.name}</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {rol === 'owner' ? 'Dueño' : 'Trabajador'} · {negocio.timezone}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Página pública:{' '}
            <a href={`/${negocio.slug}`} className="underline underline-offset-2">
              /{negocio.slug}
            </a>
            {!negocio.is_published && <span className="text-amber-700"> · oculta</span>}
          </p>
          {rol === 'owner' && (
            <p className="mt-1 text-sm">
              <Link href="/panel/negocio" className="underline underline-offset-2">
                Perfil del negocio
              </Link>
              {negocio.latitude === null && (
                <span className="text-neutral-500"> · falta la ubicación</span>
              )}
            </p>
          )}
        </div>

        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Salir
          </button>
        </form>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">Próximas citas</h2>

        {!proximas?.length ? (
          <p className="mt-3 text-sm text-neutral-500">No hay citas próximas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {proximas.map((cita) => (
              <li key={cita.id} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{cita.customers?.name}</p>
                  <p className="truncate text-sm text-neutral-500">
                    {cita.services?.name} · {cita.staff?.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm">{hora.format(new Date(cita.start_at))}</p>
                  <p className="text-sm text-neutral-500">{precio(cita.price_cop)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
