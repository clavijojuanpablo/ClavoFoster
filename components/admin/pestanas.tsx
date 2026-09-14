import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Pestañas en píldora que navegan por URL (Activos · Desactivados). */
export function Pestanas({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <nav aria-label={etiqueta} className="flex w-fit gap-1 rounded-full bg-muted p-1">
      {children}
    </nav>
  );
}

export function Pestana({ href, activa, children }: { href: string; activa: boolean; children: ReactNode }) {
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
