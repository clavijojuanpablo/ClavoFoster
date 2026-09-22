---
name: migracion
description: Crear una migración SQL de Supabase para Bookia (tabla nueva, columna, restricción, función, política RLS, trigger). Úsala siempre que haya que cambiar el esquema de la base - nunca se cambia desde el dashboard. Cubre nombre del archivo, plantilla con RLS, aplicación con db:push, tipos, docs/07 y prueba de aislamiento.
argument-hint: <qué cambia, ej. "tabla payment_methods">
---

# Migración

Cambio: **$ARGUMENTS**

## Reglas

- Todo cambio de esquema es un archivo nuevo en `supabase/migrations/`. Jamás
  desde el editor del dashboard.
- **No se edita una migración ya versionada**: casi seguro ya está aplicada en
  la base de desarrollo. Se escribe otra.
- La base de desarrollo es **compartida y en la nube**: no hay reset. Una
  migración mala se arregla con otra migración.

## 1. Antes de escribir

- Lee la parte de `docs/07-modelo-de-datos.md` que toca y la migración más
  reciente para copiar el estilo (comentarios en español que explican el
  porqué, nombres en inglés `snake_case`).
- Nombre: `AAAAMMDDHHMMSS_descripcion_en_snake_case.sql`, con fecha de hoy,
  posterior a la última (`ls supabase/migrations | tail -3`). El repo usa
  `AAAAMMDD` + `HH0001` incremental.

## 2. Plantilla de tabla de negocio

```sql
-- Qué es y para qué tarea del backlog (ej. H3). Por qué cada restricción.

create table payment_methods (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 40),
  is_active   boolean not null default true,       -- regla 5: no se borra
  created_at  timestamptz not null default now(),  -- regla 3: timestamptz
  unique (business_id, id)                         -- para llaves compuestas desde otras tablas
);

create index payment_methods_business_idx on payment_methods (business_id);

alter table payment_methods enable row level security;

create policy "miembros_leen_metodos" on payment_methods
  for select to authenticated
  using (business_id in (select auth_business_ids()));

create policy "dueno_crea_metodos" on payment_methods
  for insert to authenticated
  with check (is_owner(business_id));

create policy "dueno_actualiza_metodos" on payment_methods
  for update to authenticated
  using (is_owner(business_id))
  with check (is_owner(business_id));
```

Si la tabla referencia otra entidad del negocio, usa llave compuesta para que
no pueda cruzar negocios:

```sql
  staff_id uuid not null,
  foreign key (business_id, staff_id) references staff (business_id, id)
```

(una sola llave foránea entre dos tablas; dos provocan `PGRST201`).

Otros recordatorios:
- Dinero: `bigint` y sufijo `_cop`. Instantes: `timestamptz` y sufijo `_at`.
  Fechas sin hora: `date` y sufijo `_on`.
- Columna nueva en `businesses` editable por el dueño: `grant update (col) on businesses to authenticated`.
- `security definer` → `set search_path = public` y verifica membresía adentro.
- Si la agenda en vivo la necesita: `alter publication supabase_realtime add table ...`.
- Ruta nueva de primer nivel → `slug_es_reservado()` y `SLUGS_RESERVADOS` en
  `lib/validation/negocio.ts`.

## 3. Revisar y aplicar

1. Agente `revisor-migraciones` sobre el archivo. Corrige lo que marque.
2. Pide al usuario aplicar: `npm run db:push` (el hook pide confirmación; explica
   qué cambia en la base compartida).
3. `npm run db:types` para regenerar `lib/types/database.ts`.
4. `npm run typecheck`.

## 4. En el mismo cambio

- `docs/07-modelo-de-datos.md` actualizado.
- Tabla nueva en `tests/aislamiento.test.ts` (leer y escribir desde el otro
  negocio → cero filas / rechazo) y, si tiene restricciones con significado de
  negocio, en `tests/garantias-del-esquema.test.ts`.
- Corre esas dos pruebas.
