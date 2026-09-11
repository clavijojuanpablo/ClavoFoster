import { createClient } from '@/lib/supabase/server';

/**
 * Página temporal de verificación.
 *
 * Existe solo para comprobar que la cadena completa funciona: Next.js →
 * cliente de Supabase → políticas de RLS → datos reales. Lee SIN sesión, así
 * que todo lo que aparece acá es exactamente lo que vería un cliente final.
 *
 * La reemplaza la página pública de reservas en la tarea F1.
 */
export default async function Home() {
  const supabase = await createClient();

  const { data: negocio, error } = await supabase
    .from('businesses')
    .select('id, name, slug, city, address, phone, timezone, category')
    .eq('slug', 'barberia-demo')
    .maybeSingle();

  const [servicios, trabajadores] = negocio
    ? await Promise.all([
        supabase
          .from('services')
          .select('id, name, duration_minutes, price_cop')
          .eq('business_id', negocio.id)
          .order('display_order'),
        supabase
          .from('staff')
          .select('id, name')
          .eq('business_id', negocio.id)
          .order('display_order'),
      ])
    : [null, null];

  const precio = (cop: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(cop);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-neutral-500">
        Verificación de la cadena de datos
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Plataforma de citas</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Esta página lee sin sesión: muestra únicamente lo que las políticas de
        seguridad exponen al público.
      </p>

      {error && (
        <p className="mt-8 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Error al consultar: {error.message}
        </p>
      )}

      {!negocio && !error && (
        <div className="mt-8 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
          No hay datos de demostración todavía. Corre{' '}
          <code className="font-mono">npm run db:seed</code>.
        </div>
      )}

      {negocio && (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-sm font-medium text-neutral-500">Negocio</h2>
            <p className="mt-1 text-lg font-medium">{negocio.name}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {negocio.address} · {negocio.city}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {negocio.phone} · {negocio.timezone}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-neutral-500">
              Servicios ({servicios?.data?.length ?? 0})
            </h2>
            <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
              {servicios?.data?.map((s) => (
                <li key={s.id} className="flex justify-between py-2 text-sm">
                  <span>{s.name}</span>
                  <span className="text-neutral-500">
                    {s.duration_minutes} min · {precio(s.price_cop)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-medium text-neutral-500">
              Trabajadores ({trabajadores?.data?.length ?? 0})
            </h2>
            <ul className="mt-2 text-sm">
              {trabajadores?.data?.map((t) => (
                <li key={t.id} className="py-1">
                  {t.name}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-md bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
            <p className="font-medium">Lo que NO aparece acá, a propósito</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              Clientes, citas y contabilidad. Sin sesión, las políticas de RLS
              los ocultan por completo — y así debe ser.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
