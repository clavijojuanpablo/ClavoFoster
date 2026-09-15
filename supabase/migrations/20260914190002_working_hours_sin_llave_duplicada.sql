-- working_hours: una sola relación con staff
--
-- Mismo problema que 20260914190001 en staff_services: la migración
-- 20260914170001 agregó la llave compuesta (staff_id, business_id) y dejó la
-- simple. Con las dos, `staff.select('..., working_hours(...)')` responde
-- PGRST201 y la pantalla Equipo no carga. La compuesta cubre lo mismo y exige
-- el mismo negocio.

alter table working_hours drop constraint working_hours_staff_id_fkey;
