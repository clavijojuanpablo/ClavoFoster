import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';

import {
  FormularioTrabajador,
  type ServicioParaMarcar,
  type TrabajadorInicial,
} from '@/components/admin/formulario-trabajador';
import { ListaEquipo } from '@/components/admin/lista-equipo';
import { buttonVariants } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import type { TrabajadorDelPanel } from '@/lib/panel/equipo';
import { cn } from '@/lib/utils';

/**
 * Pantalla de agregar o editar a una persona del equipo. Mismo esquema que el
 * editor de servicios: lista a la izquierda en escritorio, pantalla propia en
 * celular.
 */
export function EditorTrabajador({
  businessId,
  equipo,
  servicios,
  inicial,
  citasProximas,
}: {
  businessId: string;
  equipo: TrabajadorDelPanel[];
  servicios: ServicioParaMarcar[];
  inicial: TrabajadorInicial;
  citasProximas: number | null;
}) {
  const titulo = inicial.id ? 'Editar persona' : 'Agregar persona';
  const vista = inicial.activo ? 'activos' : 'desactivados';
  const volver = vista === 'activos' ? '/panel/equipo' : '/panel/equipo?ver=desactivados';

  return (
    <main className="flex w-full flex-col gap-4 px-4 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:items-start lg:gap-6 lg:px-8 lg:pt-7 lg:pb-8">
      <div className="hidden lg:block">
        <ListaEquipo
          equipo={equipo}
          idsServiciosActivos={new Set(servicios.map((s) => s.id))}
          vista={vista}
          seleccionadoId={inicial.id ?? undefined}
        />
      </div>

      <Link href={volver} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground lg:hidden">
        <ArrowLeft className="size-4" />
        Equipo
      </Link>

      <Tarjeta className="flex flex-col lg:sticky lg:top-3">
        <header className="flex items-center justify-between gap-3 border-b border-linea px-[18px] py-4 lg:px-6 lg:py-5">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[22px] leading-tight font-bold">{titulo}</h2>
            {!inicial.activo && (
              <span className="text-[13px] text-muted-foreground">
                Desactivada: no aparece en tu página ni recibe reservas.
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

        {/* key: al pasar de una persona a otra, el formulario arranca de cero. */}
        <FormularioTrabajador
          key={inicial.id ?? 'nueva'}
          businessId={businessId}
          inicial={inicial}
          servicios={servicios}
          citasProximas={citasProximas}
        />
      </Tarjeta>
    </main>
  );
}
