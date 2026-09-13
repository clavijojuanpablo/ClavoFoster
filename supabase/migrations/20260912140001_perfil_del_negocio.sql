-- Perfil del negocio
--
-- Dirección con coordenadas, zona horaria y fotos del local (tarea B4), y un
-- hueco de seguridad que apareció al revisar qué puede editar el dueño.
--
-- Ver docs/03-backlog.md (tarea B4) y docs/adr/0004-white-label-antes-que-marketplace.md

-- ---------------------------------------------------------------------------
-- Qué columnas de businesses puede cambiar el dueño
-- ---------------------------------------------------------------------------

-- La política "dueno_actualiza_su_negocio" decide QUÉ FILA puede tocar, no QUÉ
-- COLUMNAS. Con la llave publicable y su sesión, un dueño podía hacer
--
--   update businesses set status = 'active' where id = '<el suyo>'
--
-- y quedar con la página pública encendida sin pagar nunca. También podía
-- cambiarse el slug, rompiendo los links que ya compartió (ver B3).
--
-- status lo cambian solo la facturación y el super-admin, con la llave secreta.
-- slug no se cambia después del alta. Todo lo demás es del dueño.
revoke update on businesses from anon, authenticated;

grant update (
  name, category, phone, email,
  logo_url, cover_url, brand_color,
  address, city, latitude, longitude, photos,
  timezone,
  slot_granularity_minutes, min_notice_minutes, max_advance_days,
  cancel_notice_minutes, align_to_clock, allow_staff_choice,
  is_published
) on businesses to authenticated;

-- ---------------------------------------------------------------------------
-- Ubicación
-- ---------------------------------------------------------------------------

-- Una coordenada sola no sirve para ubicar nada: van las dos o ninguna.
alter table businesses add constraint coordenadas_completas check (
  (latitude is null) = (longitude is null)
);

alter table businesses add constraint coordenadas_en_rango check (
  latitude between -90 and 90 and longitude between -180 and 180
);

-- ---------------------------------------------------------------------------
-- Zona horaria
-- ---------------------------------------------------------------------------

-- Una zona inventada ('Bogota', 'GMT-5') revienta el motor de cupos al
-- convertir horarios a UTC. No se puede validar con un CHECK porque
-- pg_timezone_names no es inmutable; va en un trigger.
create or replace function validar_zona_horaria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria desconocida: %', new.timezone
      using errcode = '22023', hint = 'zona_horaria_invalida';
  end if;
  return new;
end;
$$;

create trigger businesses_validar_zona_horaria
  before insert or update of timezone on businesses
  for each row execute function validar_zona_horaria();

-- ---------------------------------------------------------------------------
-- Fotos
-- ---------------------------------------------------------------------------

-- photos guarda rutas dentro del bucket 'business-photos', no URLs: si mañana
-- cambia el dominio de Storage, las rutas siguen sirviendo.
alter table businesses add constraint fotos_es_lista check (
  jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 10
);

-- Público para leer: son fotos de la fachada y del local, hechas para mostrarse.
-- Límite de tamaño alto a propósito como red de seguridad; la aplicación ya las
-- reduce en el navegador antes de subirlas (docs/10-costos-de-infraestructura.md).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-photos',
  'business-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Toda foto vive en '<business_id>/<archivo>'. La carpeta dice de qué negocio
-- es, y la política verifica que quien sube sea dueño de ESE negocio: un
-- business_id ajeno en la ruta se rechaza en la base, no en la aplicación.
--
-- Función aparte porque un nombre de carpeta que no es uuid haría fallar el
-- cast dentro de la política, y SQL no garantiza el orden de evaluación de un AND.
create or replace function es_dueno_de_carpeta(p_nombre text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_carpeta text := (storage.foldername(p_nombre))[1];
begin
  if v_carpeta is null
     or v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return is_owner(v_carpeta::uuid);
end;
$$;

create policy "dueno_sube_fotos_de_su_negocio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-photos' and es_dueno_de_carpeta(name));

create policy "dueno_ve_fotos_de_su_negocio" on storage.objects
  for select to authenticated
  using (bucket_id = 'business-photos' and es_dueno_de_carpeta(name));

create policy "dueno_borra_fotos_de_su_negocio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-photos' and es_dueno_de_carpeta(name));
