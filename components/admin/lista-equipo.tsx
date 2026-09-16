import { CalendarOff, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';

import { AvatarTrabajador } from '@/components/admin/avatar-trabajador';
import { Pestana, Pestanas } from '@/components/admin/pestanas';
import { buttonVariants } from '@/components/ui/button';
import type { TrabajadorDelPanel } from '@/lib/panel/equipo';
import { cn } from '@/lib/utils';

export type VistaEquipo = 'activos' | 'desactivados';

/**
 * Encabezado, pestañas y lista del equipo (D1).
 *
 * Mismo esquema que la lista de servicios: en escritorio convive con el editor
 * a la derecha; en celular el editor abre su propia pantalla.
 */
export function ListaEquipo({
  equipo,
  idsServiciosActivos,
  vista,
  seleccionadoId,
}: {
  equipo: TrabajadorDelPanel[];
  /** Para contar solo los servicios que hoy se pueden reservar. */
  idsServiciosActivos: Set<string>;
  vista: VistaEquipo;
  seleccionadoId?: string;
}) {
  const activos = equipo.filter((t) => t.activo);
  const desactivados = equipo.filter((t) => !t.activo);
  const visibles = vista === 'activos' ? activos : desactivados;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] leading-tight font-bold lg:text-[32px]">Equipo</h1>
          <p className="text-sm text-muted-foreground">Quién atiende en tu negocio y qué hace cada uno.</p>
        </div>
        <Link href="/panel/equipo/nuevo" className={cn(buttonVariants(), 'pl-3.5')}>
          <span className="flex size-6 items-center justify-center rounded-full bg-lima text-tinta">
            <Plus className="size-3.5" strokeWidth={2.6} />
          </span>
          <span className="hidden sm:inline">Agregar persona</span>
          <span className="sm:hidden">Agregar</span>
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pestanas etiqueta="Filtrar equipo">
          <Pestana href="/panel/equipo" activa={vista === 'activos'}>
            Activos · {activos.length}
          </Pestana>
          <Pestana href="/panel/equipo?ver=desactivados" activa={vista === 'desactivados'}>
            Desactivados · {desactivados.length}
          </Pestana>
        </Pestanas>
        <Link href="/panel/equipo/ausencias" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          <CalendarOff />
          Ausencias y cierres
        </Link>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground">
          {vista === 'activos'
            ? 'Todavía no has agregado a nadie. Agrega a quienes atienden, aunque trabajes solo: tus clientes reservan con una persona.'
            : 'No tienes personas desactivadas.'}
        </p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-[20px] border border-border bg-card">
          {visibles.map((t) => {
            const cuantos = t.servicios.filter((id) => idsServiciosActivos.has(id)).length;
            const aviso = !t.activo ? null : cuantos === 0 ? 'No presta ningún servicio' : t.turnos.length === 0 ? 'Sin horario' : null;
            return (
              <li key={t.id}>
                <Link
                  href={`/panel/equipo/${t.id}`}
                  aria-current={t.id === seleccionadoId ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted/60 sm:px-5',
                    t.id === seleccionadoId && 'bg-lima/15 hover:bg-lima/15',
                  )}
                >
                  <AvatarTrabajador nombre={t.nombre} foto={t.foto} className={cn(!t.activo && 'opacity-50')} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate text-[15px] font-semibold', !t.activo && 'text-muted-foreground')}>
                      {t.nombre}
                    </span>
                    <span
                      className={cn(
                        'truncate text-[13px]',
                        aviso ? 'font-semibold text-estado-espera' : 'text-muted-foreground',
                      )}
                    >
                      {aviso ?? `${cuantos} ${cuantos === 1 ? 'servicio' : 'servicios'}`}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn('size-[18px] shrink-0', t.id === seleccionadoId ? 'text-tinta' : 'text-tenue')}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
