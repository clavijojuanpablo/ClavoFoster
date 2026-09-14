-- Equipo
--
-- El dueño crea, edita y desactiva a sus trabajadores y marca qué servicios
-- presta cada uno. Igual que con los servicios, la tabla se puede escribir
-- directo con la llave publicable y la sesión del dueño: lo que
-- lib/validation/trabajador.ts valida para dar un mensaje claro, la base lo
-- garantiza acá.
--
-- Ver docs/03-backlog.md (tareas D1 y D2)

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------

alter table staff add constraint trabajador_nombre_valido check (
  char_length(btrim(name)) between 2 and 80
);

alter table staff add constraint trabajador_perfil_valido check (
  bio is null or char_length(bio) <= 300
);

-- Mismo formato que businesses.phone: E.164, +573001234567.
alter table staff add constraint trabajador_celular_valido check (
  phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'
);

-- photo_url guarda la RUTA dentro del bucket 'business-photos', no una URL,
-- igual que businesses.photos (ver lib/fotos.ts). Y solo puede apuntar a la
-- carpeta de su propio negocio: sin esto, un dueño podría mostrar como foto de
-- su barbero un archivo de otro negocio.
alter table staff add constraint trabajador_foto_valida check (
  photo_url is null
  or photo_url ~ ('^' || business_id::text || '/equipo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
);

-- ---------------------------------------------------------------------------
-- staff_services: trabajador y servicio del mismo negocio
-- ---------------------------------------------------------------------------

-- La política de RLS exige que el dueño sea dueño del business_id de la fila,
-- pero las llaves foráneas simples no exigen que el trabajador y el servicio
-- sean de ESE negocio. Un dueño podía enlazar su servicio con el barbero de
-- otro negocio. Las llaves compuestas lo cierran en la base.
alter table staff    add constraint staff_id_negocio_unico    unique (id, business_id);
alter table services add constraint services_id_negocio_unico unique (id, business_id);

alter table staff_services
  add constraint staff_services_trabajador_mismo_negocio
    foreign key (staff_id, business_id) references staff (id, business_id) on delete cascade,
  add constraint staff_services_servicio_mismo_negocio
    foreign key (service_id, business_id) references services (id, business_id) on delete cascade;
