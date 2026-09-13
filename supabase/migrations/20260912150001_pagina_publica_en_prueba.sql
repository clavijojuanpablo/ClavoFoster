-- Página pública durante la prueba y la gracia
--
-- Las políticas públicas exigían status = 'active'. Pero un negocio nace en
-- 'trialing': durante sus 14 días de prueba su link daba 404, que es justo el
-- momento en que tiene que ver que el producto le trae reservas.
--
-- docs/08-pagos-y-suscripciones.md ya lo define así: la página pública se apaga
-- al SUSPENDER, no antes. Durante 'past_due' (los 7 días de gracia tras un
-- cobro fallido) sigue encendida.
--
-- Además la regla estaba copiada en cinco políticas. Ahora vive en una función,
-- para que el día que cambie se cambie en un solo sitio.

create or replace function estado_tiene_pagina_publica(p_status business_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('trialing', 'active', 'past_due');
$$;

-- businesses ----------------------------------------------------------------

drop policy "publico_lee_negocio_activo" on businesses;

create policy "publico_lee_negocio_activo" on businesses
  for select to anon, authenticated
  using (is_published and estado_tiene_pagina_publica(status));

-- staff ---------------------------------------------------------------------

drop policy "publico_lee_trabajadores_activos" on staff;

create policy "publico_lee_trabajadores_activos" on staff
  for select to anon, authenticated
  using (
    is_active
    and business_id in (
      select id from businesses where is_published and estado_tiene_pagina_publica(status)
    )
  );

-- services ------------------------------------------------------------------

drop policy "publico_lee_servicios_activos" on services;

create policy "publico_lee_servicios_activos" on services
  for select to anon, authenticated
  using (
    is_active
    and business_id in (
      select id from businesses where is_published and estado_tiene_pagina_publica(status)
    )
  );

-- staff_services ------------------------------------------------------------

drop policy "publico_lee_staff_services" on staff_services;

create policy "publico_lee_staff_services" on staff_services
  for select to anon, authenticated
  using (
    business_id in (
      select id from businesses where is_published and estado_tiene_pagina_publica(status)
    )
  );

-- reviews -------------------------------------------------------------------

drop policy "publico_lee_resenas_publicas" on reviews;

create policy "publico_lee_resenas_publicas" on reviews
  for select to anon, authenticated
  using (
    is_public
    and business_id in (
      select id from businesses where is_published and estado_tiene_pagina_publica(status)
    )
  );

-- El índice parcial de la migración 1 filtra solo por is_published; sigue
-- sirviendo tal cual.
