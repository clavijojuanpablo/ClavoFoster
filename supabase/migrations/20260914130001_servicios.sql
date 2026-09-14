-- Servicios
--
-- El dueño crea, edita y desactiva sus servicios desde el panel. La tabla se
-- puede escribir directo con la llave publicable y la sesión del dueño, sin
-- pasar por la aplicación: lo que lib/validation/servicio.ts valida para dar un
-- mensaje claro, la base lo garantiza acá.
--
-- Ver docs/03-backlog.md (tareas C1 y C2)

-- ---------------------------------------------------------------------------
-- Buffers fuera del MVP
-- ---------------------------------------------------------------------------

-- La duración del servicio incluye todo el tiempo que necesita. El tiempo de
-- preparación que traían las plantillas se suma a su duración (Tinte 120 → 135)
-- para que ningún negocio nuevo arranque con un tiempo oculto que no puede ver
-- ni editar. Las columnas quedan, en 0: el motor de cupos las sigue soportando.
update service_templates
set duration_minutes = duration_minutes + buffer_after_minutes,
    buffer_after_minutes = 0
where buffer_after_minutes > 0;

-- Lo mismo con los servicios ya creados. Las citas no cambian: guardan su
-- propia duración y sus propios buffers (regla 4 de CLAUDE.md).
update services
set duration_minutes = least(600, duration_minutes + buffer_before_minutes + buffer_after_minutes),
    buffer_before_minutes = 0,
    buffer_after_minutes = 0
where buffer_before_minutes > 0 or buffer_after_minutes > 0;

-- ---------------------------------------------------------------------------
-- Restricciones
-- ---------------------------------------------------------------------------

alter table services add constraint servicio_nombre_valido check (
  char_length(btrim(name)) between 2 and 80
);

alter table services add constraint servicio_descripcion_valida check (
  description is null or char_length(description) <= 300
);

-- Cien millones: ningún servicio de belleza cuesta eso. Un precio así es un
-- cero de más al escribir, y dañaría los reportes de caja.
alter table services add constraint servicio_precio_maximo check (
  price_cop <= 100000000
);

-- El color se escoge de la paleta de lib/colores.ts. La base no repite la
-- paleta —cambiarla no debería exigir una migración—, pero sí exige un hex
-- limpio, que es lo que la agenda sabe pintar.
alter table services add constraint servicio_color_valido check (
  color is null or color ~ '^#[0-9a-f]{6}$'
);
