'use client';

import { ChevronRight, CreditCard, LayoutGrid, LogOut, Plus, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cerrarSesion } from '@/app/(admin)/login/actions';
import { CopiarLink } from '@/components/admin/copiar-link';
import {
  esRutaActiva,
  MENU_NEGOCIO,
  MENU_OPERACION,
  RUTA_CONFIGURACION,
  type ItemMenu,
} from '@/components/admin/navegacion';
import type { DatosMenu } from '@/components/admin/tipos-menu';
import { iniciales } from '@/lib/formato';
import { cn } from '@/lib/utils';

/**
 * Navegación del panel en celular: barra flotante abajo con lo del día a día
 * (Inicio, Agenda, Nueva cita, Caja) y el resto en la hoja "Más".
 */
export function BarraInferior({ negocio, plan, urlPublica, rol }: DatosMenu) {
  const ruta = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);
  const [rutaAlAbrir, setRutaAlAbrir] = useState(ruta);
  const cerrarMas = useCallback(() => setMasAbierto(false), []);

  // Si la ruta cambió desde que se abrió la hoja (tocó un enlace de adentro),
  // se cierra sola. Se ajusta durante el render, no en un efecto, para que no
  // alcance a pintarse abierta sobre la página nueva.
  if (ruta !== rutaAlAbrir) {
    setRutaAlAbrir(ruta);
    if (masAbierto) setMasAbierto(false);
  }

  const [inicio, agenda] = MENU_OPERACION;
  const caja = MENU_NEGOCIO.find((i) => i.href === '/panel/caja')!;

  return (
    <>
      <nav
        aria-label="Secciones del panel"
        className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 grid h-[72px] grid-cols-5 items-center rounded-3xl bg-tinta px-1.5 shadow-[0_10px_30px_rgba(18,20,18,.18)] lg:hidden"
      >
        <ElementoBarra item={inicio} activo={!masAbierto && esRutaActiva(ruta, inicio.href)} />
        <ElementoBarra item={agenda} activo={!masAbierto && esRutaActiva(ruta, agenda.href)} />
        <div className="flex justify-center">
          {/* Crear cita desde el panel llega con la tarea G3. */}
          <span
            aria-disabled="true"
            aria-label="Nueva cita (pronto)"
            className="flex size-[52px] items-center justify-center rounded-[18px] bg-lima text-tinta opacity-40"
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </span>
        </div>
        {rol === 'owner' ? (
          <ElementoBarra item={caja} activo={!masAbierto && esRutaActiva(ruta, caja.href)} />
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setMasAbierto((v) => !v)}
          aria-expanded={masAbierto}
          aria-controls="hoja-mas"
          className={cn(
            'flex h-full flex-col items-center justify-center gap-1 text-[11px]',
            masAbierto ? 'font-semibold text-lima' : 'font-medium text-[#9da29a]',
          )}
        >
          <LayoutGrid className="size-[22px]" strokeWidth={masAbierto ? 2 : 1.8} />
          Más
        </button>
      </nav>

      {masAbierto && (
        <HojaMas
          negocio={negocio}
          plan={plan}
          urlPublica={urlPublica}
          rol={rol}
          ruta={ruta}
          onCerrar={cerrarMas}
        />
      )}
    </>
  );
}

function ElementoBarra({ item, activo }: { item: ItemMenu; activo: boolean }) {
  const Icono = item.icono;
  const clases = 'flex h-full flex-col items-center justify-center gap-1 text-[11px]';

  if (!item.disponible) {
    return (
      <span aria-disabled="true" className={cn(clases, 'font-medium text-[#5f645d]')}>
        <Icono className="size-[22px]" strokeWidth={1.8} />
        {item.etiqueta}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={activo ? 'page' : undefined}
      className={cn(clases, activo ? 'font-semibold text-lima' : 'font-medium text-[#9da29a]')}
    >
      <Icono className="size-[22px]" strokeWidth={activo ? 2 : 1.8} />
      {item.etiqueta}
    </Link>
  );
}

function HojaMas({
  negocio,
  plan,
  urlPublica,
  rol,
  ruta,
  onCerrar,
}: DatosMenu & { ruta: string; onCerrar: () => void }) {
  const hoja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hoja.current?.focus();

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    // Sin esto, deslizar sobre la hoja mueve la página de atrás.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', alTeclear);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [onCerrar]);

  const secciones = [...MENU_OPERACION.slice(2), ...MENU_NEGOCIO.filter((i) => i.href !== '/panel/caja')];

  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <button type="button" aria-label="Cerrar menú" onClick={onCerrar} className="absolute inset-0 bg-tinta/45" />

      <div
        id="hoja-mas"
        ref={hoja}
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-papel px-4 pt-2.5 pb-[calc(104px+env(safe-area-inset-bottom))] outline-none animate-in slide-in-from-bottom duration-200"
      >
        <div className="flex items-center justify-between">
          <span className="mx-auto h-[5px] w-10 rounded-full bg-[#d3d1c8]" />
        </div>

        <div className="flex items-center gap-3 rounded-[18px] border border-border bg-card p-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-tinta font-bold text-papel">
            {iniciales(negocio.nombre)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{negocio.nombre}</span>
            <span className="truncate text-[13px] text-muted-foreground">/{negocio.slug}</span>
          </span>
          {rol === 'owner' && <CopiarLink url={urlPublica} etiqueta="Copiar" />}
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {rol === 'owner' && (
          <div className="flex flex-col gap-2">
            <span className="px-1 text-[11px] font-semibold tracking-[0.08em] text-tenue uppercase">Negocio</span>
            <div className="grid grid-cols-2 gap-2">
              {secciones.map((item) => {
                const Icono = item.icono;
                const contenido = (
                  <>
                    <Icono className="size-[22px]" strokeWidth={1.8} />
                    <span className="flex items-center justify-between gap-2 text-[15px] font-semibold">
                      {item.etiqueta}
                      {!item.disponible && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Pronto
                        </span>
                      )}
                    </span>
                  </>
                );
                const clases = 'flex h-[76px] flex-col justify-between rounded-2xl border border-border bg-card px-3.5 py-3';

                return item.disponible ? (
                  <Link key={item.href} href={item.href} className={clases}>
                    {contenido}
                  </Link>
                ) : (
                  <span key={item.href} aria-disabled="true" className={cn(clases, 'text-tenue')}>
                    {contenido}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-semibold tracking-[0.08em] text-tenue uppercase">Cuenta</span>
          <div className="flex flex-col divide-y divide-linea rounded-2xl border border-border bg-card">
            {rol === 'owner' && (
              <Link
                href={RUTA_CONFIGURACION}
                aria-current={esRutaActiva(ruta, RUTA_CONFIGURACION) ? 'page' : undefined}
                className="flex h-[52px] items-center gap-3 px-3.5 text-[15px]"
              >
                <SlidersHorizontal className="size-5" strokeWidth={1.8} />
                <span className="flex-1">Perfil del negocio</span>
                <ChevronRight className="size-[18px] text-tenue" />
              </Link>
            )}
            {plan && (
              <span className="flex h-[52px] items-center gap-3 px-3.5 text-[15px]">
                <CreditCard className="size-5" strokeWidth={1.8} />
                <span className="flex-1">Suscripción</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    plan.alerta ? 'bg-estado-mal-fondo text-estado-mal' : 'bg-lima text-tinta',
                  )}
                >
                  {plan.texto}
                </span>
              </span>
            )}
            <form action={cerrarSesion}>
              <button type="submit" className="flex h-[52px] w-full items-center gap-3 px-3.5 text-[15px] text-estado-mal">
                <LogOut className="size-5" strokeWidth={1.8} />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
