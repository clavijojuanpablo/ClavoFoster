import { iniciales } from '@/lib/formato';
import { urlDeFoto } from '@/lib/fotos';
import { cn } from '@/lib/utils';

/** Foto de la persona del equipo, o sus iniciales si no tiene. */
export function AvatarTrabajador({
  nombre,
  foto,
  className,
}: {
  nombre: string;
  /** Ruta dentro del bucket (ver lib/fotos.ts), o una URL ya armada para una vista previa. */
  foto: string | null;
  className?: string;
}) {
  if (foto) {
    const src = foto.startsWith('blob:') || foto.startsWith('http') ? foto : urlDeFoto(foto);
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ya reducida al subirla; ver lib/imagenes.ts
      <img src={src} alt="" className={cn('size-11 shrink-0 rounded-full object-cover', className)} />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-tinta',
        className,
      )}
    >
      {iniciales(nombre || '·')}
    </span>
  );
}
