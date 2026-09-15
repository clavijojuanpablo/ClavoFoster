-- Bloqueos y ausencias
--
-- Un rango de tiempo en que una persona —o el local entero, con staff_id
-- nulo— no atiende: vacaciones, cita médica, un festivo.
--
-- Ver docs/03-backlog.md (tarea D4)

-- ---------------------------------------------------------------------------
-- Trabajador del mismo negocio que la fila
-- ---------------------------------------------------------------------------

-- El mismo hueco que en staff_services y working_hours: RLS solo mira el
-- business_id de la fila. Con MATCH SIMPLE (el valor por defecto) una fila con
-- staff_id nulo —el local entero— no se verifica, que es lo correcto.
--
-- Y esta vez se quita la llave simple en la misma migración: dos llaves hacia
-- staff hacen que la API no sepa cuál usar al traer datos relacionados
-- (PGRST201, ver 20260914190001).
alter table time_off
  add constraint time_off_trabajador_mismo_negocio
    foreign key (staff_id, business_id) references staff (id, business_id) on delete cascade;

alter table time_off drop constraint time_off_staff_id_fkey;

-- ---------------------------------------------------------------------------
-- Motivo
-- ---------------------------------------------------------------------------

alter table time_off add constraint bloqueo_motivo_valido check (
  reason is null or char_length(reason) <= 120
);
