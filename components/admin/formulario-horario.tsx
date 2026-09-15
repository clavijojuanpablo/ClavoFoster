'use client';

import { Copy, Plus, X } from 'lucide-react';
import { useActionState, useState } from 'react';

import { guardarHorario, type EstadoHorario } from '@/app/(admin)/panel/equipo/actions';
import { AvisoError, CLASES_CONTROL } from '@/components/admin/campo';
import { Button } from '@/components/ui/button';
import { Tarjeta } from '@/components/ui/tarjeta';
import { fechaLarga, hora } from '@/lib/formato';
import { enviarSinReiniciar } from '@/lib/formularios';
import type { TurnoSemanal } from '@/lib/scheduling/types';
import { cn } from '@/lib/utils';
import { DIAS_SEMANA, MAX_TURNOS_POR_DIA, minutos } from '@/lib/validation/horario';

const INICIAL: EstadoHorario = { error: null, campos: {}, guardadoEn: null, citasFuera: [] };

type Turno = { desde: string; hasta: string };
type Semana = Record<number, Turno[]>;

function agrupar(turnos: TurnoSemanal[]): Semana {
  const semana: Semana = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const t of turnos) semana[t.weekday].push({ desde: t.desde, hasta: t.hasta });
  for (const dia of Object.values(semana)) dia.sort((a, b) => minutos(a.desde) - minutos(b.desde));
  return semana;
}

function aplanar(semana: Semana): TurnoSemanal[] {
  return Object.entries(semana).flatMap(([weekday, turnos]) =>
    turnos.map((t) => ({ weekday: Number(weekday), ...t })),
  );
}

/** Un turno nuevo arranca donde terminó el anterior, para no escribirlo de cero. */
function turnoSiguiente(turnos: Turno[]): Turno {
  const ultimo = turnos.at(-1);
  if (!ultimo) return { desde: '09:00', hasta: '19:00' };
  const desde = Math.min(minutos(ultimo.hasta) + 60, 22 * 60);
  const hasta = Math.min(desde + 4 * 60, 23 * 60 + 59);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { desde: hhmm(desde), hasta: hhmm(hasta) };
}

/** Horario semanal de una persona (D3): varios turnos por día, turno partido incluido. */
export function FormularioHorario({
  staffId,
  timezone,
  inicial,
  sugerido,
}: {
  staffId: string;
  timezone: string;
  inicial: TurnoSemanal[];
  /** true si la persona no tenía horario y `inicial` es la sugerencia. */
  sugerido: boolean;
}) {
  const [estado, guardar, guardando] = useActionState(guardarHorario, INICIAL);
  const [semana, setSemana] = useState(() => agrupar(inicial));
  const [cambiado, setCambiado] = useState(false);

  function cambiar(actualizar: (s: Semana) => Semana) {
    setSemana((s) => actualizar(structuredClone(s)));
    setCambiado(true);
  }

  const guardadoReciente = estado.guardadoEn !== null && !guardando && !cambiado;
  const turnos = aplanar(semana);

  return (
    <form
      onSubmit={(e) => {
        setCambiado(false);
        enviarSinReiniciar(guardar)(e);
      }}
      noValidate
      className="flex flex-col gap-3.5"
    >
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="turnos" value={JSON.stringify(turnos)} />

      {sugerido && !estado.guardadoEn && (
        <p className="rounded-2xl bg-lima/30 px-4 py-3 text-sm">
          Todavía no tiene horario. Te sugerimos lunes a sábado de 9:00 a 19:00: ajústalo y guarda.
        </p>
      )}

      <Tarjeta as="div" className="divide-y divide-linea">
        {DIAS_SEMANA.map((dia) => {
          const delDia = semana[dia.weekday];
          const atiende = delDia.length > 0;
          const error = estado.campos[`dia${dia.weekday}`];

          return (
            <fieldset key={dia.weekday} className="flex flex-col gap-3 px-[18px] py-4 sm:flex-row sm:items-start sm:gap-4 lg:px-6">
              <legend className="sr-only">{dia.nombre}</legend>

              <label className="flex w-36 shrink-0 cursor-pointer items-center gap-3 sm:h-12">
                <input
                  type="checkbox"
                  checked={atiende}
                  onChange={(e) =>
                    cambiar((s) => {
                      s[dia.weekday] = e.target.checked ? [turnoSiguiente([])] : [];
                      return s;
                    })
                  }
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-7 w-[46px] shrink-0 rounded-full bg-input p-[3px] transition peer-checked:justify-end peer-checked:bg-tinta peer-focus-visible:ring-4 peer-focus-visible:ring-lima/40"
                >
                  <span className="size-[22px] rounded-full bg-card" />
                </span>
                <span className={cn('text-[15px] font-semibold', !atiende && 'text-muted-foreground')}>{dia.nombre}</span>
              </label>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {!atiende && <span className="text-sm text-muted-foreground sm:leading-[48px]">No atiende</span>}

                {delDia.map((turno, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      step={300}
                      aria-label={`${dia.nombre}, turno ${i + 1}, desde`}
                      value={turno.desde}
                      onChange={(e) =>
                        cambiar((s) => {
                          s[dia.weekday][i].desde = e.target.value;
                          return s;
                        })
                      }
                      aria-invalid={error ? true : undefined}
                      className={cn(CLASES_CONTROL, 'w-full min-w-0 px-3 sm:w-32')}
                    />
                    <span className="text-muted-foreground">a</span>
                    <input
                      type="time"
                      step={300}
                      aria-label={`${dia.nombre}, turno ${i + 1}, hasta`}
                      value={turno.hasta}
                      onChange={(e) =>
                        cambiar((s) => {
                          s[dia.weekday][i].hasta = e.target.value;
                          return s;
                        })
                      }
                      aria-invalid={error ? true : undefined}
                      className={cn(CLASES_CONTROL, 'w-full min-w-0 px-3 sm:w-32')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar turno ${i + 1} del ${dia.nombre.toLowerCase()}`}
                      onClick={() =>
                        cambiar((s) => {
                          s[dia.weekday].splice(i, 1);
                          return s;
                        })
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}

                {error && <p className="text-[13px] text-destructive">{error}</p>}

                {atiende && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {delDia.length < MAX_TURNOS_POR_DIA && (
                      <button
                        type="button"
                        onClick={() =>
                          cambiar((s) => {
                            s[dia.weekday].push(turnoSiguiente(s[dia.weekday]));
                            return s;
                          })
                        }
                        className="flex h-9 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-tinta"
                      >
                        <Plus className="size-4" />
                        Agregar turno
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        cambiar((s) => {
                          for (const otro of DIAS_SEMANA) {
                            if (otro.weekday !== dia.weekday && s[otro.weekday].length > 0) {
                              s[otro.weekday] = structuredClone(s[dia.weekday]);
                            }
                          }
                          return s;
                        })
                      }
                      className="flex h-9 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-tinta"
                    >
                      <Copy className="size-4" />
                      Copiar a los otros días que atiende
                    </button>
                  </div>
                )}
              </div>
            </fieldset>
          );
        })}
      </Tarjeta>

      {estado.error && <AvisoError>{estado.error}</AvisoError>}

      {guardadoReciente && estado.citasFuera.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-[20px] bg-estado-espera-fondo p-[18px]">
          <p className="text-[15px] font-semibold">
            {estado.citasFuera.length === 1
              ? 'Una cita agendada quedó por fuera del horario nuevo'
              : `${estado.citasFuera.length} citas agendadas quedaron por fuera del horario nuevo`}
          </p>
          <p className="text-[13px] text-muted-foreground">
            No se movieron ni se cancelaron. Revísalas con cada cliente.
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {estado.citasFuera.slice(0, 10).map((c) => (
              <li key={c.id}>
                <span className="first-letter:uppercase">{fechaLarga(timezone, new Date(c.inicio))}</span>,{' '}
                {hora(timezone, c.inicio)} · {c.cliente} · {c.servicio}
              </li>
            ))}
            {estado.citasFuera.length > 10 && <li className="text-muted-foreground">y {estado.citasFuera.length - 10} más</li>}
          </ul>
        </div>
      )}

      <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] -mx-4 mt-1 flex flex-col items-center gap-1.5 bg-gradient-to-t from-papel from-70% to-transparent px-4 pt-4 pb-1 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-4">
        <Button type="submit" size="lg" disabled={guardando} className="w-full">
          {guardando ? 'Guardando…' : 'Guardar horario'}
        </Button>
        {guardadoReciente && estado.citasFuera.length === 0 && !estado.error && (
          <p role="status" className="text-[13px] font-semibold text-estado-neutro">
            Horario guardado.
          </p>
        )}
      </div>
    </form>
  );
}
