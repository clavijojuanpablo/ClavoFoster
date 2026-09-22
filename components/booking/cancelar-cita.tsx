'use client';

import { CalendarClock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { cancelarCita } from '@/app/(public)/cita/[token]/actions';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Cancelar la cita, con una confirmación de por medio (F6).
 *
 * La confirmación no es burocracia: el botón está en una página que se abre
 * desde un chat, donde es fácil tocarlo sin querer, y cancelar no se deshace.
 *
 * Fuera del plazo que puso el negocio, el botón no aparece: en su lugar queda el
 * teléfono, que es lo que de verdad sirve a esa altura.
 */

type Props = {
  token: string;
  puedeCancelarHasta: string;
  telefonoDelNegocio: string | null;
  slug: string;
};

export function CancelarCita({ token, puedeCancelarHasta, telefonoDelNegocio, slug }: Props) {
  const router = useRouter();
  const [preguntando, setPreguntando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const fueraDePlazo = new Date(puedeCancelarHasta) <= new Date();

  if (fueraDePlazo) {
    return (
      <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Ya es muy tarde para cancelar por acá.
        {telefonoDelNegocio ? (
          <>
            {' '}
            Escribe o llama al{' '}
            <a href={`tel:${telefonoDelNegocio}`} className="font-semibold text-tinta underline underline-offset-4">
              {telefonoDelNegocio}
            </a>
            .
          </>
        ) : (
          ' Comunícate con el negocio.'
        )}
      </p>
    );
  }

  if (!preguntando) {
    return (
      <div className="flex flex-col gap-3">
        <Link href={`/${slug}/reservar?mover=${token}`} className={buttonVariants({ size: 'lg' })}>
          <CalendarClock className="size-[18px]" />
          Cambiar la hora
        </Link>
        <Button variant="outline" size="lg" onClick={() => setPreguntando(true)}>
          Cancelar mi cita
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">¿Seguro que quieres cancelar?</p>
      <p className="text-sm text-muted-foreground">
        El cupo queda libre para otra persona de inmediato y esto no se puede deshacer.
      </p>

      {error && (
        <p role="alert" className="rounded-xl bg-estado-mal-fondo px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setPreguntando(false)} disabled={trabajando}>
          No, dejarla
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={trabajando}
          onClick={() =>
            empezar(async () => {
              const r = await cancelarCita({ token });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              router.refresh();
            })
          }
        >
          {trabajando && <Loader2 className="size-[18px] animate-spin" />}
          Sí, cancelar
        </Button>
      </div>
    </div>
  );
}
