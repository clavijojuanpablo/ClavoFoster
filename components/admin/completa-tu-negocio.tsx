'use client';

import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import type { PasoPendiente } from '@/lib/panel/resumen-del-dia';

/**
 * Recordatorio pequeño de lo que le falta al negocio para quedar completo.
 *
 * A propósito discreto: cuando el negocio está completo sobra, así que no
 * ocupa un lugar principal del Inicio. Desaparece solo al completar todo, y el
 * dueño lo puede cerrar antes.
 *
 * Cerrarlo se recuerda en este navegador (localStorage), no en la base: es una
 * preferencia de pantalla, no un dato del negocio.
 */
export function CompletaTuNegocio({ businessId, pasos }: { businessId: string; pasos: PasoPendiente[] }) {
  const clave = `completa-negocio-cerrado:${businessId}`;
  const cerrado = useSyncExternalStore(
    suscribir,
    () => leer(clave),
    // En el servidor no hay localStorage: se renderiza cerrado y el navegador
    // lo abre si corresponde, en vez de mostrarlo y esconderlo de golpe.
    () => true,
  );

  const hechos = pasos.filter((p) => p.hecho).length;
  const siguiente = pasos.find((p) => !p.hecho);

  if (cerrado || !siguiente) return null;

  return (
    <aside className="flex items-center gap-3 rounded-2xl border border-border bg-card py-2.5 pr-2 pl-3.5">
      <span
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: `conic-gradient(var(--tinta) ${(hechos / pasos.length) * 360}deg, var(--muted) 0)` }}
        aria-hidden="true"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-card">
          {hechos}/{pasos.length}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] text-muted-foreground">
          Completa tu negocio · {hechos} de {pasos.length}
        </span>
        {siguiente.href ? (
          <Link href={siguiente.href} className="flex items-center gap-1 truncate text-sm font-semibold hover:underline">
            {siguiente.etiqueta}
            <ChevronRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold">
            {siguiente.etiqueta} <span className="font-normal text-tenue">· muy pronto</span>
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={() => {
          cerradosEnMemoria.add(clave);
          try {
            localStorage.setItem(clave, '1');
          } catch {
            // Modo privado o almacenamiento bloqueado: queda cerrado hasta recargar.
          }
          window.dispatchEvent(new Event(EVENTO));
        }}
        aria-label="Cerrar recordatorio"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-tenue transition hover:bg-muted hover:text-tinta"
      >
        <X className="size-[18px]" />
      </button>
    </aside>
  );
}

const EVENTO = 'completa-negocio-cambio';
const cerradosEnMemoria = new Set<string>();

function suscribir(avisar: () => void) {
  window.addEventListener('storage', avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener('storage', avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

function leer(clave: string): boolean {
  try {
    return localStorage.getItem(clave) === '1' || cerradosEnMemoria.has(clave);
  } catch {
    return cerradosEnMemoria.has(clave);
  }
}
