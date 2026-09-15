import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { FormularioHorario } from '@/components/admin/formulario-horario';
import { obtenerEquipo } from '@/lib/panel/equipo';
import { requireDueno } from '@/lib/tenant';
import { HORARIO_SUGERIDO } from '@/lib/validation/horario';

export const metadata = { title: 'Horario' };

/**
 * Horario semanal de una persona del equipo (D3).
 *
 * En hora local del negocio: "lunes de 9 a 13" es una hora de reloj que se
 * repite, no un instante. La conversión a UTC la hace el motor de cupos al
 * calcular una fecha concreta (docs/06-motor-de-agendamiento.md).
 */
export default async function HorarioPage({ params }: PageProps<'/panel/equipo/[id]/horario'>) {
  const { negocio } = await requireDueno();
  const { id } = await params;

  if (!z.uuid().safeParse(id).success) notFound();

  const equipo = await obtenerEquipo(negocio.id);
  const trabajador = equipo.find((t) => t.id === id);
  if (!trabajador) notFound();

  const sinHorario = trabajador.turnos.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-5 lg:px-8 lg:pt-7">
      <Link
        href={`/panel/equipo/${trabajador.id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-tinta"
      >
        <ArrowLeft className="size-4" />
        {trabajador.nombre}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-[26px] leading-tight font-bold lg:text-[32px]">Horario de {trabajador.nombre.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">
          Los días y horas en que atiende. Si almuerza, divide el día en dos turnos.
        </p>
      </header>

      <FormularioHorario
        staffId={trabajador.id}
        timezone={negocio.timezone}
        inicial={sinHorario ? HORARIO_SUGERIDO : trabajador.turnos}
        sugerido={sinHorario}
      />
    </main>
  );
}
