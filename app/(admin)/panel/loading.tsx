/**
 * Lo que se ve apenas se toca una sección del menú, mientras el servidor trae
 * los datos.
 *
 * Sin esto, la pantalla se quedaba quieta hasta que llegaba todo y el panel se
 * sentía lento aunque tardara menos de un segundo. El menú no se toca: vive en
 * el layout, que ya está en pantalla.
 *
 * Genérico a propósito (título y tres bloques): calza con todas las secciones
 * y no hay que mantener un esqueleto por pantalla.
 */
export default function CargandoPanel() {
  return (
    <main aria-busy="true" className="flex flex-col gap-5 px-4 pt-5 lg:px-8 lg:pt-7">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted lg:h-9" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4" aria-hidden="true">
        <div className="h-28 animate-pulse rounded-[20px] bg-muted" />
        <div className="hidden h-28 animate-pulse rounded-[20px] bg-muted lg:block" />
        <div className="hidden h-28 animate-pulse rounded-[20px] bg-muted lg:block" />
      </div>
      <div className="h-72 animate-pulse rounded-[20px] bg-muted" aria-hidden="true" />
    </main>
  );
}
