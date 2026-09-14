'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** Copia el link público del negocio. Confirma con "Copiado" dos segundos. */
export function CopiarLink({ url, className, etiqueta = 'Copiar link' }: { url: string; className?: string; etiqueta?: string }) {
  const [estado, setEstado] = useState<'listo' | 'copiado' | 'error'>('listo');

  useEffect(() => {
    if (estado === 'listo') return;
    const t = setTimeout(() => setEstado('listo'), 2000);
    return () => clearTimeout(t);
  }, [estado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setEstado('copiado');
    } catch {
      // Sin permiso de portapapeles (navegador viejo o iframe): se avisa en el
      // mismo botón en vez de fallar callado.
      setEstado('error');
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-lima px-3 text-[13px] font-semibold text-tinta transition hover:bg-lima/85',
        className,
      )}
      aria-live="polite"
    >
      {estado === 'copiado' ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : etiqueta}
    </button>
  );
}
