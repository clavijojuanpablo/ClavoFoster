'use client';

import { ArrowLeft, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { confirmarCodigo, pedirCodigo, reservar } from '@/app/(public)/[slug]/reservar/actions';
import { Button } from '@/components/ui/button';
import type { Cupo, ServicioReservable } from '@/lib/booking/tipos';
import { pesos } from '@/lib/formato';
import { NOMBRE_MAX, NOTA_MAX } from '@/lib/validation/reserva';

/**
 * Confirmar la cita: celular, código de WhatsApp y nombre si es la primera vez
 * (tareas F4 y F5).
 *
 * El cliente final no tiene cuenta ni contraseña — ese es el punto del producto.
 * Lo único que se le pide es el celular, y el nombre solo la primera vez que
 * viene a ESTE negocio; la segunda vez ya lo reconoce.
 */

type Paso = 'celular' | 'codigo' | 'datos';

type Props = {
  slug: string;
  servicio: ServicioReservable;
  cupo: Cupo;
  cuando: string;
  precioCop: number;
  /** Falso mientras no haya credenciales de Meta: el código va al log del servidor. */
  whatsappConfigurado: boolean;
  onVolver: () => void;
  /** El cupo se ocupó mientras el cliente escribía: hay que volver a escoger. */
  onCupoOcupado: () => void;
};

export function Confirmacion({
  slug,
  servicio,
  cupo,
  cuando,
  precioCop,
  whatsappConfigurado,
  onVolver,
  onCupoOcupado,
}: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('celular');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enmascarado, setEnmascarado] = useState('');
  const [token, setToken] = useState('');
  const [nombre, setNombre] = useState('');
  const [esClienteNuevo, setEsClienteNuevo] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [faltanParaReenviar, setFaltanParaReenviar] = useState(0);
  const [trabajando, empezar] = useTransition();

  const campoCodigo = useRef<HTMLInputElement>(null);

  // La cuenta regresiva del reenvío. Se apaga sola al llegar a cero.
  useEffect(() => {
    if (faltanParaReenviar <= 0) return;
    const id = setTimeout(() => setFaltanParaReenviar((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [faltanParaReenviar]);

  useEffect(() => {
    if (paso === 'codigo') campoCodigo.current?.focus();
  }, [paso]);

  function enviarCodigo() {
    setError(null);
    empezar(async () => {
      const r = await pedirCodigo({ slug, telefono });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEnmascarado(r.enmascarado);
      setFaltanParaReenviar(r.puedeReenviarEnSegundos);
      setCodigo('');
      setPaso('codigo');
    });
  }

  function revisarCodigo() {
    setError(null);
    empezar(async () => {
      const r = await confirmarCodigo({ slug, telefono, codigo });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setToken(r.token);
      setEsClienteNuevo(r.esClienteNuevo);
      setNombre(r.nombre ?? '');
      setPaso('datos');
    });
  }

  function guardarCita() {
    setError(null);
    empezar(async () => {
      const r = await reservar({
        slug,
        serviceId: servicio.id,
        staffId: cupo.staffId,
        inicio: cupo.inicio,
        token,
        nombre: nombre.trim() || null,
        nota: nota.trim() || null,
      });

      if (!r.ok) {
        if (r.cupoOcupado) {
          onCupoOcupado();
          return;
        }
        setError(r.error);
        return;
      }

      router.push(r.linkDeGestion);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onVolver}
        className="-ml-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-tinta"
      >
        <ArrowLeft className="size-4" />
        Cambiar la hora
      </button>

      <section className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-[18px]">
        <span className="text-[11px] font-semibold tracking-wide text-tenue uppercase">Tu cita</span>
        <span className="font-heading text-xl font-bold">{cuando}</span>
        <span className="text-sm text-muted-foreground">
          {servicio.nombre} · {cupo.staffNombre} · {pesos(precioCop)}
        </span>
      </section>

      {paso === 'celular' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[22px] font-bold">¿Cuál es tu celular?</h2>
          <p className="text-sm text-muted-foreground">
            Te mandamos un código por WhatsApp para confirmar que eres tú. No necesitas crear una cuenta.
          </p>

          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && telefono && enviarCodigo()}
            placeholder="300 123 4567"
            aria-label="Tu celular"
            className="h-12 rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-lima/70"
          />

          {error && <Error>{error}</Error>}

          <Button size="lg" onClick={enviarCodigo} disabled={trabajando || telefono.trim().length < 7}>
            {trabajando ? <Loader2 className="size-[18px] animate-spin" /> : <MessageCircle className="size-[18px]" />}
            Enviarme el código
          </Button>
        </section>
      )}

      {paso === 'codigo' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[22px] font-bold">Escribe el código</h2>
          <p className="text-sm text-muted-foreground">
            Te lo mandamos a <strong className="font-semibold text-tinta">{enmascarado}</strong>. Son seis números.
          </p>

          {!whatsappConfigurado && (
            <p className="rounded-xl border border-dashed border-input bg-muted px-4 py-3 text-[13px] text-muted-foreground">
              <strong className="font-semibold text-tinta">Modo de prueba:</strong> todavía no hay credenciales de
              WhatsApp, así que el código no se envía — sale en el registro del servidor.
            </p>
          )}

          <input
            ref={campoCodigo}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && revisarCodigo()}
            aria-label="Código de seis números"
            className="h-14 rounded-xl border border-input bg-card px-4 text-center font-heading text-2xl font-bold tracking-[0.4em] outline-none focus-visible:ring-4 focus-visible:ring-lima/70"
          />

          {error && <Error>{error}</Error>}

          <Button size="lg" onClick={revisarCodigo} disabled={trabajando || codigo.length !== 6}>
            {trabajando ? <Loader2 className="size-[18px] animate-spin" /> : <ShieldCheck className="size-[18px]" />}
            Continuar
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setPaso('celular');
                setError(null);
              }}
              className="font-semibold text-muted-foreground underline underline-offset-4 hover:text-tinta"
            >
              Cambiar el número
            </button>
            <button
              type="button"
              onClick={enviarCodigo}
              disabled={trabajando || faltanParaReenviar > 0}
              className="font-semibold text-tinta underline underline-offset-4 disabled:text-tenue disabled:no-underline"
            >
              {faltanParaReenviar > 0 ? `Reenviar en ${faltanParaReenviar}s` : 'Reenviar el código'}
            </button>
          </div>
        </section>
      )}

      {paso === 'datos' && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[22px] font-bold">
            {esClienteNuevo ? '¿Cómo te llamas?' : `Hola, ${primerNombre(nombre)}`}
          </h2>

          {esClienteNuevo ? (
            <input
              type="text"
              autoComplete="name"
              autoFocus
              maxLength={NOMBRE_MAX}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              aria-label="Tu nombre"
              className="h-12 rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-lima/70"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Ya te conocemos, así que no tienes que escribir nada más.</p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-tenue uppercase">
              ¿Algo que debamos saber? (opcional)
            </span>
            <textarea
              rows={2}
              maxLength={NOTA_MAX}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: voy con mi hijo, también quiere corte"
              className="resize-none rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-lima/70"
            />
          </label>

          {error && <Error>{error}</Error>}

          <Button
            size="lg"
            variant="acento"
            onClick={guardarCita}
            disabled={trabajando || (esClienteNuevo && nombre.trim().length < 2)}
          >
            {trabajando && <Loader2 className="size-[18px] animate-spin" />}
            Confirmar mi cita
          </Button>
        </section>
      )}
    </div>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-estado-mal-fondo px-4 py-3 text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || 'de nuevo';
}
