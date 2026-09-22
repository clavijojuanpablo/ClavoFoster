'use client';

import { Check, Loader2, MessageCircle, Phone, UserX, X } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { cambiarEstadoDeCita } from '@/app/(admin)/panel/agenda/actions';
import { EstadoCita } from '@/components/admin/estado-cita';
import { Button } from '@/components/ui/button';
import { duracion, fechaLarga, hora, pesos } from '@/lib/formato';
import type { CitaEnAgenda } from '@/lib/agenda/tipos';

/**
 * El detalle de la cita y lo que se puede hacer con ella (G2 y G5).
 *
 * Sale como hoja desde abajo en celular y como panel lateral en escritorio: en
 * el local el dueño mira esto con una mano mientras corta con la otra, y una
 * hoja que se cierra tocando afuera es más rápida que navegar a otra pantalla.
 *
 * Lo que más se usa —marcar cumplida y escribir al cliente— queda arriba y en
 * grande. Cancelar no: es lo que menos se hace y lo que no se deshace.
 */

export function DetalleCita({
  cita,
  timezone,
  puedeEditar,
  onCerrar,
}: {
  cita: CitaEnAgenda;
  timezone: string;
  /** El trabajador marca sus citas; cancelar es del dueño. */
  puedeEditar: boolean;
  onCerrar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [trabajando, empezar] = useTransition();

  // Escape cierra: es lo que espera cualquiera con un teclado al frente.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCerrar]);

  function cambiar(estado: 'completed' | 'no_show' | 'confirmed' | 'cancelled') {
    setError(null);
    empezar(async () => {
      const r = await cambiarEstadoDeCita({ citaId: cita.id, estado });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onCerrar();
    });
  }

  const inicio = new Date(cita.inicio);
  const whatsapp =
    cita.telefono && /^\+\d{8,15}$/.test(cita.telefono) ? `https://wa.me/${cita.telefono.slice(1)}` : null;
  const yaPaso = new Date(cita.fin) < new Date();
  const abierta = cita.estado === 'confirmed' || cita.estado === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cita de ${cita.cliente}`}
        className="relative flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <header className="flex items-start gap-3">
          <span
            className="mt-1 h-10 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: cita.color }}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="truncate text-xl font-bold">{cita.cliente}</h2>
            <span className="text-sm text-muted-foreground first-letter:uppercase">
              {fechaLarga(timezone, inicio)} · {hora(timezone, cita.inicio)}
            </span>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-tinta"
          >
            <X className="size-5" />
          </button>
        </header>

        <dl className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-4 text-[15px]">
          <Dato etiqueta="Servicio">
            {cita.servicio} · {duracion(cita.duracionMinutos)}
          </Dato>
          <Dato etiqueta="Precio">
            <strong className="font-bold">{pesos(cita.precioCop)}</strong>
          </Dato>
          {cita.trabajador && <Dato etiqueta="Atiende">{cita.trabajador}</Dato>}
          <Dato etiqueta="Estado">
            <EstadoCita estado={cita.estado} />
          </Dato>
        </dl>

        {cita.notaDelCliente && (
          <p className="rounded-2xl border border-border p-4 text-sm">
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-tenue uppercase">
              Nota del cliente
            </span>
            {cita.notaDelCliente}
          </p>
        )}

        {cita.telefono && (
          <div className="flex gap-2">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-tinta text-[15px] font-semibold text-white transition hover:bg-tinta/85"
              >
                <MessageCircle className="size-[18px]" />
                WhatsApp
              </a>
            )}
            <a
              href={`tel:${cita.telefono}`}
              aria-label={`Llamar a ${cita.cliente}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-input text-tinta transition hover:bg-muted"
            >
              <Phone className="size-[18px]" />
            </a>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-estado-mal-fondo px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {puedeEditar && abierta && (
          <div className="flex flex-col gap-2">
            {/* Lo que de verdad se usa al terminar de atender. */}
            <Button variant="acento" size="lg" disabled={trabajando} onClick={() => cambiar('completed')}>
              {trabajando ? <Loader2 className="size-[18px] animate-spin" /> : <Check className="size-[18px]" />}
              Marcar cumplida
            </Button>

            {/* Antes de la hora, decir que no llegó no tiene sentido todavía. */}
            {yaPaso && (
              <Button variant="outline" size="lg" disabled={trabajando} onClick={() => cambiar('no_show')}>
                <UserX className="size-[18px]" />
                No llegó
              </Button>
            )}

            {confirmandoCancelar ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold">¿Cancelar esta cita?</p>
                <p className="text-sm text-muted-foreground">
                  El cupo queda libre de inmediato. Avísale tú al cliente: esto no le manda ningún mensaje.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" disabled={trabajando} onClick={() => setConfirmandoCancelar(false)}>
                    No, dejarla
                  </Button>
                  <Button variant="destructive" className="flex-1" disabled={trabajando} onClick={() => cambiar('cancelled')}>
                    Sí, cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="destructive" size="lg" disabled={trabajando} onClick={() => setConfirmandoCancelar(true)}>
                Cancelar la cita
              </Button>
            )}
          </div>
        )}

        {puedeEditar && !abierta && (
          <Button variant="outline" size="lg" disabled={trabajando} onClick={() => cambiar('confirmed')}>
            {trabajando && <Loader2 className="size-[18px] animate-spin" />}
            Volver a confirmarla
          </Button>
        )}
      </div>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[13px] text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}
