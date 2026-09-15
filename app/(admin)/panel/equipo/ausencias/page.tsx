import { ArrowLeft, CalendarOff, Clock, Store } from 'lucide-react';
import Link from 'next/link';

import { quitarBloqueo } from '@/app/(admin)/panel/equipo/ausencias/actions';
import { FormularioBloqueo } from '@/components/admin/formulario-bloqueo';
import { Button } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import { fechaLocal } from '@/lib/fechas';
import { cuandoEsElBloqueo } from '@/lib/formato';
import { obtenerBloqueosProximos } from '@/lib/panel/bloqueos';
import { obtenerEquipo } from '@/lib/panel/equipo';
import { requireDueno } from '@/lib/tenant';

export const metadata = { title: 'Ausencias y cierres' };

/**
 * Bloqueos y ausencias (D4): cuándo alguien no atiende, o el local está
 * cerrado. Lo que se bloquea acá deja de ofrecerse como cupo al reservar.
 */
export default async function AusenciasPage() {
  const { negocio } = await requireDueno();
  const ahora = new Date();
  const [bloqueos, equipo] = await Promise.all([obtenerBloqueosProximos(negocio.id, ahora), obtenerEquipo(negocio.id)]);
  const personas = equipo.filter((t) => t.activo).map((t) => ({ id: t.id, nombre: t.nombre }));
  const tz = negocio.timezone;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 lg:px-8 lg:pt-7 lg:pb-8">
      <Link
        href="/panel/equipo"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-tinta"
      >
        <ArrowLeft className="size-4" />
        Equipo
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold lg:text-[32px]">Ausencias y cierres</h1>
        <p className="text-sm text-muted-foreground">
          Vacaciones, una cita médica o un festivo. En esos ratos no se ofrecen cupos.
        </p>
      </header>

      {/* Lo que se repite cada semana no es una ausencia: vive en el horario. */}
      <p className="flex items-start gap-3 rounded-2xl border border-dashed border-input px-4 py-3.5 text-sm text-muted-foreground">
        <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          ¿Almuerzo o descanso de todos los días? No lo bloquees aquí: en{' '}
          <Link href="/panel/equipo" className="font-semibold text-tinta underline underline-offset-4">
            Equipo
          </Link>
          , abre a la persona y en su Horario divide el día en dos turnos (por ejemplo, 9:00 a 13:00 y 14:00 a 19:00).
        </span>
      </p>

      <FormularioBloqueo personas={personas} timezone={tz} hoy={fechaLocal(tz, ahora)} />

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-bold">Próximos</h2>
        {bloqueos.length === 0 ? (
          <p className="rounded-[20px] border border-border bg-card p-5 text-sm text-muted-foreground">
            No hay ausencias ni cierres programados.
          </p>
        ) : (
          <Tarjeta as="div" className="divide-y divide-linea">
            {bloqueos.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {b.staffId ? <CalendarOff className="size-[18px]" /> : <Store className="size-[18px]" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{b.quien}</span>
                  <span className="text-[13px] text-muted-foreground first-letter:uppercase">
                    {cuandoEsElBloqueo(tz, b.inicio, b.fin)}
                    {b.motivo && ` · ${b.motivo}`}
                  </span>
                </span>
                <form action={quitarBloqueo}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Quitar
                  </Button>
                </form>
              </div>
            ))}
          </Tarjeta>
        )}
      </section>
    </main>
  );
}
