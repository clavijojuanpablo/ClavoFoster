'use client';

import { useActionState } from 'react';

import { iniciarSesion, type EstadoLogin } from '@/app/(admin)/login/actions';
import { AvisoError, Campo, CLASES_BOTON_PRIMARIO } from '@/components/admin/campo';

export function FormularioLogin({ volver }: { volver?: string }) {
  const [estado, accion, entrando] = useActionState<EstadoLogin, FormData>(iniciarSesion, { error: null });

  return (
    <form action={accion} className="flex flex-col gap-4">
      {volver && <input type="hidden" name="volver" value={volver} />}

      <Campo name="email" etiqueta="Correo" type="email" autoComplete="email" required />
      <Campo name="password" etiqueta="Contraseña" type="password" autoComplete="current-password" required />

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      <button type="submit" disabled={entrando} className={CLASES_BOTON_PRIMARIO}>
        {entrando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
