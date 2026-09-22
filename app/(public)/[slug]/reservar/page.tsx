import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FlujoDeReserva } from '@/components/booking/flujo-de-reserva';
import { obtenerCatalogoReservable, obtenerVentanaDeCupos, type VentanaDeCupos } from '@/lib/booking/disponibilidad';
import { obtenerCitaPorToken } from '@/lib/booking/gestion';
import { fechaLocal } from '@/lib/fechas';
import { whatsappConfigurado } from '@/lib/notifications';
import { getNegocioPublico } from '@/lib/tenant';

/**
 * Reserva pública: escoger servicio, persona, día y hora (tareas F2 y F3).
 *
 * Se abre sin sesión, casi siempre desde un celular y desde el link de
 * Instagram del negocio. El catálogo entero viaja en el primer render para que
 * cambiar de servicio o de persona no cueste una ida a la base; lo único que se
 * pide sobre la marcha son los cupos.
 *
 * La misma pantalla sirve para mover una cita que ya existe (F6), con
 * `?mover=<token>`: el selector de horas es idéntico, así que no hay dos
 * calendarios que mantener.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string; mover?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const negocio = await getNegocioPublico(slug);

  if (!negocio) return { title: 'Negocio no encontrado' };

  return {
    title: { absolute: `Reservar en ${negocio.name}` },
    description: `Escoge servicio, día y hora en ${negocio.name}.`,
  };
}

export default async function ReservarPage({ params, searchParams }: Props) {
  const [{ slug }, { servicio: servicioPedido, mover }] = await Promise.all([params, searchParams]);

  const negocio = await getNegocioPublico(slug);
  if (!negocio) notFound();

  // `?mover=` es el link de gestión del cliente: se mueve SU cita, y el servicio
  // queda fijo porque cambiarlo sería otra cita. Si el token no es de este
  // negocio, se ignora y queda una reserva normal.
  const citaQueSeMueve = mover ? await obtenerCitaPorToken(mover) : null;
  const moviendo =
    citaQueSeMueve && citaQueSeMueve.negocio.slug === negocio.slug ? citaQueSeMueve : null;

  const catalogo = await obtenerCatalogoReservable(negocio);
  const ahora = new Date();
  const hoy = fechaLocal(negocio.timezone, ahora);

  // Si el cliente llegó con un servicio escogido —tocó uno en la página del
  // negocio, o está moviendo una cita—, sus cupos van en el mismo render: se
  // ahorra una vuelta justo en el paso donde la gente abandona.
  const buscado = moviendo?.servicioId ?? servicioPedido;
  const inicial = catalogo.find((s) => s.id === buscado && s.trabajadores.length > 0);
  let ventanaInicial: VentanaDeCupos | null = null;
  if (inicial) {
    ventanaInicial = await obtenerVentanaDeCupos({
      negocio,
      servicio: inicial,
      staffId: null,
      desde: hoy,
      ahora,
    });
  }

  return (
    <div className="min-h-dvh bg-papel">
      <div className="mx-auto w-full max-w-xl px-4 pb-40">
        <header className="flex items-center gap-2 py-4">
          <Link
            href={moviendo ? `/cita/${moviendo.token}` : `/${negocio.slug}`}
            aria-label={moviendo ? 'Volver a tu cita' : `Volver a ${negocio.name}`}
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-tinta transition hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-semibold tracking-wide text-tenue uppercase">{moviendo ? 'Mover la cita' : 'Reservar'}</span>
            <span className="truncate text-base font-semibold">{negocio.name}</span>
          </div>
        </header>

        {catalogo.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Este negocio todavía no publicó sus servicios. Vuelve pronto.
          </p>
        ) : (
          <FlujoDeReserva
            slug={negocio.slug}
            timezone={negocio.timezone}
            dejaEscogerPersona={negocio.allow_staff_choice}
            hoy={hoy}
            catalogo={catalogo}
            servicioInicial={inicial?.id ?? null}
            ventanaInicial={ventanaInicial}
            whatsappConfigurado={whatsappConfigurado()}
            moviendo={moviendo ? { token: moviendo.token } : null}
          />
        )}
      </div>
    </div>
  );
}
