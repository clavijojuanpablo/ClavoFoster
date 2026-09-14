import { CalendarDays } from 'lucide-react';

import { CompletaTuNegocio } from '@/components/admin/completa-tu-negocio';
import { EstadoCita } from '@/components/admin/estado-cita';
import { Tarjeta } from '@/components/ui/tarjeta';
import { fechaLarga, hora, pesos } from '@/lib/formato';
import { saludo } from '@/lib/fechas';
import { NOMBRE_METODO } from '@/lib/panel/caja';
import { obtenerResumenDelDia, type CitaDelDia } from '@/lib/panel/resumen-del-dia';
import { requireNegocio } from '@/lib/tenant';

export const metadata = { title: 'Inicio' };

/**
 * Inicio del panel: cómo va el día.
 *
 * Lo que hace el dueño al abrir el celular en la mañana (flujo 4): ver las
 * citas de hoy, quién sigue y cuánto ha entrado. El calendario completo llega
 * con la tarea G1.
 */
export default async function PanelPage() {
  const contexto = await requireNegocio();
  const { negocio, rol } = contexto;
  const ahora = new Date();
  const resumen = await obtenerResumenDelDia(contexto, ahora);

  const tz = negocio.timezone;
  const activas = resumen.citas.filter((c) => c.estado !== 'cancelled');
  const cumplidas = activas.filter((c) => c.estado === 'completed').length;
  const siguiente = activas.find((c) => c.estado === 'confirmed' && new Date(c.fin) > ahora) ?? null;
  const esDueno = rol === 'owner';

  return (
    <main className="flex flex-col gap-5 px-4 pt-5 lg:px-8 lg:pt-7 lg:pb-8">
      <header className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-muted-foreground lg:hidden">{negocio.name}</span>
        <h1 className="text-[30px] leading-tight font-bold lg:text-[32px]">{saludo(tz, ahora)}</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{fechaLarga(tz, ahora)} · así va tu día</p>
      </header>

      {resumen.pasos && <CompletaTuNegocio businessId={negocio.id} pasos={resumen.pasos} />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-4">
        <Indicador titulo="Citas hoy" valor={String(activas.length)}>
          {cumplidas > 0 ? (
            <>
              <strong className="font-semibold text-tinta">{cumplidas}</strong> {cumplidas === 1 ? 'cumplida' : 'cumplidas'}
            </>
          ) : activas.length ? (
            'Ninguna cumplida aún'
          ) : (
            'Sin citas agendadas'
          )}
        </Indicador>

        {esDueno ? (
          <Indicador titulo="Ingresos de hoy" valor={resumen.caja ? pesos(resumen.caja.totalCop) : '—'}>
            {resumen.caja?.porMetodo.find((m) => m.metodo === 'cash') ? (
              <>
                <strong className="font-semibold text-tinta">
                  {pesos(resumen.caja.porMetodo.find((m) => m.metodo === 'cash')!.cop)}
                </strong>{' '}
                en efectivo
              </>
            ) : (
              'Al marcar citas como cumplidas'
            )}
          </Indicador>
        ) : (
          <Indicador titulo="Cumplidas" valor={String(cumplidas)}>
            de {activas.length} de hoy
          </Indicador>
        )}

        <Siguiente cita={siguiente} ahora={ahora} tz={tz} />
      </section>

      {/* minmax(0,1fr) y no solo 1fr: sin eso la columna crece hasta el ancho
          del texto más largo y la tarjeta se sale de la pantalla en celular. */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Tarjeta className="flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-xl font-bold">Citas de hoy</h2>
            <span className="text-[13px] text-muted-foreground">{activas.length} en total</span>
          </div>

          {resumen.citas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarDays className="size-6" strokeWidth={1.8} />
              </span>
              <p className="font-semibold">Hoy no hay citas</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Cuando tus clientes reserven desde tu link, van a aparecer acá.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-linea pb-2">
              {resumen.citas.map((cita) => (
                <FilaCita key={cita.id} cita={cita} tz={tz} mostrarTrabajador={esDueno} />
              ))}
            </ul>
          )}
        </Tarjeta>

        {esDueno && (
          <Tarjeta className="flex flex-col gap-4 self-start p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">Caja de hoy</h2>
              {resumen.caja && resumen.caja.totalCop > 0 && (
                <span className="text-[13px] text-muted-foreground">{resumen.caja.porMetodo.length} medios</span>
              )}
            </div>

            {!resumen.caja ? (
              <p className="text-sm text-destructive">No pudimos cargar la caja. Recarga la página en un momento.</p>
            ) : resumen.caja.totalCop === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no ha entrado plata hoy. Lo cobrado aparece acá, separado entre efectivo y digital.
              </p>
            ) : (
              <>
                <span className="font-heading text-[30px] leading-none font-bold tracking-[-0.02em]">
                  {pesos(resumen.caja.totalCop)}
                </span>
                <ul className="flex flex-col gap-3">
                  {resumen.caja.porMetodo.map((m) => (
                    <li key={m.metodo} className="flex flex-col gap-1.5">
                      <span className="flex justify-between text-sm">
                        {NOMBRE_METODO[m.metodo]}
                        <strong className="font-semibold">{pesos(m.cop)}</strong>
                      </span>
                      <span className="h-1.5 rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-tinta"
                          style={{ width: `${Math.max(3, (m.cop / resumen.caja!.totalCop) * 100)}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>
        )}
      </section>
    </main>
  );
}

function Indicador({ titulo, valor, children }: { titulo: string; valor: string; children: React.ReactNode }) {
  return (
    <Tarjeta className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5 lg:gap-2.5 lg:px-5 lg:py-[18px]">
      <span className="text-[13px] text-muted-foreground lg:text-sm">{titulo}</span>
      <span className="truncate font-heading text-[30px] leading-none font-bold tracking-[-0.02em] lg:text-[40px]">
        {valor}
      </span>
      <span className="truncate text-xs text-muted-foreground lg:text-[13px]">{children}</span>
    </Tarjeta>
  );
}

function Siguiente({ cita, ahora, tz }: { cita: CitaDelDia | null; ahora: Date; tz: string }) {
  if (!cita) {
    return (
      <Tarjeta tono="oscura" className="col-span-2 flex flex-col justify-center gap-1 p-5 lg:col-span-1">
        <span className="text-[13px] text-[#9da29a]">Siguiente cita</span>
        <span className="font-heading text-[22px] font-bold tracking-[-0.02em]">Nada pendiente por hoy</span>
      </Tarjeta>
    );
  }

  const minutos = Math.round((new Date(cita.inicio).getTime() - ahora.getTime()) / 60_000);
  const cuando = minutos <= 0 ? 'En curso' : minutos < 60 ? `Sigue en ${minutos} min` : `Sigue a las ${hora(tz, cita.inicio)}`;

  return (
    <Tarjeta tono="oscura" className="col-span-2 flex min-w-0 flex-col gap-3 p-5 lg:col-span-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-[#9da29a]">{cuando}</span>
        <EstadoCita estado={cita.estado} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-heading text-[22px] font-bold tracking-[-0.02em] lg:text-2xl">{cita.cliente}</span>
        <span className="truncate text-sm text-[#c9ccc5]">
          {cita.servicio} · {hora(tz, cita.inicio)}
          {cita.trabajador && ` · con ${cita.trabajador}`}
        </span>
      </div>
    </Tarjeta>
  );
}

function FilaCita({ cita, tz, mostrarTrabajador }: { cita: CitaDelDia; tz: string; mostrarTrabajador: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="w-[76px] shrink-0 text-[15px] font-semibold">{hora(tz, cita.inicio)}</span>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: cita.color }} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{cita.cliente}</span>
        <span className="truncate text-[13px] text-muted-foreground">
          {cita.servicio}
          {mostrarTrabajador && cita.trabajador && ` · ${cita.trabajador}`}
        </span>
      </span>
      {/* En celular casi todas dirían "Confirmada" y le quitan espacio al nombre:
          ahí solo se marca lo que se sale de lo normal. */}
      <EstadoCita estado={cita.estado} className={cita.estado === 'confirmed' ? 'hidden sm:inline-flex' : undefined} />
    </li>
  );
}
