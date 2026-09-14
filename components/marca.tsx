import { Check } from 'lucide-react';

import { NOMBRE_PRODUCTO } from '@/lib/marca';
import { cn } from '@/lib/utils';

/** Logo provisional: el chulo en el cuadro lima y el nombre al lado. */
export function Marca({ sobre = 'oscuro', className }: { sobre?: 'oscuro' | 'claro'; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-lima text-tinta">
        <Check className="size-5" strokeWidth={2.4} />
      </span>
      <span
        className={cn(
          'font-heading text-[19px] font-bold tracking-[-0.02em]',
          sobre === 'oscuro' ? 'text-papel' : 'text-tinta',
        )}
      >
        {NOMBRE_PRODUCTO}
      </span>
    </span>
  );
}
