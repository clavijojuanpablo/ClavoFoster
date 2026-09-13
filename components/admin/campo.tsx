import type { InputHTMLAttributes, ReactNode } from 'react';

const CLASES_INPUT =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
};

/** Input con etiqueta, ayuda y error, enlazados para lectores de pantalla. */
export function Campo({ name, etiqueta, error, ayuda, id, ...props }: Props) {
  const idInput = id ?? name;
  const idError = `${idInput}-error`;
  const idAyuda = `${idInput}-ayuda`;

  return (
    <div>
      <label htmlFor={idInput} className="block text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={idInput}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error && idError, ayuda && idAyuda].filter(Boolean).join(' ') || undefined}
        className={`mt-1 ${CLASES_INPUT}`}
        {...props}
      />
      {ayuda && !error && (
        <p id={idAyuda} className="mt-1 text-xs text-neutral-500">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

export const CLASES_BOTON_PRIMARIO =
  'w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200';
