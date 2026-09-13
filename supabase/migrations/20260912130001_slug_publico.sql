-- Slug público
--
-- slug_disponible() respondía "sí" para cualquier slug que no existiera, aunque
-- fuera inválido ('Con Espacios') o reservado ('login'). La interfaz le decía al
-- dueño que su link estaba libre y create_business lo rechazaba después.
--
-- Acá las reglas del slug pasan a dos funciones que usan tanto las
-- restricciones de la tabla como slug_disponible(), para que no puedan volver a
-- decir cosas distintas.
--
-- Ver docs/03-backlog.md (tarea B3)

-- ---------------------------------------------------------------------------
-- Reglas del slug, en un solo lugar
-- ---------------------------------------------------------------------------

create or replace function slug_tiene_formato(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$';
$$;

-- Toda ruta de primer nivel de la aplicación va acá, y también en
-- lib/validation/negocio.ts para el mensaje del formulario.
create or replace function slug_es_reservado(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_slug in (
    -- Rutas que ya existen o se reservan desde el día 1
    'api', 'admin', 'app', 'auth', 'login', 'signup', 'registro', 'bienvenida',
    'panel', 'cuenta', 'dashboard', 'static', 'assets', 'public', 'soporte',
    'ayuda', 'salir', 'configuracion', 'recuperar', 'cita', 'citas', 'reservar',
    -- Páginas legales y comerciales que van a existir antes de vender
    'precios', 'planes', 'terminos', 'privacidad', 'contacto', 'blog',
    -- Subdominios y nombres que confunden si se usan como negocio
    'www', 'mail', 'plataforma'
  );
$$;

-- Mismos nombres de restricción que antes: los mensajes de error no cambian.
alter table businesses drop constraint slug_formato;
alter table businesses add constraint slug_formato check (slug_tiene_formato(slug));

alter table businesses drop constraint slug_no_reservado;
alter table businesses add constraint slug_no_reservado check (not slug_es_reservado(slug));

-- ---------------------------------------------------------------------------
-- slug_disponible
-- ---------------------------------------------------------------------------

-- "Disponible" ahora significa "create_business lo aceptaría": libre, con
-- formato válido y no reservado.
create or replace function slug_disponible(p_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := lower(btrim(p_slug));
begin
  if not slug_tiene_formato(v_slug) or slug_es_reservado(v_slug) then
    return false;
  end if;

  return not exists (select 1 from businesses where slug = v_slug);
end;
$$;

-- Solo lo usa el onboarding, que ya tiene sesión. Sin sesión serviría para
-- enumerar los slugs de negocios que todavía no publicaron su página.
revoke execute on function slug_disponible(text) from public, anon;
grant execute on function slug_disponible(text) to authenticated;
