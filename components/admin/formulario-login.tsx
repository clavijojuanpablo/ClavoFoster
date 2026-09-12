'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { iniciarSesion, type EstadoLogin } from '@/app/(admin)/login/actions';

function Boton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}

export function FormularioLogin({ volver }: { volver?: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, { error: null });

  return (
    <form action={accion} className="space-y-4">
      {volver && <input type="hidden" name="volver" value={volver} />}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-400"
        />
      </div>

      {estado.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}

      <Boton />
    </form>
  );
}
