import { CalendarX2, Check, Clock, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CancelarCita } from '@/components/booking/cancelar-cita';
import { obtenerCitaPorToken } from '@/lib/booking/gestion';
import { duracion, fechaLarga, hora, pesos } from '@/lib/formato';
import { NOMBRE_PRODUCTO } from '@/lib/marca';

/**
 * La cita del cliente, abierta desde el link que le llegó por WhatsApp (F6).
 *
 * El link lleva el token aleatorio de la cita, nunca su id, y muestra solo esa
 * cita. Sin sesión: quien tenga el link es el dueño de la cita, porque el link
 * le llegó a su chat.
 */

type Props = { params: Promise<{ token: string }> };

export const metadata = { title: { absolute: 'Tu cita' }, robots: { index: false, follow: false } };

export default async function CitaPage({ params }: Props) {
  const { token } = await params;
  const cita = await obtenerCitaPorToken(token);

  if (!cita) notFound();

  const inicio = new Date(cita.inicio);
  const cancelada = cita.estado === 'cancelled';
  const yaPaso = cita.estado === 'completed' || cita.estado === 'no_show' || inicio < new Date();

  return (
    <div className="min-h-dvh bg-papel">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-tenue uppercase">
            {cancelada ? 'Cita cancelada' : yaPaso ? 'Cita pasada' : 'Tu cita está confirmada'}
          </span>
          <h1 className="text-[28px] leading-tight font-bold">{cita.negocio.nombre}</h1>
        </header>

        <section
          className={`flex flex-col gap-4 rounded-3xl p-[18px] ${
            cancelada ? 'border border-border bg-card' : 'bg-tinta text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                cancelada ? 'bg-muted text-muted-foreground' : 'bg-lima text-tinta'
              }`}
            >
              {cancelada ? <CalendarX2 className="size-5" /> : <Check className="size-5" />}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={`font-heading text-xl font-bold ${cancelada ? 'line-through' : ''}`}>
                {fechaLarga(cita.negocio.timezone, inicio)}
              </span>
              <span className={`text-base font-semibold ${cancelada ? 'text-muted-foreground' : 'text-lima'}`}>
                {hora(cita.negocio.timezone, inicio)}
              </span>
            </div>
          </div>

          <dl className={`flex flex-col gap-2 text-[15px] ${cancelada ? 'text-muted-foreground' : 'text-[#c9cdc6]'}`}>
            <Dato icono={<Clock className="size-4" />} etiqueta="Servicio">
              {cita.servicio} · {duracion(cita.duracionMinutos)} · {pesos(cita.precioCop)}
            </Dato>
            {cita.trabajador && (
              <Dato icono={<User className="size-4" />} etiqueta="Te atiende">
                {cita.trabajador}
              </Dato>
            )}
            {cita.negocio.direccion && (
              <Dato icono={<MapPin className="size-4" />} etiqueta="Dónde">
                {cita.negocio.direccion}
              </Dato>
            )}
          </dl>

          {cita.nota && (
            <p className={`rounded-xl px-3.5 py-2.5 text-[13px] ${cancelada ? 'bg-muted' : 'bg-white/8'}`}>
              {cita.nota}
            </p>
          )}
        </section>

        {cancelada ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Esta cita quedó cancelada.{' '}
            <Link href={`/${cita.negocio.slug}`} className="font-semibold text-tinta underline underline-offset-4">
              Reservar otra
            </Link>
          </p>
        ) : yaPaso ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Esta cita ya pasó.{' '}
            <Link href={`/${cita.negocio.slug}`} className="font-semibold text-tinta underline underline-offset-4">
              Reservar otra
            </Link>
          </p>
        ) : (
          <CancelarCita
            token={cita.token}
            puedeCancelarHasta={cita.puedeCancelarHasta}
            telefonoDelNegocio={cita.negocio.telefono}
            slug={cita.negocio.slug}
          />
        )}

        <span className="self-center text-[13px] text-tenue">
          Hecho con <strong className="font-semibold text-muted-foreground">{NOMBRE_PRODUCTO}</strong>
        </span>
      </div>
    </div>
  );
}

function Dato({
  icono,
  etiqueta,
  children,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <dt className="flex shrink-0 items-center" aria-label={etiqueta}>
        {icono}
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
