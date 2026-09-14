-- El producto se llama Bookia (provisional, 2026-09-14).
--
-- Un negocio con el slug 'bookia' confundiría: su link se leería como una
-- página del producto. Se reserva igual que 'plataforma'.
--
-- Misma función que en la migración 20260912130001, con un nombre más. La
-- lista se repite en lib/validation/negocio.ts para el mensaje del formulario.

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
    'www', 'mail', 'plataforma', 'bookia'
  );
$$;
