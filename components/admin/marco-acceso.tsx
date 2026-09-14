import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { Marca } from '@/components/marca';

/**
 * Marco de las pantallas sin panel: entrar, registrarse y crear el negocio.
 * En escritorio, panel de marca a la izquierda; en celular, solo el formulario.
 */
export function MarcoAcceso({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative m-3 hidden flex-col justify-between overflow-hidden rounded-[28px] bg-tinta p-10 text-papel lg:flex">
        <Marca />

        <div className="flex max-w-md flex-col gap-6">
          <p className="font-heading text-[44px] leading-[1.02] font-bold tracking-[-0.03em] text-balance">
            Tu agenda se llena <span className="text-lima">sola</span>.
          </p>
          <ul className="flex flex-col gap-3 text-[15px] text-[#c9ccc5]">
            {[
              'Tus clientes reservan desde tu link, sin llamarte',
              'Agenda, equipo y caja del día en tu celular',
              '14 días gratis, sin tarjeta',
            ].map((texto) => (
              <li key={texto} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lima text-tinta">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        {/* Textura sutil: un anillo grande que asoma por la esquina. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -bottom-40 size-[420px] rounded-full border-[56px] border-tinta-suave"
        />
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-8 lg:justify-center lg:py-12">
        <div className="lg:hidden">
          <Marca sobre="claro" />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-7 pt-8 lg:flex-none lg:pt-0">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] leading-tight font-bold">{titulo}</h1>
            <p className="text-[15px] text-muted-foreground">{descripcion}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
