-- Alta de negocio
--
-- Resuelve el huevo-y-gallina anotado en la migración 1: para crear la primera
-- membresía de un negocio, is_owner() todavía es false. Este es el único punto
-- de entrada por donde nace un negocio.
--
-- Ver docs/02-usuarios-y-flujos.md (flujo 6) y docs/03-backlog.md (tarea B1)

-- ---------------------------------------------------------------------------
-- service_templates — servicios sugeridos por tipo de negocio
-- ---------------------------------------------------------------------------

-- Datos de referencia GLOBALES, no de un negocio: es la única tabla sin
-- business_id, y por eso no lleva política por tenant sino lectura para todos.
--
-- Existe para que el onboarding no arranque con una pantalla en blanco que
-- diga "cree su primer servicio", que es exactamente donde la gente abandona.
create table service_templates (
  id       uuid primary key default gen_random_uuid(),
  category text not null,
  name     text not null,
  duration_minutes int    not null check (duration_minutes between 5 and 600),
  price_cop        bigint not null check (price_cop >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  display_order int not null default 0,
  unique (category, name)
);

create index service_templates_category_idx on service_templates (category);

insert into service_templates (category, name, duration_minutes, price_cop, buffer_after_minutes, display_order) values
  -- Barbería
  ('barbershop', 'Corte de cabello',        45,  30000,  0, 1),
  ('barbershop', 'Barba',                   30,  20000,  0, 2),
  ('barbershop', 'Corte + barba',           60,  45000,  0, 3),
  ('barbershop', 'Corte niño',              30,  25000,  0, 4),
  ('barbershop', 'Cejas',                   15,  10000,  0, 5),

  -- Peluquería
  ('salon', 'Corte dama',                   60,  45000,  0, 1),
  ('salon', 'Peinado',                      45,  40000,  0, 2),
  ('salon', 'Tinte',                       120, 120000, 15, 3),
  ('salon', 'Keratina',                    180, 250000, 15, 4),
  ('salon', 'Manicure',                     45,  30000,  0, 5),
  ('salon', 'Pedicure',                     60,  40000,  0, 6),

  -- Spa
  ('spa', 'Masaje relajante',               60, 120000, 15, 1),
  ('spa', 'Masaje descontracturante',       90, 160000, 15, 2),
  ('spa', 'Limpieza facial',                60,  90000, 10, 3),
  ('spa', 'Exfoliación corporal',           60, 100000, 15, 4),

  -- Tatuajes
  ('tattoo', 'Asesoría y diseño',           30,      0,  0, 1),
  ('tattoo', 'Sesión pequeña',             120, 250000, 30, 2),
  ('tattoo', 'Sesión mediana',             240, 500000, 30, 3),
  ('tattoo', 'Retoque',                     60,  80000, 30, 4),

  -- Cosmetología
  ('aesthetics', 'Limpieza facial profunda', 75, 110000, 10, 1),
  ('aesthetics', 'Peeling químico',          45, 150000, 10, 2),
  ('aesthetics', 'Depilación láser (zona pequeña)', 30, 80000, 10, 3),
  ('aesthetics', 'Microblading',            120, 350000, 15, 4);

alter table service_templates enable row level security;

create policy "todos_leen_plantillas" on service_templates
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- create_business
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER: crea la primera membresía, que ninguna política permitiría.
-- Se prefiere esto sobre usar la llave secreta en el registro, porque es un
-- único punto de entrada auditable en vez de repartir la llave maestra por el
-- flujo de onboarding.
--
-- El dueño es SIEMPRE auth.uid(): no se recibe por parámetro. Si se recibiera,
-- cualquiera podría crear un negocio a nombre de otro.
create or replace function create_business(
  p_name     text,
  p_slug     text,
  p_category text,
  p_phone    text default null,
  p_timezone text default 'America/Bogota'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_business_id uuid;
  v_slug        text := lower(trim(p_slug));
begin
  if v_user_id is null then
    raise exception 'Hay que iniciar sesión para crear un negocio'
      using errcode = '42501';
  end if;

  -- Un usuario, un negocio propio. Evita que una cuenta cree negocios en masa.
  -- Si algún día un cliente maneja varios locales, se resuelve con multi-sede
  -- (v2), no creando negocios sueltos.
  if exists (
    select 1 from memberships
    where user_id = v_user_id and role = 'owner'
  ) then
    raise exception 'Esta cuenta ya tiene un negocio'
      using errcode = '23505';
  end if;

  insert into businesses (name, slug, category, phone, timezone)
  values (p_name, v_slug, p_category, p_phone, p_timezone)
  returning id into v_business_id;

  insert into memberships (user_id, business_id, role)
  values (v_user_id, v_business_id, 'owner');

  -- Prueba de 14 días, sin tarjeta. Ver docs/08-pagos-y-suscripciones.md
  insert into subscriptions (business_id, plan, status, amount_cop, trial_ends_at)
  values (v_business_id, 'trial', 'trialing', 0, now() + interval '14 days');

  -- Servicios sugeridos según el tipo de negocio. El dueño los ajusta o los
  -- borra, pero no arranca con la pantalla vacía.
  insert into services (business_id, name, duration_minutes, price_cop, buffer_after_minutes, display_order)
  select v_business_id, t.name, t.duration_minutes, t.price_cop, t.buffer_after_minutes, t.display_order
  from service_templates t
  where t.category = p_category;

  -- Categorías contables base. is_system = true: el dueño no las borra porque
  -- 'Servicios' es donde caen los ingresos automáticos de las citas cumplidas.
  insert into ledger_categories (business_id, name, direction, is_system) values
    (v_business_id, 'Servicios',        'income',  true),
    (v_business_id, 'Venta de productos','income', false),
    (v_business_id, 'Otros ingresos',   'income',  false),
    (v_business_id, 'Arriendo',         'expense', false),
    (v_business_id, 'Servicios públicos','expense',false),
    (v_business_id, 'Insumos',          'expense', false),
    (v_business_id, 'Nómina',           'expense', false),
    (v_business_id, 'Otros egresos',    'expense', false);

  return v_business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- slug_disponible
-- ---------------------------------------------------------------------------

-- Para validar el slug en vivo durante el onboarding (tarea B3) sin exponer
-- la tabla businesses a consultas del navegador.
create or replace function slug_disponible(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from businesses where slug = lower(trim(p_slug))
  );
$$;
