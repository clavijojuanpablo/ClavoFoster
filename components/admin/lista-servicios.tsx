import { ChevronRight, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { duracion, pesos } from '@/lib/formato';
import type { ServicioDelPanel } from '@/lib/panel/servicios';
import { cn } from '@/lib/utils';

export type VistaServicios = 'activos' | 'desactivados';

/**
 * Encabezado, pestañas y lista de servicios (tarea C1).
 *
 * En escritorio convive con el editor a la derecha; en celular el editor abre
 * su propia pantalla y esta lista se oculta.
 */
export function ListaServicios({
  servicios,
  vista,
  seleccionadoId,
}: {
  servicios: ServicioDelPanel[];
  vista: VistaServicios;
  seleccionadoId?: string;
}) {
  const activos = servicios.filter((s) => s.activo);
  const desactivados = servicios.filter((s) => !s.activo);
  const visibles = vista === 'activos' ? activos : desactivados;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] leading-tight font-bold lg:text-[32px]">Servicios</h1>
          <p className="text-sm text-muted-foreground">Lo que ofreces, cuánto dura y cuánto cuesta.</p>
        </div>
        <Link href="/panel/servicios/nuevo" className={cn(buttonVariants(), 'pl-3.5')}>
          <span className="flex size-6 items-center justify-center rounded-full bg-lima text-tinta">
            <Plus className="size-3.5" strokeWidth={2.6} />
          </span>
          <span className="hidden sm:inline">Nuevo servicio</span>
          <span className="sm:hidden">Nuevo</span>
        </Link>
      </header>

      <nav aria-label="Filtrar servicios" className="flex w-fit gap-1 rounded-full bg-muted p-1">
        <Pestana href="/panel/servicios" activa={vista === 'activos'}>
          Activos · {activos.length}
        </Pestana>
        <Pestana href="/panel/servicios?ver=desactivados" activa={vista === 'desactivados'}>
          Desactivados · {desactivados.length}
        </Pestana>
      </nav>

      {visibles.length === 0 ? (
        <p className="rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground">
          {vista === 'activos'
            ? 'No tienes servicios activos. Tus clientes no pueden reservar hasta que crees uno.'
            : 'No tienes servicios desactivados.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_110px_20px] gap-4 border-b border-linea px-5 py-3 text-xs font-semibold tracking-[0.06em] text-tenue uppercase sm:grid">
            <span>Servicio</span>
            <span>Duración</span>
            <span className="text-right">Precio</span>
            <span />
          </div>
          <ul className="divide-y divide-linea">
            {visibles.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/panel/servicios/${s.id}`}
                  aria-current={s.id === seleccionadoId ? 'true' : undefined}
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 px-4 py-3.5 transition hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_96px_110px_20px] sm:gap-4 sm:px-5',
                    s.id === seleccionadoId && 'bg-lima/15 hover:bg-lima/15',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn('size-9 shrink-0 rounded-[11px]', !s.activo && 'opacity-40')}
                      style={{ background: s.color }}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className={cn('truncate text-[15px] font-semibold', !s.activo && 'text-muted-foreground')}>
                        {s.nombre}
                      </span>
                      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
                        <Clock className="size-3.5 shrink-0 sm:hidden" />
                        <span className="truncate">
                          <span className="sm:hidden">
                            {duracion(s.duracionMinutos)}
                            {s.descripcion && ' · '}
                          </span>
                          {s.descripcion}
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden text-sm sm:block">{duracion(s.duracionMinutos)}</span>
                  <span className="text-right text-[15px] font-semibold">{pesos(s.precioCop)}</span>
                  <ChevronRight
                    className={cn('size-[18px]', s.id === seleccionadoId ? 'text-tinta' : 'text-tenue')}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-center gap-3 rounded-2xl border border-dashed border-input px-4 py-3.5 text-sm text-muted-foreground">
        <Clock className="size-5 shrink-0" aria-hidden="true" />
        La duración incluye todo el tiempo que necesitas: si limpias o preparas entre clientes, súmalo aquí.
      </p>
    </div>
  );
}

function Pestana({ href, activa, children }: { href: string; activa: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activa ? 'page' : undefined}
      className={cn(
        'rounded-full px-3.5 py-2 text-sm transition',
        activa ? 'bg-card font-semibold text-tinta shadow-[0_1px_2px_rgba(18,20,18,.08)]' : 'text-muted-foreground hover:text-tinta',
      )}
    >
      {children}
    </Link>
  );
}
