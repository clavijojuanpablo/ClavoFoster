-- Horario semanal
--
-- Cada persona del equipo tiene su horario: varios turnos por día de la
-- semana, en hora local del negocio. No hay un horario del local que lo
-- limite (decidido el 2026-09-14): el horario de cada trabajador es el único
-- límite.
--
-- Ver docs/03-backlog.md (tarea D3)

-- ---------------------------------------------------------------------------
-- Trabajador del mismo negocio que la fila
-- ---------------------------------------------------------------------------

-- El mismo hueco que se cerró en staff_services (migración 20260914150001): la
-- política de RLS solo mira el business_id de la fila, y la llave simple no
-- exigía que el trabajador fuera de ese negocio.
alter table working_hours
  add constraint working_hours_trabajador_mismo_negocio
    foreign key (staff_id, business_id) references staff (id, business_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Turnos sin solaparse
-- ---------------------------------------------------------------------------

-- Postgres no tiene un tipo de rango de horas del día: se convierten a minutos
-- desde la medianoche para usar int4range. '[)' por defecto, así que 9-13 y
-- 13-19 se tocan pero no se solapan.
create or replace function minutos_del_dia(p_hora time)
returns int
language sql
immutable
set search_path = public
as $$
  select (extract(hour from p_hora) * 60 + extract(minute from p_hora))::int;
$$;

alter table working_hours
  add constraint turnos_sin_solaparse
    exclude using gist (
      staff_id with =,
      weekday with =,
      int4range(minutos_del_dia(starts_at), minutos_del_dia(ends_at)) with &&
    );

-- ---------------------------------------------------------------------------
-- guardar_horario: reemplaza el horario completo, todo o nada
-- ---------------------------------------------------------------------------

-- El horario se edita entero en una pantalla. Borrar e insertar desde la
-- aplicación en dos llamadas podía dejar a la persona sin horario si la
-- segunda fallaba; acá ocurre en una sola transacción.
--
-- SECURITY INVOKER: corre con los permisos de quien llama, así que las
-- políticas de RLS de working_hours siguen mandando. El chequeo de dueño es
-- para dar un error claro, no la garantía.
create or replace function guardar_horario(p_staff_id uuid, p_turnos jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from staff where id = p_staff_id;

  if v_business_id is null or not is_owner(v_business_id) then
    raise exception 'No encontramos a esa persona'
      using errcode = '42501', hint = 'sin_permiso';
  end if;

  delete from working_hours where staff_id = p_staff_id;

  begin
    insert into working_hours (business_id, staff_id, weekday, starts_at, ends_at)
    select v_business_id, p_staff_id, (t ->> 'weekday')::int, (t ->> 'desde')::time, (t ->> 'hasta')::time
    from jsonb_array_elements(coalesce(p_turnos, '[]'::jsonb)) as t;
  exception
    when exclusion_violation then
      raise exception 'Dos turnos del mismo día se cruzan'
        using errcode = '23P01', hint = 'turnos_solapados';
    when check_violation then
      raise exception 'Un turno termina antes de empezar'
        using errcode = '23514', hint = 'turno_invalido';
  end;
end;
$$;

revoke execute on function guardar_horario(uuid, jsonb) from public, anon;
grant execute on function guardar_horario(uuid, jsonb) to authenticated;
