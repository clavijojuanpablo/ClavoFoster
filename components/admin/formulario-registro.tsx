'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { registrarse, type EstadoRegistro } from '@/app/(admin)/registro/actions';
import { AvisoError, Campo, CLASES_BOTON_PRIMARIO } from '@/components/admin/campo';

const INICIAL: EstadoRegistro = { error: null, campos: {}, enviadoA: null, valores: {} };

export function FormularioRegistro() {
  const [estado, accion, enviando] = useActionState(registrarse, INICIAL);

  if (estado.enviadoA) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-md bg-neutral-100 p-4 dark:bg-neutral-900">
          Te mandamos un enlace a <strong>{estado.enviadoA}</strong>. Ábrelo para
          confirmar tu correo y seguir configurando tu negocio.
        </p>
        <p className="text-neutral-600 dark:text-neutral-400">
          ¿No llega? Revisa la carpeta de spam. Si ya tenías cuenta con ese
          correo,{' '}
          <Link href="/login" className="underline underline-offset-2">
            entra con tu contraseña
          </Link>
          .
        </p>
      </div>
    );
  }

  // Los valores se conservan entre intentos: con useActionState el formulario
  // se reinicia al volver del servidor, y hacerle reescribir todo por un celular
  // mal escrito es la forma más rápida de que abandone.
  return (
    <form action={accion} className="space-y-4" noValidate>
      <Campo
        name="nombreNegocio"
        etiqueta="Nombre del negocio"
        autoComplete="organization"
        required
        maxLength={80}
        defaultValue={estado.valores.nombreNegocio}
        error={estado.campos.nombreNegocio}
      />
      <Campo
        name="celular"
        etiqueta="Celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="300 123 4567"
        defaultValue={estado.valores.celular}
        ayuda="Por WhatsApp te avisamos de las citas nuevas."
        error={estado.campos.celular}
      />
      <Campo
        name="email"
        etiqueta="Correo"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores.email}
        error={estado.campos.email}
      />
      <Campo
        name="password"
        etiqueta="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        ayuda="Mínimo 8 caracteres."
        error={estado.campos.password}
      />

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      <button type="submit" disabled={enviando} className={CLASES_BOTON_PRIMARIO}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline underline-offset-2">
          Entra
        </Link>
      </p>
    </form>
  );
}
