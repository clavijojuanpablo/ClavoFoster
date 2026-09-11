-- Contabilidad y soporte
--
-- Libro de ingresos y egresos, suscripción del negocio con nosotros, bitácora
-- de mensajes, códigos OTP y reseñas. Ver docs/07-modelo-de-datos.md

-- ---------------------------------------------------------------------------
-- Contabilidad
-- ---------------------------------------------------------------------------

create table ledger_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  direction   ledger_direction not null,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (business_id, name, direction)
);

-- amount_cop SIEMPRE positivo; 'direction' dice si suma o resta. Guardar
-- egresos como negativos invita a errores de signo en cada suma.
create table ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  direction   ledger_direction not null,
  amount_cop  bigint not null check (amount_cop > 0),

  -- 'date' y no 'timestamptz': la contabilidad se lleva por día del negocio en
  -- su zona horaria, no por instante.
  occurred_on date not null,

  category_id    uuid references ledger_categories(id),
  payment_method payment_method not null default 'cash',
  description    text,

  appointment_id uuid references appointments(id),
  staff_id       uuid references staff(id),

  -- Corregir es sumar, no borrar: un asiento equivocado se anula con un
  -- contra-asiento que apunta al original.
  reverses_id uuid references ledger_entries(id),

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index ledger_entries_business_idx on ledger_entries (business_id, occurred_on);
create index ledger_entries_staff_idx    on ledger_entries (business_id, staff_id, occurred_on);

-- La protección contra ingresos duplicados. Marcar una cita como cumplida dos
-- veces —doble clic, reintento de red— no puede generar dos ingresos. Lo
-- impide la base, no el código.
create unique index ledger_entries_una_por_cita_idx
  on ledger_entries (appointment_id)
  where appointment_id is not null and reverses_id is null;

-- ---------------------------------------------------------------------------
-- Suscripción del negocio con nosotros
-- ---------------------------------------------------------------------------

create table subscriptions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  plan        text not null,
  status      business_status not null default 'trialing',
  provider     text,          -- mercadopago | wompi | manual
  provider_ref text,
  amount_cop     bigint not null check (amount_cop >= 0),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual')),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  grace_until        timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- Todo webhook se guarda CRUDO antes de procesarlo: si el procesamiento falla,
-- el evento no se perdió y se puede reprocesar.
--
-- unique (provider, event_id) es lo que los hace idempotentes. Las pasarelas
-- reenvían eventos cuando no reciben respuesta a tiempo; sin esto, un reenvío
-- podría cobrar o activar dos veces.
create table subscription_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  provider    text not null,
  event_id    text not null,
  event_type  text not null,
  payload     jsonb not null,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);

create index subscription_events_pendientes_idx
  on subscription_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Notificaciones y OTP
-- ---------------------------------------------------------------------------

-- unique (appointment_id, template) impide mandar el mismo recordatorio dos
-- veces. Recibir dos recordatorios de la misma cita es de las cosas que más
-- rápido hacen que un negocio apague la función.
create table notification_log (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references businesses(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete cascade,
  channel   text not null check (channel in ('whatsapp', 'email', 'sms')),
  template  text not null,
  recipient text not null,
  status    text not null default 'queued'
            check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  provider_ref text,
  cost_usd     numeric(10, 6),
  error        text,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, template)
);

create index notification_log_business_idx on notification_log (business_id, created_at desc);

-- code_hash, nunca el código en claro.
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  phone       text not null,
  code_hash   text not null,
  attempts    int not null default 0 check (attempts >= 0),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index otp_codes_phone_idx on otp_codes (phone, created_at desc);

-- ---------------------------------------------------------------------------
-- reviews — terreno preparado para el directorio
-- ---------------------------------------------------------------------------

-- Funciona desde el MVP aunque todavía no haya dónde mostrarlas públicamente.
-- El día que se encienda el directorio ya hay historia acumulada.
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  staff_id       uuid references staff(id),
  rating    int not null check (rating between 1 and 5),
  comment   text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index reviews_business_idx on reviews (business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table ledger_categories   enable row level security;
alter table ledger_entries      enable row level security;
alter table subscriptions       enable row level security;
alter table subscription_events enable row level security;
alter table notification_log    enable row level security;
alter table otp_codes           enable row level security;
alter table reviews             enable row level security;

-- Contabilidad y suscripción: SOLO el dueño. Un trabajador no ve cuánto
-- factura el negocio.
create policy "dueno_gestiona_categorias" on ledger_categories
  for all to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

create policy "dueno_gestiona_contabilidad" on ledger_entries
  for all to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

create policy "dueno_lee_suscripcion" on subscriptions
  for select to authenticated
  using (is_owner(business_id));

create policy "dueno_lee_notificaciones" on notification_log
  for select to authenticated
  using (is_owner(business_id));

-- Reseñas: el negocio ve las suyas; el público solo las marcadas públicas.
create policy "miembro_lee_resenas" on reviews
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "publico_lee_resenas_publicas" on reviews
  for select to anon, authenticated
  using (
    is_public
    and business_id in (
      select id from businesses where is_published and status = 'active'
    )
  );

create policy "dueno_gestiona_resenas" on reviews
  for update to authenticated
  using (is_owner(business_id)) with check (is_owner(business_id));

-- subscription_events y otp_codes quedan con RLS activa y SIN NINGUNA POLÍTICA.
-- Eso significa que ningún usuario, ni siquiera el dueño, puede leerlas: solo
-- el servidor con la llave secreta. Es intencional.
--
-- Los eventos de pasarela y los códigos de verificación no le sirven a nadie
-- desde el navegador, y exponerlos solo abre superficie de ataque.
