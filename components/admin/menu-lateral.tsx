'use client';

import { ExternalLink, LogOut, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cerrarSesion } from '@/app/(admin)/login/actions';
import { CopiarLink } from '@/components/admin/copiar-link';
import { Marca } from '@/components/marca';
import {
  esRutaActiva,
  MENU_NEGOCIO,
  MENU_OPERACION,
  RUTA_CONFIGURACION,
  visiblesPara,
  type ItemMenu,
} from '@/components/admin/navegacion';
import type { DatosMenu } from '@/components/admin/tipos-menu';
import { iniciales } from '@/lib/formato';
import { cn } from '@/lib/utils';

/** Menú del panel en escritorio: tarjeta oscura fija a la izquierda. */
export function MenuLateral({ negocio, plan, urlPublica, rol }: DatosMenu) {
  const ruta = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh p-3 pr-0 lg:block">
      <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-3xl bg-sidebar px-3.5 py-5 text-papel">
        <Link href="/panel" className="px-2">
          <Marca />
        </Link>

        <div className="flex items-center gap-2.5 rounded-2xl bg-sidebar-accent p-2.5">
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-papel text-sm font-bold text-tinta">
            {iniciales(negocio.nombre)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{negocio.nombre}</span>
            {plan && <span className={cn('text-xs', plan.alerta ? 'text-[#f5a38c]' : 'text-lima')}>{plan.texto}</span>}
          </span>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Secciones del panel">
          <Grupo titulo="Operación" items={visiblesPara(MENU_OPERACION, rol)} ruta={ruta} />
          {rol === 'owner' && <Grupo titulo="Negocio" items={MENU_NEGOCIO} ruta={ruta} className="mt-4" />}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5">
        {rol === 'owner' && (
          <>
            <div className="flex flex-col gap-2.5 rounded-2xl border border-sidebar-border p-3.5">
              <span className="text-xs text-[#9da29a]">Tu página de reservas</span>
              <span className="truncate text-sm font-semibold">/{negocio.slug}</span>
              <div className="flex gap-2">
                <CopiarLink url={urlPublica} className="flex-1" />
                <a
                  href={`/${negocio.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-9 items-center justify-center rounded-[10px] bg-sidebar-accent text-papel transition hover:bg-[#2a2e2a]"
                  aria-label="Abrir mi página en otra pestaña"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
              {!negocio.publicada && (
                <span className="text-xs text-[#f5a38c]">Está oculta. Actívala en Configuración.</span>
              )}
            </div>
            <ElementoMenu
              item={{ etiqueta: 'Configuración', href: RUTA_CONFIGURACION, icono: SlidersHorizontal, disponible: true, soloDueno: true }}
              activo={esRutaActiva(ruta, RUTA_CONFIGURACION)}
            />
          </>
        )}
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-papel"
            >
              <LogOut className="size-5" strokeWidth={1.8} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function Grupo({ titulo, items, ruta, className }: { titulo: string; items: ItemMenu[]; ruta: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-[#7c817a] uppercase">{titulo}</span>
      {items.map((item) => (
        <ElementoMenu key={item.href} item={item} activo={esRutaActiva(ruta, item.href)} />
      ))}
    </div>
  );
}

function ElementoMenu({ item, activo }: { item: ItemMenu; activo: boolean }) {
  const Icono = item.icono;
  const clases = 'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition';

  if (!item.disponible) {
    return (
      <span className={cn(clases, 'cursor-default text-[#6f746d]')} aria-disabled="true">
        <Icono className="size-5" strokeWidth={1.8} />
        <span className="flex-1">{item.etiqueta}</span>
        <span className="rounded-full border border-sidebar-border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">Pronto</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={activo ? 'page' : undefined}
      className={cn(
        clases,
        activo
          ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground'
          : 'font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-papel',
      )}
    >
      <Icono className="size-5" strokeWidth={1.8} />
      {item.etiqueta}
    </Link>
  );
}
