import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';

import { FormularioServicio, type ServicioInicial } from '@/components/admin/formulario-servicio';
import { ListaServicios } from '@/components/admin/lista-servicios';
import { buttonVariants } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import type { ServicioDelPanel } from '@/lib/panel/servicios';
import { cn } from '@/lib/utils';

/**
 * Pantalla de crear o editar un servicio.
 *
 * En escritorio la lista queda a la izquierda y el editor a la derecha, como
 * en la maqueta. En celular el editor ocupa la pantalla y se vuelve con la
 * flecha: una lista y un formulario apilados no caben en 375 px.
 */
export function EditorServicio({
  servicios,
  inicial,
}: {
  servicios: ServicioDelPanel[];
  inicial: ServicioInicial;
}) {
  const titulo = inicial.id ? 'Editar servicio' : 'Nuevo servicio';
  const vista = inicial.activo ? 'activos' : 'desactivados';
  const volver = vista === 'activos' ? '/panel/servicios' : '/panel/servicios?ver=desactivados';

  return (
    <main className="flex w-full flex-col gap-4 px-4 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:items-start lg:gap-6 lg:px-8 lg:pt-7 lg:pb-8">
      <div className="hidden lg:block">
        <ListaServicios servicios={servicios} vista={vista} seleccionadoId={inicial.id ?? undefined} />
      </div>

      <Link href={volver} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground lg:hidden">
        <ArrowLeft className="size-4" />
        Servicios
      </Link>

      <Tarjeta className="flex flex-col lg:sticky lg:top-3">
        <header className="flex items-center justify-between gap-3 border-b border-linea px-[18px] py-4 lg:px-6 lg:py-5">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[22px] leading-tight font-bold">{titulo}</h2>
            {!inicial.activo && (
              <span className="text-[13px] text-muted-foreground">
                Desactivado: no aparece en tu página ni se puede reservar.
              </span>
            )}
          </div>
          <Link
            href={volver}
            aria-label="Cerrar"
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'hidden bg-papel lg:inline-flex')}
          >
            <X />
          </Link>
        </header>

        {/* key: al pasar de un servicio a otro, el formulario arranca de cero. */}
        <FormularioServicio key={inicial.id ?? 'nuevo'} inicial={inicial} />
      </Tarjeta>
    </main>
  );
}
