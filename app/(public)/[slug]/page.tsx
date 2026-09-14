import { Clock, Image as IconoImagen, MapPin, MessageCircle } from 'lucide-react';
import { notFound } from 'next/navigation';

import { duracion, iniciales, pesos } from '@/lib/formato';
import { urlDeFoto } from '@/lib/fotos';
import { NOMBRE_PRODUCTO } from '@/lib/marca';
import { createClient } from '@/lib/supabase/server';
import { getNegocioPublico } from '@/lib/tenant';

/**
 * Página pública del negocio: `/barberia-juan`.
 *
 * Se renderiza SIN sesión. Todo lo que aparece acá es lo que las políticas de
 * RLS exponen al público — ni clientes, ni citas, ni contabilidad.
 *
 * Es la cara del producto frente al cliente final y se abre casi siempre desde
 * un celular (el link de Instagram). El flujo de reserva completo llega con la
 * épica F; mientras tanto, el botón fijo lleva al WhatsApp del negocio.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const negocio = await getNegocioPublico(slug);

  if (!negocio) return { title: 'Negocio no encontrado' };

  return {
    // absolute: la página es del negocio (marca blanca), sin el nombre del producto en la pestaña.
    title: { absolute: `${negocio.name} — Reservar cita` },
    description: `Reserva tu cita en ${negocio.name}${negocio.city ? `, ${negocio.city}` : ''}.`,
  };
}

export default async function NegocioPage({ params }: Props) {
  const { slug } = await params;
  const negocio = await getNegocioPublico(slug);

  // No existe, no está publicado, o la suscripción está suspendida. Se responde
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

  const portada = Array.isArray(negocio.photos) && typeof negocio.photos[0] === 'string' ? negocio.photos[0] : null;
  // El celular se guarda en E.164 (+573001234567); wa.me lo quiere sin el +.
  const whatsapp = negocio.phone && /^\+\d{8,15}$/.test(negocio.phone) ? `https://wa.me/${negocio.phone.slice(1)}` : null;
  const ubicacion = [negocio.address, negocio.city].filter(Boolean).join(', ');

  return (
    <div className="min-h-dvh bg-papel">
      <div className="mx-auto w-full max-w-xl">
        {/* Portada: la primera foto del local, o una textura si no hay. */}
        <div
          className="relative flex h-44 items-center justify-center overflow-hidden bg-tinta text-[#4a4f49] sm:mt-4 sm:h-52 sm:rounded-[28px]"
          style={
            portada
              ? undefined
              : { backgroundImage: 'repeating-linear-gradient(135deg, #1d201d 0 2px, transparent 2px 12px)' }
          }
        >
          {portada ? (
            // eslint-disable-next-line @next/next/no-img-element -- ya reducida al subirla; ver fotos-negocio.tsx
            <img src={urlDeFoto(portada)} alt="" className="size-full object-cover" />
          ) : (
            <IconoImagen className="size-7" strokeWidth={1.6} aria-hidden="true" />
          )}
        </div>

        <main className="flex flex-col gap-6 px-4 pb-32">
          <section className="relative -mt-11 flex flex-col gap-3 rounded-3xl border border-border bg-card p-[18px]">
            <div className="flex items-center gap-3.5">
              <span className="flex size-[60px] shrink-0 items-center justify-center rounded-[18px] bg-tinta font-heading text-[22px] font-bold text-lima">
                {iniciales(negocio.name)}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h1 className="text-2xl leading-tight font-bold">{negocio.name}</h1>
                {ubicacion && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{ubicacion}</span>
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[22px] font-bold">Servicios</h2>

            {!servicios?.length ? (
              <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Este negocio todavía no publicó sus servicios.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {servicios.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-semibold">{s.name}</span>
                      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {duracion(s.duration_minutes)}
                          {s.description && ` · ${s.description}`}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-bold">{pesos(s.price_cop)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {!!trabajadores?.length && (
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[22px] font-bold">Quién te atiende</h2>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {trabajadores.map((t) => (
                  <li key={t.id} className="flex flex-col items-center gap-2 rounded-[18px] border border-border bg-card px-1 py-3">
                    {t.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto de perfil pequeña ya alojada en Storage
                      <img src={t.photo_url} alt="" className="size-12 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-12 items-center justify-center rounded-full bg-muted font-bold">
                        {iniciales(t.name)}
                      </span>
                    )}
                    <span className="max-w-full truncate px-1 text-[13px] font-semibold">{t.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <span className="self-center text-[13px] text-tenue">
            Hecho con <strong className="font-semibold text-muted-foreground">{NOMBRE_PRODUCTO}</strong>
          </span>
        </main>
      </div>

      {/* La reserva en línea llega con la épica F. Mientras tanto, WhatsApp. */}
      {whatsapp && (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-papel from-70% to-transparent px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mx-auto flex h-[60px] max-w-xl items-center justify-between rounded-[20px] bg-tinta pr-2 pl-[18px] text-white"
          >
            <span className="flex flex-col">
              <span className="text-xs text-[#9da29a]">¿Quieres una cita?</span>
              <span className="text-base font-bold">Escríbenos</span>
            </span>
            <span className="flex h-11 items-center gap-2 rounded-[14px] bg-lima px-[18px] text-[15px] font-semibold text-tinta">
              <MessageCircle className="size-[18px]" />
              WhatsApp
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
