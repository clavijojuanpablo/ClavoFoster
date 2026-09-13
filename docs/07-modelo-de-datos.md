# 07 — Modelo de datos

Postgres sobre Supabase. Todo en `snake_case` y en inglés.

## Reglas transversales

1. **`business_id` en toda tabla de negocio**, indexado, y en primer lugar de los
   índices compuestos.
2. **RLS activa en toda tabla.** Ver `05-arquitectura-multitenant.md`.
3. **Dinero en `bigint`, en pesos colombianos enteros.** Sufijo `_cop` en el
   nombre. Nunca `float`, nunca `numeric` con decimales: el peso no usa centavos
   en la práctica y los flotantes acumulan error en la contabilidad.
4. **Tiempo en `timestamptz`**, siempre UTC.
5. **Nada con historia se borra.** `is_active`, `archived_at` o un estado.
6. **Toda tabla lleva `created_at` y `updated_at`**, con disparador para el
   segundo.

## Diagrama

```
businesses ──┬── memberships ──── auth.users
             ├── staff ──┬── working_hours
             │           ├── time_off
             │           └── staff_services ── services
             ├── services
             ├── customers ──── appointments ──── ledger_entries
             ├── appointments ──┘
             ├── ledger_categories
             ├── subscriptions ──── subscription_events
             ├── notification_log
             └── reviews
```

## Tipos

```sql
create type app_role          as enum ('owner', 'staff');
create type business_status   as enum ('trialing','active','past_due','suspended','cancelled');
create type appointment_status as enum ('pending','confirmed','completed','no_show','cancelled');
create type booking_source    as enum ('online','manual','walk_in');
create type ledger_direction  as enum ('income','expense');
create type payment_method    as enum ('cash','transfer','nequi','card','other');
```

`pending` es la retención de cupo del motor (`06-motor-de-agendamiento.md`), no
un estado que el dueño maneje.

## Núcleo

### businesses

El tenant. Todo cuelga de acá.

```sql
create table businesses (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,   -- minúsculas, con check de formato
  name            text not null,
  category        text not null,              -- barbershop, salon, spa, tattoo, aesthetics
  timezone        text not null default 'America/Bogota',
  phone           text,
  email           text,

  -- Marca
  logo_url        text,
  cover_url       text,
  brand_color     text,

  -- Directorio (todavía sin usar — ver 00-vision-y-negocio.md)
  address         text,
  city            text,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  photos          jsonb not null default '[]',

  -- Reglas de reserva
  slot_granularity_minutes int not null default 15,
  min_notice_minutes       int not null default 120,
  max_advance_days         int not null default 60,
  cancel_notice_minutes    int not null default 240,
  align_to_clock           boolean not null default false,
  allow_staff_choice       boolean not null default true,

  status          business_status not null default 'trialing',
  is_published    boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on businesses (status) where is_published;
```

`slug` es `text` en minúsculas, con un `check` de formato y otro que reserva las
palabras que chocarían con rutas de la aplicación (`api`, `admin`, `app`,
`login`...). La aplicación normaliza a minúsculas antes de buscar, así que
`/Barberia-Juan` y `/barberia-juan` llegan al mismo negocio.

> Se evaluó `citext`, que haría esa normalización sola. Se descartó para no
> sumar una extensión con semántica de operadores distinta a la del resto del
> esquema: una comparación que se comporta diferente según la columna es
> justamente el tipo de sorpresa que cuesta caro después.

**Qué puede cambiar el dueño.** La política de RLS decide qué *fila* toca; los
permisos por columna deciden qué *columnas*. El rol `authenticated` solo tiene
`UPDATE` sobre los datos del perfil, la marca, la ubicación, las fotos, la zona
horaria, las reglas de reserva e `is_published`. **`status` y `slug` quedan
fuera**: sin esto, un dueño en prueba se ponía `status = 'active'` desde la
consola del navegador y nunca pagaba. `status` lo cambian solo la facturación y
el super-admin, con la llave secreta. Una columna nueva que el dueño deba
editar necesita su `grant update` en la migración que la crea.

**Ubicación, zona horaria y fotos** (tarea B4):

- `latitude` y `longitude` van las dos o ninguna (`coordenadas_completas`).
- `timezone` se valida contra `pg_timezone_names` con un trigger — no puede ser
  un `CHECK` porque esa vista no es inmutable. Una zona inventada rompería la
  conversión a UTC del motor de cupos. Error con hint `zona_horaria_invalida`.
- `photos` es una lista JSON de hasta 10 **rutas** dentro del bucket público
  `business-photos`, no URLs. Cada ruta es `<business_id>/<uuid>.jpg`; la
  política de `storage.objects` solo deja subir, ver y borrar en la carpeta de
  un negocio del que el usuario es dueño.

### memberships

Definida en `05-arquitectura-multitenant.md`. Resuelve permisos por la pareja
(usuario, negocio).

### staff

```sql
create table staff (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  name          text not null,
  photo_url     text,
  phone         text,
  bio           text,
  can_block_own_schedule boolean not null default true,
  commission_pct numeric(5,2),          -- v1.1
  display_order int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on staff (business_id) where is_active;
```

Un trabajador **no necesita usuario** para existir. El dueño puede cargar a sus
cuatro barberos y agendarlos sin que ninguno tenga cuenta. La invitación por
email (tarea D5) crea después la membresía y la enlaza por `memberships.staff_id`.
Obligar a que cada barbero cree una cuenta antes de poder agendarlo mataría el
onboarding.

### services

```sql
create table services (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  name                  text not null,
  description           text,
  duration_minutes      int not null check (duration_minutes between 5 and 600),
  price_cop             bigint not null check (price_cop >= 0),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes  int not null default 0 check (buffer_after_minutes  >= 0),
  color                 text,
  category              text,
  display_order         int not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on services (business_id) where is_active;
```

### staff_services

Qué presta cada quién. Sin fila, ese trabajador no aparece para ese servicio.

```sql
create table staff_services (
  staff_id     uuid not null references staff(id) on delete cascade,
  service_id   uuid not null references services(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  duration_override_minutes int,   -- el maestro demora menos que el aprendiz
  price_override_cop        bigint,
  primary key (staff_id, service_id)
);
```

Los `override` cubren algo muy real: en una barbería el maestro cobra más y
demora distinto que el aprendiz. Sin esto, el negocio termina creando "Corte
Andrés" y "Corte Julián" como servicios separados, que ensucia todo.

### working_hours

```sql
create table working_hours (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id    uuid not null references staff(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),   -- 0 = domingo
  starts_at   time not null,
  ends_at     time not null,
  check (ends_at > starts_at)
);

create index on working_hours (staff_id, weekday);
```

**`time` sin zona, a propósito.** "Lunes de 9 a 13" es una hora local recurrente,
no un instante. La conversión a UTC ocurre al calcular la disponibilidad de una
fecha concreta, usando `businesses.timezone`. Ver la sección "El tiempo" de
`06-motor-de-agendamiento.md`.

El turno partido son **dos filas** para el mismo día. Es el caso normal.

### time_off

```sql
create table time_off (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id    uuid references staff(id) on delete cascade,  -- null = todo el local
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index on time_off using gist (staff_id, tstzrange(starts_at, ends_at));
```

`staff_id` nulo cierra el local entero: festivos, inventario, la final de la
Copa.

### customers

```sql
create table customers (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  phone          text not null,              -- E.164: +573001234567
  name           text not null,
  email          text,
  notes          text,                       -- "el 3 a los lados"
  no_show_count  int not null default 0,
  is_blocked     boolean not null default false,
  first_seen_at  timestamptz not null default now(),
  last_visit_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, phone)
);
```

**`unique (business_id, phone)` es la clave del flujo "solo el celular".** El
teléfono identifica al cliente dentro de ese negocio, y la primera vez se le pide
el nombre. El teléfono se normaliza a E.164 **antes** de guardar: sin eso,
`3001234567` y `+57 300 123 4567` son dos clientes distintos y el flujo de
retorno se rompe.

Los clientes son de cada negocio, no globales. La razón está en
`05-arquitectura-multitenant.md`.

### appointments

El centro del producto.

```sql
create table appointments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  customer_id   uuid not null references customers(id),
  staff_id      uuid not null references staff(id),
  service_id    uuid not null references services(id),

  start_at      timestamptz not null,
  end_at        timestamptz not null,

  -- Copiados del servicio al reservar. NO se leen de services.
  price_cop             bigint not null,
  duration_minutes      int    not null,
  buffer_before_minutes int    not null default 0,
  buffer_after_minutes  int    not null default 0,

  status        appointment_status not null default 'pending',
  source        booking_source     not null default 'online',

  manage_token  text not null default encode(gen_random_bytes(24), 'hex'),
  expires_at    timestamptz,               -- solo mientras está 'pending'
  customer_note text,
  internal_note text,

  cancelled_at  timestamptz,
  cancelled_by  text,                      -- 'customer' | 'business' | 'system'
  completed_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  check (end_at > start_at),

  -- Rango realmente ocupado, con buffers. Lo mantiene un trigger.
  blocked_range tstzrange not null
);

-- Va en trigger y no en columna generada porque 'timestamptz - interval' no es
-- IMMUTABLE, y las columnas generadas de Postgres lo exigen.
create function set_appointment_blocked_range() returns trigger
language plpgsql as $$
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

create extension if not exists btree_gist;

alter table appointments add constraint appointments_sin_solapamiento
  exclude using gist (staff_id with =, blocked_range with &&)
  where (status in ('pending','confirmed'));

create index on appointments (business_id, start_at);
create index on appointments (staff_id, start_at);
create index on appointments (customer_id, start_at desc);
create unique index on appointments (manage_token);
create index on appointments (expires_at) where status = 'pending';
```

Tres cosas que merecen atención:

**El precio y la duración se copian.** Si mañana el corte sube a $35.000, las
citas de ayer siguen valiendo $30.000. Leer el precio desde `services` al hacer
un reporte corrompería toda la historia contable. Es la regla 4 de `CLAUDE.md`.

**`no_overlap` es la garantía real contra doble reserva.** No la lógica de la
aplicación. Explicado en `06-motor-de-agendamiento.md`.

**`manage_token` es lo que permite al cliente cancelar sin contraseña.** Es
aleatorio y largo: si fuera el `id`, cualquiera podría recorrer identificadores y
cancelarle las citas a otros.

> **Nota para v1.1 (varios servicios en una cita):** se agrega
> `appointment_services` y `appointments` conserva los totales. No hay que
> migrar nada de lo de arriba: `service_id` pasa a ser el servicio principal.

## Contabilidad

```sql
create table ledger_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  direction   ledger_direction not null,
  is_system   boolean not null default false,
  unique (business_id, name, direction)
);

create table ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  direction      ledger_direction not null,
  amount_cop     bigint not null check (amount_cop > 0),
  occurred_on    date not null,
  category_id    uuid references ledger_categories(id),
  payment_method payment_method not null default 'cash',
  description    text,

  appointment_id uuid references appointments(id),   -- si nació de una cita
  staff_id       uuid references staff(id),

  reverses_id    uuid references ledger_entries(id), -- contra-asiento
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index on ledger_entries (business_id, occurred_on);
create unique index on ledger_entries (appointment_id)
  where appointment_id is not null and reverses_id is null;
```

**El índice único sobre `appointment_id` es la protección contra ingresos
duplicados.** Marcar una cita como cumplida dos veces —doble clic, reintento de
red— no puede generar dos ingresos. La base lo impide; no se delega en el código.

**`amount_cop` siempre positivo**, y `direction` dice si suma o resta. Guardar
egresos como negativos invita a errores de signo en cada suma.

**Corregir es sumar, no borrar.** Si una cita cumplida se revierte, se crea un
asiento inverso que apunta al original por `reverses_id`. La contabilidad
conserva la historia completa, que es justamente para lo que sirve.

`occurred_on` es `date`, no `timestamptz`: la contabilidad se lleva por día del
negocio en su zona horaria, no por instante.

## Suscripción con nosotros

```sql
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null unique references businesses(id) on delete cascade,
  plan                  text not null,          -- essential | professional | studio
  status                business_status not null default 'trialing',
  provider              text,                   -- mercadopago | wompi | manual
  provider_ref          text,
  amount_cop            bigint not null,
  billing_period        text not null default 'monthly',
  trial_ends_at         timestamptz,
  current_period_end    timestamptz,
  grace_until           timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Todo webhook entrante se guarda crudo ANTES de procesarlo
create table subscription_events (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id) on delete cascade,
  provider      text not null,
  event_id      text not null,
  event_type    text not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  error         text,
  received_at   timestamptz not null default now(),
  unique (provider, event_id)
);
```

**`unique (provider, event_id)` hace los webhooks idempotentes.** Las pasarelas
reenvían eventos; sin esto, un reenvío puede cobrar o activar dos veces.
Guardar el `payload` crudo antes de procesar permite reprocesar cuando algo sale
mal, en vez de perder el evento.

## Notificaciones y OTP

```sql
create table notification_log (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references businesses(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete cascade,
  channel        text not null,          -- whatsapp | email | sms
  template       text not null,          -- reminder_24h | confirmation | ...
  recipient      text not null,
  status         text not null,          -- queued|sent|delivered|read|failed
  provider_ref   text,
  cost_usd       numeric(10,6),
  error          text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (appointment_id, template)
);

create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  business_id uuid references businesses(id) on delete cascade,
  code_hash   text not null,
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index on otp_codes (phone, created_at desc);
```

**`unique (appointment_id, template)` es lo que impide mandar el mismo
recordatorio dos veces.** Es la garantía a nivel de base de datos de la tarea I3:
recibir dos recordatorios de la misma cita es de las cosas que más rápido hacen
que un negocio apague la función.

**`code_hash`, nunca el código en claro.** Y `cost_usd` por mensaje es lo que
permite saber cuánto cuesta de verdad cada negocio al mes
(`10-costos-de-infraestructura.md`).

## Reseñas — terreno preparado

Funciona desde el MVP aunque todavía no haya directorio dónde mostrarlas
públicamente. El dueño las ve; el día que se encienda el directorio, ya hay
historia acumulada en vez de empezar en cero.

```sql
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses(id) on delete cascade,
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  staff_id       uuid references staff(id),
  rating         int not null check (rating between 1 and 5),
  comment        text,
  is_public      boolean not null default false,
  created_at     timestamptz not null default now()
);
```

## Alta de negocio

### service_templates

**La única tabla sin `business_id`.** Son datos de referencia globales:
servicios sugeridos por tipo de negocio, con duración y precio de referencia.

```sql
create table service_templates (
  id       uuid primary key default gen_random_uuid(),
  category text not null,           -- barbershop | salon | spa | tattoo | aesthetics
  name     text not null,
  duration_minutes int    not null,
  price_cop        bigint not null,
  buffer_after_minutes int not null default 0,
  display_order int not null default 0,
  unique (category, name)
);
```

Al ser globales, su política es lectura para todos. Es la excepción a la regla 1
de este documento, y la única.

Existen para que el onboarding no arranque con una pantalla en blanco que diga
"cree su primer servicio", que es exactamente donde la gente abandona.

### create_business()

El único camino por el que nace un negocio. `SECURITY DEFINER`, porque tiene que
crear la primera membresía y ninguna política de RLS lo permitiría —
`is_owner()` todavía es falso.

```sql
create_business(
  p_name text, p_slug text, p_category text,
  p_phone text default null, p_timezone text default 'America/Bogota'
) returns uuid
```

En una sola transacción crea: el negocio, la membresía de dueño, la suscripción
en prueba por 14 días, los servicios de plantilla según la categoría, y las
categorías contables base.

Tres decisiones que importan:

- **El dueño es siempre `auth.uid()`**, nunca un parámetro. Si se recibiera por
  parámetro, cualquiera podría crear un negocio a nombre de otro.
- **Una cuenta, un negocio propio.** Evita que alguien cree negocios en masa. El
  cliente con varios locales se resuelve con multi-sede en v2, no con negocios
  sueltos.
- **Se prefirió esta función sobre usar la llave secreta en el registro**: es un
  único punto de entrada auditable, en vez de repartir la llave maestra por el
  flujo de onboarding.

**Errores esperados con `HINT` fijo.** La interfaz los reconoce por el hint, no
por el texto del mensaje:

| Hint | Cuándo |
|---|---|
| `sin_sesion` | Llamada sin usuario autenticado |
| `ya_tiene_negocio` | La cuenta ya es dueña de un negocio |
| `slug_tomado` | El slug existe, incluida la carrera entre dos altas simultáneas |

**Como se puede llamar por RPC saltándose la aplicación, la base repite las
validaciones de Zod** con restricciones sobre `businesses`: `categoria_valida`
(solo las cinco categorías con plantillas), `nombre_valido` (2 a 80
caracteres) y `slug_no_reservado`, que incluye **toda ruta de primer nivel de la
aplicación** (`registro`, `bienvenida`, `auth`...). Una ruta nueva de primer
nivel se agrega en `slug_es_reservado()` (con una migración nueva) y en
`lib/validation/negocio.ts`; si no, un negocio puede
quedarse con ese slug y su página pública queda tapada por la ruta.

### slug_disponible()

Valida el slug en vivo durante el onboarding sin exponer la tabla `businesses` a
consultas del navegador.

**"Disponible" significa "`create_business` lo aceptaría":** libre, con formato
válido y no reservado. Las reglas viven en `slug_tiene_formato()` y
`slug_es_reservado()`, que usan tanto esta función como las restricciones
`slug_formato` y `slug_no_reservado` de `businesses`, para que no puedan
contradecirse.

Solo la ejecuta el rol `authenticated`. Sin sesión serviría para enumerar los
slugs de negocios que todavía no publicaron su página.

## Migraciones

Archivos SQL versionados en `supabase/migrations/`, aplicados con la CLI de
Supabase.

- **Nunca se edita una migración ya aplicada en producción.** Se crea otra.
- Toda migración que cree una tabla **incluye su RLS y sus políticas en el mismo
  archivo**. Una tabla que exista aunque sea un rato sin RLS es una fuga.
- Los tipos de TypeScript se generan desde la base
  (`supabase gen types typescript`) y se commitean. Escribirlos a mano garantiza
  que se desincronicen.
