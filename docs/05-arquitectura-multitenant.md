# 05 — Arquitectura multi-tenant

> Este documento responde la pregunta central del proyecto: **cómo se le vende
> el mismo producto a 100 negocios sin hacerle una instalación a cada uno.**

## La decisión

**Una sola base de datos, un solo esquema, `tenant_id` en cada tabla, y Row
Level Security de Postgres haciendo cumplir el aislamiento.**

Dar de alta un negocio nuevo es **insertar una fila**. No se crea una base, ni un
esquema, ni un despliegue, ni se corre ninguna migración. Ese es exactamente el
requisito de "vender en masa sin instalaciones personalizadas".

### Las tres opciones que existían

| Modelo | Cómo aísla | Por qué se descartó |
|---|---|---|
| **Base por negocio** | Cada uno su base de datos | Aislamiento perfecto, pero 100 bases son 100 migraciones, 100 copias de seguridad y un costo fijo por negocio que destruye el margen |
| **Esquema por negocio** | Una base, 100 esquemas | Cambiar una columna implica migrar 100 esquemas. Si una falla a la mitad, quedan versiones distintas en producción. Inmanejable de a dos personas |
| **Fila por negocio + RLS** ✅ | Una base, un esquema, `tenant_id` y políticas | Una migración para todos. Riesgo: una política mal escrita filtra datos entre negocios. Se mitiga con pruebas automáticas obligatorias |

Ver `adr/0001-multi-tenancy-con-rls.md`.

**Cuándo se reconsidera:** si llega un cliente grande con exigencia contractual
de base separada. En ese caso se despliega una instancia dedicada del mismo
código — no se cambia la arquitectura para todos.

## Por qué RLS y no filtrar en el código

Se podría poner `where tenant_id = ?` en cada consulta. El problema es que
funciona hasta que alguien lo olvida una vez. Y ese olvido no falla ni da error:
simplemente devuelve datos de otro negocio. Es el peor tipo de bug — silencioso,
y descubrirlo significa haberle mostrado a un dueño la agenda de su competencia.

Con RLS la que filtra es la base de datos. Aunque el código haga
`select * from appointments` sin condiciones, Postgres devuelve únicamente las
filas del negocio de la sesión. **El aislamiento deja de depender de que nadie se
equivoque nunca.**

## Estructura

`businesses` es la tabla de tenants. Todo lo demás cuelga de ella por
`business_id`.

```
businesses  (el tenant)
├── memberships       (qué usuario pertenece a qué negocio, con qué rol)
├── staff             (trabajadores)
├── services          (servicios)
├── customers         (clientes finales — propios de cada negocio)
├── appointments      (citas)
├── ledger_entries    (movimientos contables)
└── subscriptions     (suscripción del negocio con nosotros)
```

**Los clientes finales son de cada negocio, no globales.** Si Camila reserva en
dos barberías distintas, son dos filas en `customers`. Podrían unificarse por
teléfono, pero no se hace: cada negocio considera suya su base de clientes, y
compartirla entre negocios sería traicionar esa expectativa. El día que exista
el directorio, se resuelve con una identidad global aparte que *apunta* a los
clientes por negocio, sin fusionarlos.

## Quién es quién: la tabla `memberships`

Un usuario no "pertenece" a un negocio: tiene una **membresía** en él, con un
rol. Eso permite que la misma persona sea dueña de un local y trabajadora en
otro, sin trucos.

```sql
create type app_role as enum ('owner', 'staff');

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role        app_role not null,
  staff_id    uuid references staff(id),   -- si el rol es 'staff'
  created_at  timestamptz not null default now(),
  unique (user_id, business_id)
);
```

**Los permisos se resuelven siempre por la pareja (usuario, negocio).** Nunca por
el usuario solo.

## Las políticas

La pieza central es una función que devuelve los negocios del usuario de la
sesión:

```sql
create or replace function auth_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from memberships where user_id = auth.uid();
$$;
```

Y una para saber si es dueño:

```sql
create or replace function is_owner(b_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and business_id = b_id and role = 'owner'
  );
$$;
```

Con eso, cada tabla queda protegida así:

```sql
alter table appointments enable row level security;

-- Cualquier miembro del negocio ve sus citas
create policy "miembros_leen_citas" on appointments
  for select using (business_id in (select auth_business_ids()));

-- Solo miembros del negocio pueden crear, y solo en su propio negocio
create policy "miembros_crean_citas" on appointments
  for insert with check (business_id in (select auth_business_ids()));

create policy "miembros_actualizan_citas" on appointments
  for update using (business_id in (select auth_business_ids()));
```

La contabilidad es más restrictiva: **solo el dueño**.

```sql
alter table ledger_entries enable row level security;

create policy "solo_dueno_ve_contabilidad" on ledger_entries
  for select using (is_owner(business_id));
```

> **Detalle de rendimiento, no cosmético:** escribir
> `business_id in (select auth_business_ids())` en vez de llamar a la función
> por fila permite que Postgres la evalúe una sola vez. La diferencia se nota
> cuando la tabla de citas crece. Y toda columna `business_id` va indexada,
> siempre en primer lugar de los índices compuestos.

## El lado público: quien reserva no tiene sesión

El cliente final entra sin autenticarse. Se resuelve en dos caminos separados:

**Lectura pública — con políticas sobre el rol anónimo.** Solo datos que el
negocio decidió publicar, y solo de negocios activos:

```sql
-- Qué estados de suscripción tienen página pública. Un solo lugar.
create function estado_tiene_pagina_publica(p_status business_status)
returns boolean immutable
as $$ select p_status in ('trialing', 'active', 'past_due'); $$;

create policy "publico_lee_negocio_activo" on businesses
  for select to anon, authenticated
  using (is_published and estado_tiene_pagina_publica(status));

create policy "publico_lee_servicios_activos" on services
  for select to anon, authenticated
  using (
    is_active
    and business_id in (
      select id from businesses
      where is_published and estado_tiene_pagina_publica(status)
    )
  );
```

Nótese que si la suscripción se suspende, `status` pasa a `suspended` y **la
página pública se apaga sola**, sin código adicional. Durante la prueba gratis
(`trialing`) y los días de gracia tras un cobro fallido (`past_due`) sigue
encendida, como define `08-pagos-y-suscripciones.md`: un negocio en prueba
tiene que poder recibir reservas, que es lo que lo convence de pagar.

Además, el dueño decide si su página está visible con `is_published`, desde el
perfil del negocio. Un negocio nuevo nace oculto.

**Escritura — nunca directa.** El cliente anónimo jamás escribe en la base. Crear
una cita pasa por un Server Action en el servidor que:

1. Verifica el OTP del teléfono.
2. Recalcula la disponibilidad del cupo **en el servidor**. Nunca confía en lo
   que mandó el navegador: el precio, la duración y el cupo se vuelven a
   resolver desde la base.
3. Inserta con un cliente privilegiado, poniendo él mismo el `business_id`.

**El `business_id` jamás llega desde el navegador.** Se deriva del slug de la
URL, ya verificado contra la base. Esta es la regla 2 de `CLAUDE.md` y es la
más fácil de violar sin darse cuenta.

Los datos personales de `customers` y `appointments` **no tienen política para el
rol anónimo**: nadie puede listarlos sin sesión. El cliente ve su propia cita
únicamente por el token aleatorio de su link (tarea F6).

## Cómo se resuelve el negocio en cada petición

**Ruta pública:** `laplataforma.com/barberia-juan` → se busca el slug, se
verifica que esté publicado y activo, y ese es el negocio del que se leen datos.

**Panel:** el negocio sale de la sesión. Si el usuario tiene membresía en varios,
hay un selector y la elección se guarda; pero **siempre se re-verifica en el
servidor** que ese usuario tenga membresía en el negocio que dice tener activo.

*Se prefirió ruta (`/barberia-juan`) sobre subdominio
(`barberia-juan.laplataforma.com`).* Con subdominios hay que resolver
certificados comodín y complica el desarrollo local, a cambio de un beneficio
sobre todo estético. El modelo de datos guarda el slug aparte, así que migrar a
subdominios después es posible sin tocar nada más.

## Dar de alta un negocio

Todo el aprovisionamiento es una transacción:

1. Crear el usuario en `auth.users`.
2. Insertar la fila en `businesses` con su slug y su zona horaria.
3. Insertar la membresía con rol `owner`.
4. Insertar los servicios de plantilla según el tipo de negocio.
5. Crear la suscripción en estado `trialing` por 14 días.

Sin migraciones, sin despliegues, sin intervención humana. **Un negocio nuevo
está operando en menos de un minuto**, y ese es el requisito que hace posible el
modelo de negocio.

## Configuración por negocio, nunca código por negocio

La regla que protege la arquitectura: **cuando un cliente pide algo distinto, la
respuesta es una opción de configuración, jamás una rama de código.**

Lo que es configurable:

- Horarios del local y de cada trabajador.
- Duraciones, precios y buffers de cada servicio.
- Anticipación mínima para reservar y para cancelar; ventana máxima a futuro.
- Granularidad de los cupos (cada 10, 15, 20 o 30 minutos).
- Qué notificaciones se envían y con cuánta anticipación.
- Marca: logo, color, fotos.
- Si el cliente puede escoger trabajador o siempre se le asigna.

Un `if (business.name === 'Barbería Juan')` en el código es deuda que no se paga
nunca. Si una petición no cabe en configuración y de verdad vale la pena, se
vuelve una función del producto para todos.

## Cómo se verifica que el aislamiento funciona

Esto no es opcional ni se hace "cuando haya tiempo". Es parte de la tarea A3.

1. **Prueba automática de fuga:** crear dos negocios con datos; autenticarse como
   miembro del negocio A e intentar leer y escribir en todas las tablas del
   negocio B. Cada intento debe devolver cero filas o ser rechazado. **Esta
   prueba corre en cada despliegue** y si falla, no se despliega.
2. **Revisión obligatoria en cada pull request que agregue una tabla:** ¿tiene
   `business_id`? ¿tiene RLS activa? ¿tiene política de lectura y de escritura?
   ¿está indexada? Está en la definición de terminado de
   `12-convenciones-de-desarrollo.md`.
3. **Prueba del rol anónimo:** sin sesión, verificar que no se puede leer
   `customers`, `appointments` ni `ledger_entries` de ningún negocio.
