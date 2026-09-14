import type { InputHTMLAttributes, ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Borde, alto y foco de todo control de formulario. Se reutiliza en selects e inputs a medida. */
export const CLASES_CONTROL =
  'h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-tinta outline-none transition placeholder:text-tenue focus:border-tinta focus:ring-4 focus:ring-lima/40 aria-invalid:border-destructive aria-invalid:focus:ring-estado-mal-fondo disabled:opacity-60';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
};

/** Input con etiqueta, ayuda y error, enlazados para lectores de pantalla. */
export function Campo({ name, etiqueta, error, ayuda, id, className, ...props }: Props) {
  const idInput = id ?? name;
  const idError = `${idInput}-error`;
  const idAyuda = `${idInput}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idInput} className="text-sm font-semibold">
        {etiqueta}
      </label>
      <input
        id={idInput}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error && idError, ayuda && idAyuda].filter(Boolean).join(' ') || undefined}
        className={cn(CLASES_CONTROL, className)}
        {...props}
      />
      {ayuda && !error && (
        <p id={idAyuda} className="text-[13px] text-muted-foreground">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-estado-mal-fondo px-4 py-3 text-sm text-estado-mal">
      {children}
    </p>
  );
}

export const CLASES_BOTON_PRIMARIO = buttonVariants({ size: 'lg', className: 'w-full' });
