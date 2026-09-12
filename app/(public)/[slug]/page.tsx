import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getNegocioPublico } from '@/lib/tenant';

/**
 * Página pública del negocio: `/barberia-juan`.
 *
 * Se renderiza SIN sesión. Todo lo que aparece acá es lo que las políticas de
 * RLS exponen al público — ni clientes, ni citas, ni contabilidad.
 *
 * El flujo de reserva completo (escoger hora, verificar celular, confirmar)
 * llega en la épica F. Acá está el catálogo, que es lo que necesita A4.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const negocio = await getNegocioPublico(slug);

  if (!negocio) return { title: 'Negocio no encontrado' };

  return {
    title: `${negocio.name} — Reservar cita`,
    description: `Reserva tu cita en ${negocio.name}${negocio.city ? `, ${negocio.city}` : ''}.`,
  };
}

export default async function NegocioPage({ params }: Props) {
  const { slug } = await params;
  const negocio = await getNegocioPublico(slug);

  // No existe, no está publicado, o la suscripción no está activa. Se responde
  // lo mismo en los tres casos: el estado de pago del negocio no es asunto del
  // cliente final. Ver docs/13-contratos-de-api.md
  if (!negocio) notFound();

  const supabase = await createClient();

  const [{ data: servicios }, { data: trabajadores }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_minutes, price_cop')
      .eq('business_id', negocio.id)
      .order('display_order'),
    supabase
      .from('staff')
      .select('id, name, bio, photo_url')
      .eq('business_id', negocio.id)
      .order('display_order'),
  ]);

  const precio = (cop: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(cop);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">{negocio.name}</h1>
        {negocio.address && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {negocio.address}
            {negocio.city ? ` · ${negocio.city}` : ''}
          </p>
        )}
        {negocio.phone && <p className="text-sm text-neutral-600 dark:text-neutral-400">{negocio.phone}</p>}
      </header>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-500">Servicios</h2>

        {!servicios?.length ? (
          <p className="mt-3 text-sm text-neutral-500">
            Este negocio todavía no publicó sus servicios.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {servicios.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.description && (
                    <p className="truncate text-sm text-neutral-500">{s.description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm">{precio(s.price_cop)}</p>
                  <p className="text-sm text-neutral-500">{s.duration_minutes} min</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!trabajadores?.length && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-neutral-500">Quién te atiende</h2>
          <ul className="mt-3 space-y-1">
            {trabajadores.map((t) => (
              <li key={t.id} className="text-sm">
                {t.name}
                {t.bio && <span className="text-neutral-500"> · {t.bio}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 rounded-md bg-neutral-100 p-4 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        La reserva en línea llega en la épica F: escoger hora disponible,
        verificar el celular por WhatsApp y confirmar.
      </p>
    </main>
  );
}
