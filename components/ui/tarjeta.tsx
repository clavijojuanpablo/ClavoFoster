import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Props = HTMLAttributes<HTMLElement> & {
  /** `oscura` para lo que pide atención ahora: la siguiente cita, la página pública. */
  tono?: 'clara' | 'oscura' | 'lima';
  as?: 'section' | 'div' | 'article';
};

const TONOS = {
  clara: 'border border-border bg-card text-card-foreground',
  oscura: 'bg-tinta text-papel',
  lima: 'bg-lima text-tinta',
} as const;

/** Superficie base del panel: radio 20 px, sin sombra. */
export function Tarjeta({ tono = 'clara', as: Etiqueta = 'section', className, ...props }: Props) {
  return <Etiqueta className={cn('rounded-[20px]', TONOS[tono], className)} {...props} />;
}
