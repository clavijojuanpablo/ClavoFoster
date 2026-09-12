-- Registro de negocio
--
-- create_business() se puede llamar directo por RPC con la llave publicable,
-- sin pasar por la aplicación. Por eso lo que la interfaz valida con Zod
-- también tiene que garantizarlo la base: acá se cierran los huecos que deja
-- esa puerta abierta.
--
-- Ver docs/03-backlog.md (tarea B1)

-- ---------------------------------------------------------------------------
-- Slugs reservados
-- ---------------------------------------------------------------------------

-- Toda ruta de primer nivel de la aplicación tiene que estar acá. Si un negocio
-- se queda con el slug 'registro', la ruta /registro gana y su página pública
-- queda inalcanzable para siempre, sin error visible.
--
-- La lista se repite en lib/validation/negocio.ts para dar un mensaje claro en
-- el formulario. La garantía es esta; la de allá es solo cortesía.
alter table businesses drop constraint slug_no_reservado;

alter table businesses add constraint slug_no_reservado check (
  slug not in (
    -- Rutas que ya existen o se reservan desde el día 1
    'api', 'admin', 'app', 'auth', 'login', 'signup', 'registro', 'bienvenida',
    'panel', 'cuenta', 'dashboard', 'static', 'assets', 'public', 'soporte',
    'ayuda', 'salir', 'configuracion', 'recuperar', 'cita', 'citas', 'reservar',
    -- Páginas legales y comerciales que van a existir antes de vender
    'precios', 'planes', 'terminos', 'privacidad', 'contacto', 'blog',
    -- Subdominios y nombres que confunden si se usan como negocio
    'www', 'mail', 'plataforma'
  )
);

-- ---------------------------------------------------------------------------
-- Categoría y nombre
-- ---------------------------------------------------------------------------

-- Una categoría inventada crearía un negocio sin servicios de plantilla, que
-- es justamente la pantalla en blanco que el onboarding quiere evitar.
alter table businesses add constraint categoria_valida check (
  category in ('barbershop', 'salon', 'spa', 'tattoo', 'aesthetics')
);

alter table businesses add constraint nombre_valido check (
  char_length(btrim(name)) between 2 and 80
);

-- ---------------------------------------------------------------------------
-- create_business: errores distinguibles
-- ---------------------------------------------------------------------------

-- Misma función que en la migración 4. Cambia solo cómo avisa: el slug tomado y
-- la cuenta con negocio devolvían el mismo código (23505) y la interfaz no
-- podía saber cuál de los dos mostrar. Ahora cada caso lleva un HINT fijo que
-- la aplicación reconoce sin depender del texto del mensaje.
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
  v_slug        text := lower(btrim(p_slug));
begin
  if v_user_id is null then
    raise exception 'Hay que iniciar sesión para crear un negocio'
      using errcode = '42501', hint = 'sin_sesion';
  end if;

  -- Un usuario, un negocio propio. Evita que una cuenta cree negocios en masa.
  if exists (
    select 1 from memberships
    where user_id = v_user_id and role = 'owner'
  ) then
    raise exception 'Esta cuenta ya tiene un negocio'
      using errcode = '23505', hint = 'ya_tiene_negocio';
  end if;

  if exists (select 1 from businesses where slug = v_slug) then
    raise exception 'Ese link ya lo tiene otro negocio'
      using errcode = '23505', hint = 'slug_tomado';
  end if;

  -- Si dos personas piden el mismo slug al mismo tiempo, el chequeo de arriba
  -- pasa para ambas y el índice único rechaza a la segunda. Se traduce al mismo
  -- aviso para que la interfaz no tenga que conocer el nombre del índice.
  begin
    insert into businesses (name, slug, category, phone, timezone)
    values (btrim(p_name), v_slug, p_category, p_phone, p_timezone)
    returning id into v_business_id;
  exception when unique_violation then
    raise exception 'Ese link ya lo tiene otro negocio'
      using errcode = '23505', hint = 'slug_tomado';
  end;

  insert into memberships (user_id, business_id, role)
  values (v_user_id, v_business_id, 'owner');

  -- Prueba de 14 días, sin tarjeta. Ver docs/08-pagos-y-suscripciones.md
  insert into subscriptions (business_id, plan, status, amount_cop, trial_ends_at)
  values (v_business_id, 'trial', 'trialing', 0, now() + interval '14 days');

  -- Servicios sugeridos según el tipo de negocio.
  insert into services (business_id, name, duration_minutes, price_cop, buffer_after_minutes, display_order)
  select v_business_id, t.name, t.duration_minutes, t.price_cop, t.buffer_after_minutes, t.display_order
  from service_templates t
  where t.category = p_category;

  -- Categorías contables base. 'Servicios' es del sistema: ahí caen los
  -- ingresos automáticos de las citas cumplidas.
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
