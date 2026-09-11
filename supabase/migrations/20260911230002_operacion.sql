-- Operación
--
-- Servicios, horarios, clientes y citas: todo lo que necesita el motor de
-- agendamiento. Ver docs/06-motor-de-agendamiento.md y docs/07-modelo-de-datos.md

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

create table services (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  description text,
  duration_minutes int    not null check (duration_minutes between 5 and 600),
  price_cop        bigint not null check (price_cop >= 0),

  -- Tiempo de limpieza o preparación: se reserva, pero no se cobra ni se le
  -- muestra al cliente.
  buffer_before_minutes int not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes  int not null default 0 check (buffer_after_minutes  between 0 and 240),

  color         text,
  category      text,
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_business_idx on services (business_id) where is_active;

create trigger services_set_updated_at
  before update on services
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- staff_services — qué presta cada quién
-- ---------------------------------------------------------------------------

-- Los override cubren algo real: en una barbería el maestro cobra más y demora
-- distinto que el aprendiz. Sin esto, el negocio termina creando "Corte Andrés"
-- y "Corte Julián" como servicios separados.
create table staff_services (
  staff_id    uuid not null references staff(id)    on delete cascade,
  service_id  uuid not null references services(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  duration_override_minutes int    check (duration_override_minutes between 5 and 600),
  price_override_cop        bigint check (price_override_cop >= 0),
  primary key (staff_id, service_id)
);

create index staff_services_business_idx on staff_services (business_id);
create index staff_services_service_idx  on staff_services (service_id);

-- ---------------------------------------------------------------------------
-- working_hours — horario semanal
-- ---------------------------------------------------------------------------

-- 'time' SIN zona a propósito: "lunes de 9 a 13" es una hora local recurrente,
-- no un instante. La conversión a UTC ocurre al calcular la disponibilidad de
-- una fecha concreta, usando businesses.timezone.
--
-- El turno partido son DOS filas del mismo weekday. Es el caso normal en
-- peluquerías, no una excepción.
create table working_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),   -- 0 = domingo
  starts_at   time not null,
  ends_at     time not null,
  check (ends_at > starts_at)
);

create index working_hours_staff_idx on working_hours (staff_id, weekday);

-- ---------------------------------------------------------------------------
-- time_off — bloqueos y ausencias
-- ---------------------------------------------------------------------------

-- staff_id nulo cierra el local entero: festivos, inventario, la final de la Copa.
create table time_off (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id    uuid references staff(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index time_off_business_idx on time_off (business_id, starts_at);
create index time_off_staff_idx    on time_off (staff_id, starts_at);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

-- unique (business_id, phone) es la clave del flujo "solo el celular": el
-- teléfono identifica al cliente dentro de ESE negocio.
--
-- El teléfono se normaliza a E.164 (+573001234567) ANTES de guardar. Sin eso,
-- '3001234567' y '+57 300 123 4567' serían dos clientes distintos y el cliente
-- que vuelve no se reconocería.
--
-- Los clientes son de cada negocio, no globales. Ver docs/05.
create table customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  phone       text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  name        text not null,
  email       text,
  notes       text,
  no_show_count int not null default 0 check (no_show_count >= 0),
  is_blocked    boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone)
);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------

create table appointments (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id),
  staff_id    uuid not null references staff(id),
  service_id  uuid not null references services(id),

  start_at timestamptz not null,
  end_at   timestamptz not null,

  -- Copiados del servicio AL RESERVAR. No se leen de services nunca más.
  -- Si mañana sube el precio del corte, las citas de ayer no pueden cambiar de
  -- valor: la contabilidad quedaría corrupta. Regla 4 de CLAUDE.md
  price_cop             bigint not null check (price_cop >= 0),
  duration_minutes      int    not null check (duration_minutes > 0),
  buffer_before_minutes int    not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes  int    not null default 0 check (buffer_after_minutes  >= 0),

  status appointment_status not null default 'pending',
  source booking_source     not null default 'online',

  -- Token aleatorio para que el cliente gestione SU cita sin contraseña.
  -- Si fuera el id, cualquiera podría recorrer identificadores y cancelarle
  -- las citas a otros.
  manage_token text not null default encode(extensions.gen_random_bytes(24), 'hex'),

  -- Solo mientras está 'pending': es la retención del cupo.
  expires_at timestamptz,

  customer_note text,
  internal_note text,

  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer', 'business', 'system')),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_at > start_at),

  -- Rango realmente ocupado, incluyendo buffers. Lo mantiene un trigger.
  blocked_range tstzrange not null
);

-- El rango se calcula en la base y no en la aplicación: es lo que alimenta el
-- constraint de abajo, así que no puede depender de que quien inserta lo
-- calcule bien.
--
-- Va en un trigger y no en una columna generada porque la resta
-- 'timestamptz - interval' no es IMMUTABLE, y las columnas generadas lo exigen.
create or replace function set_appointment_blocked_range()
returns trigger
language plpgsql
as $$
begin
  new.blocked_range = tstzrange(
    new.start_at - make_interval(mins => new.buffer_before_minutes),
    new.end_at   + make_interval(mins => new.buffer_after_minutes),
    '[)'
  );
  return new;
end;
$$;

create trigger appointments_set_blocked_range
  before insert or update of start_at, end_at, buffer_before_minutes, buffer_after_minutes
  on appointments
  for each row execute function set_appointment_blocked_range();

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- LA garantía contra doble reserva. No la lógica de la aplicación: por muchas
-- peticiones simultáneas que lleguen, Postgres deja pasar una sola.
--
-- El WHERE importa: las citas canceladas y las que no asistieron NO bloquean
-- el cupo, que es justo lo que se quiere. 'pending' sí bloquea, y por eso la
-- retención de cupo no necesita ninguna tabla adicional.
alter table appointments add constraint appointments_sin_solapamiento
  exclude using gist (staff_id with =, blocked_range with &&)
  where (status in ('pending', 'confirmed'));

create index appointments_business_idx on appointments (business_id, start_at);
create index appointments_staff_idx    on appointments (staff_id, start_at);
create index appointments_customer_idx on appointments (customer_id, start_at desc);
create unique index appointments_manage_token_idx on appointments (manage_token);
create index appointments_expiran_idx on appointments (expires_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table services       enable row level security;
alter table staff_services enable row level security;
alter table working_hours  enable row level security;
alter table time_off       enable row level security;
alter table customers      enable row level security;
alter table appointments   enable row level security;

-- Público: solo el catálogo. Nada de horarios, clientes ni citas.
--
-- La disponibilidad NO se calcula leyendo estas tablas desde el navegador: se
-- resuelve en el servidor y devuelve únicamente horas libres, nunca datos de
-- quién tiene cita. Ver docs/13-contratos-de-api.md (getAvailability).
create policy "publico_lee_servicios_activos" on services
  for select to anon, authenticated
  using (
    is_active
    and business_id in (
      select id from businesses where is_published and status = 'active'
    )
  );

create policy "publico_lee_staff_services" on staff_services
  for select to anon, authenticated
  using (
    business_id in (
      select id from businesses where is_published and status = 'active'
    )
  );

-- Miembros: lectura de todo lo de su negocio.
create policy "miembro_lee_servicios" on services
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "miembro_lee_staff_services" on staff_services
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "miembro_lee_horarios" on working_hours
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "miembro_lee_bloqueos" on time_off
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "miembro_lee_clientes" on customers
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "miembro_lee_citas" on appointments
  for select to authenticated
  using (business_id in (select auth_business_ids()));

-- Escritura de configuración: solo el dueño.
create policy "dueno_gestiona_servicios" on services
  for all to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

create policy "dueno_gestiona_staff_services" on staff_services
  for all to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

create policy "dueno_gestiona_horarios" on working_hours
  for all to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

-- Los bloqueos, las citas y los clientes los maneja cualquier miembro: el
-- trabajador marca su almuerzo y marca sus citas como cumplidas.
create policy "miembro_gestiona_bloqueos" on time_off
  for all to authenticated
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy "miembro_gestiona_clientes" on customers
  for all to authenticated
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));

create policy "miembro_gestiona_citas" on appointments
  for all to authenticated
  using (business_id in (select auth_business_ids()))
  with check (business_id in (select auth_business_ids()));
