import Link from 'next/link';

import { Marca } from '@/components/marca';
import { buttonVariants } from '@/components/ui/button';

/**
 * Portada mínima mientras no hay sitio comercial.
 * Solo lleva a entrar o a registrarse; la página de ventas se hace aparte.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-tinta px-5 py-6 text-papel sm:px-10">
      <Marca />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 py-16">
        <h1 className="font-heading text-[44px] leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-[72px]">
          Tu agenda se llena <span className="text-lima">sola</span>.
        </h1>
        <p className="max-w-xl text-lg text-[#c9ccc5]">
          Reservas en línea, agenda del equipo y caja del día para barberías, peluquerías y spas.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/registro" className={buttonVariants({ variant: 'acento', size: 'lg' })}>
            Registra tu negocio gratis
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'border-[#2f332f] bg-transparent text-papel hover:bg-tinta-suave' })}
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
