'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Error inesperado dentro del panel: una consulta que falló o la base caída.
 *
 * El detalle ya quedó registrado en el servidor; al dueño se le dice qué pasó y
 * qué puede hacer, sin códigos. El menú sigue visible para que pueda irse a
 * otra sección.
 */
export default function ErrorDelPanel({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[panel] error al mostrar la pantalla:', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex flex-col items-start gap-3 px-4 pt-5 lg:px-8 lg:pt-7">
      <h1 className="text-[26px] leading-tight font-bold">No pudimos cargar esta pantalla</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Puede ser la conexión o un problema de nuestro lado. Tus datos están a salvo. Intenta de nuevo en un momento.
      </p>
      <Button onClick={retry}>Intentar de nuevo</Button>
    </main>
  );
}
