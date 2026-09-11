-- Cimientos e identidad
--
-- Extensiones, tipos, y las tres tablas que definen quién es quién:
-- businesses (el negocio = el tenant), staff (los trabajadores) y
-- memberships (qué usuario entra a qué negocio y con qué rol).
--
-- Ver docs/05-arquitectura-multitenant.md y docs/07-modelo-de-datos.md

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------

-- Necesaria para el constraint anti-solapamiento de citas (migración 2):
-- permite combinar '=' sobre uuid con '&&' sobre rangos en un mismo EXCLUDE.
create extension if not exists btree_gist with schema extensions;

-- gen_random_bytes(), para los tokens de gestión de cita.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type app_role           as enum ('owner', 'staff');
create type business_status    as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
create type appointment_status as enum ('pending', 'confirmed', 'completed', 'no_show', 'cancelled');
create type booking_source     as enum ('online', 'manual', 'walk_in');
create type ledger_direction   as enum ('income', 'expense');
create type payment_method     as enum ('cash', 'transfer', 'nequi', 'card', 'other');

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- businesses — el tenant
-- ---------------------------------------------------------------------------

create table businesses (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null,
  timezone    text not null default 'America/Bogota',
  phone       text,
  email       text,

  -- Marca
  logo_url    text,
  cover_url   text,
  brand_color text,

  -- Datos del directorio. Todavía sin usar en el MVP: se recogen desde ya para
  -- no tener que perseguir a 200 negocios el día que se encienda.
  -- Ver docs/adr/0004-white-label-antes-que-marketplace.md
  address     text,
  city        text,
  latitude    numeric(10, 7),
  longitude   numeric(10, 7),
  photos      jsonb not null default '[]',

  -- Reglas de reserva, configurables por negocio.
  -- Ver docs/06-motor-de-agendamiento.md
  slot_granularity_minutes int not null default 15 check (slot_granularity_minutes between 5 and 60),
  min_notice_minutes       int not null default 120 check (min_notice_minutes >= 0),
  max_advance_days         int not null default 60  check (max_advance_days between 1 and 365),
  cancel_notice_minutes    int not null default 240 check (cancel_notice_minutes >= 0),
  align_to_clock           boolean not null default false,
  allow_staff_choice       boolean not null default true,

  status       business_status not null default 'trialing',
  is_published boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- El slug se guarda siempre en minúsculas y la aplicación normaliza antes de
  -- buscar. Es más simple y predecible que usar citext.
  constraint slug_formato check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$'),

  -- Palabras que chocarían con rutas de la aplicación.
  constraint slug_no_reservado check (
    slug not in ('api', 'admin', 'app', 'login', 'signup', 'panel', 'cuenta',
                 'dashboard', 'static', 'assets', 'public', 'soporte', 'ayuda')
  )
);

create index businesses_publicos_idx on businesses (status) where is_published;

create trigger businesses_set_updated_at
  before update on businesses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- staff — los trabajadores
-- ---------------------------------------------------------------------------

-- Un trabajador NO necesita usuario para existir: el dueño puede cargar a sus
-- cuatro barberos y agendarlos sin que ninguno tenga cuenta. La invitación
-- (tarea D5) crea después la membresía y la enlaza.
create table staff (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  photo_url   text,
  phone       text,
  bio         text,
  can_block_own_schedule boolean not null default true,
  commission_pct numeric(5, 2) check (commission_pct between 0 and 100),
  display_order  int not null default 0,
  is_active      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_business_idx on staff (business_id) where is_active;

create trigger staff_set_updated_at
  before update on staff
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- memberships — quién entra a qué negocio
-- ---------------------------------------------------------------------------

-- Un usuario no "pertenece" a un negocio: tiene una membresía con un rol. Así
-- la misma persona puede ser dueña de un local y trabajadora en otro.
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role        app_role not null,
  staff_id    uuid references staff(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (user_id, business_id)
);

create index memberships_user_idx     on memberships (user_id);
create index memberships_business_idx on memberships (business_id);

-- ---------------------------------------------------------------------------
-- Funciones de autorización
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER a propósito: leen memberships saltándose RLS. Sin eso, las
-- políticas de memberships se llamarían a sí mismas y Postgres entraría en
-- recursión infinita.
create or replace function auth_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from memberships where user_id = auth.uid();
$$;

create or replace function is_owner(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and business_id = b_id
      and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table businesses  enable row level security;
alter table staff       enable row level security;
alter table memberships enable row level security;

-- businesses ----------------------------------------------------------------

-- Lo que ve cualquiera sin sesión: solo negocios publicados y al día.
-- Si la suscripción se suspende, status deja de ser 'active' y la página
-- pública se apaga sola. Ver docs/08-pagos-y-suscripciones.md
create policy "publico_lee_negocio_activo" on businesses
  for select to anon, authenticated
  using (is_published and status = 'active');

-- Un miembro ve su negocio SIEMPRE, aunque esté suspendido. Quitarle a un
-- dueño el acceso a sus propios datos por mora es la forma más rápida de que
-- hable mal de nosotros.
create policy "miembro_lee_su_negocio" on businesses
  for select to authenticated
  using (id in (select auth_business_ids()));

create policy "dueno_actualiza_su_negocio" on businesses
  for update to authenticated
  using (is_owner(id))
  with check (is_owner(id));

-- staff ---------------------------------------------------------------------

create policy "publico_lee_trabajadores_activos" on staff
  for select to anon, authenticated
  using (
    is_active
    and business_id in (
      select id from businesses where is_published and status = 'active'
    )
  );

create policy "miembro_lee_trabajadores" on staff
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "dueno_gestiona_trabajadores" on staff
  for all to authenticated
  using (is_owner(business_id))
  with check (is_owner(business_id));

-- memberships ---------------------------------------------------------------

-- Cada quien ve sus propias membresías.
create policy "usuario_lee_sus_membresias" on memberships
  for select to authenticated
  using (user_id = auth.uid());

-- El dueño ve y gestiona el equipo de su negocio.
create policy "dueno_lee_membresias_del_negocio" on memberships
  for select to authenticated
  using (is_owner(business_id));

create policy "dueno_gestiona_membresias" on memberships
  for all to authenticated
  using (is_owner(business_id))
  with check (is_owner(business_id));

-- ---------------------------------------------------------------------------
-- NOTA PARA LA TAREA B1 (registro de negocio)
-- ---------------------------------------------------------------------------
--
-- Hay un huevo-y-gallina deliberado: para crear la PRIMERA membresía de un
-- negocio, is_owner() todavía devuelve false porque esa membresía no existe.
-- Ningún usuario puede, por sí solo, declararse dueño de un negocio nuevo.
--
-- Eso es correcto y es lo que impide que alguien se agregue como dueño de un
-- negocio ajeno. El alta se resuelve en B1 con una función SECURITY DEFINER
-- (create_business) que hace negocio + membresía + servicios de plantilla en
-- una sola transacción controlada.
--
-- Se prefiere esa función sobre usar el cliente privilegiado en el registro:
-- es un único punto de entrada auditable, en vez de repartir la llave maestra
-- por el flujo de onboarding.
