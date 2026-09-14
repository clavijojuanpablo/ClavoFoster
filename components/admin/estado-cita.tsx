import type { Enums } from '@/lib/types/database';
import { cn } from '@/lib/utils';

/** Todo estado lleva su palabra: el color solo nunca basta. */
const ESTADOS: Record<Enums<'appointment_status'>, { texto: string; clases: string }> = {
  pending: { texto: 'Apartada', clases: 'bg-estado-espera-fondo text-estado-espera' },
  confirmed: { texto: 'Confirmada', clases: 'bg-lima text-tinta' },
  completed: { texto: 'Cumplida', clases: 'bg-estado-neutro-fondo text-estado-neutro' },
  no_show: { texto: 'No llegó', clases: 'bg-estado-mal-fondo text-estado-mal' },
  cancelled: { texto: 'Cancelada', clases: 'border border-input bg-card text-muted-foreground line-through' },
};

export function EstadoCita({ estado, className }: { estado: Enums<'appointment_status'>; className?: string }) {
  const { texto, clases } = ESTADOS[estado];
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', clases, className)}>
      {texto}
    </span>
  );
}
