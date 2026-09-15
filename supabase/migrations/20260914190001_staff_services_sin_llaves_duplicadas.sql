-- staff_services: una sola relación con staff y con services
--
-- La migración 20260914150001 agregó llaves compuestas (staff_id, business_id)
-- y (service_id, business_id) y dejó las llaves simples originales. Con dos
-- llaves hacia la misma tabla, la API de Supabase (PostgREST) ya no sabe cuál
-- usar al traer datos relacionados —`staff.select('..., staff_services(...)')`
-- responde PGRST201— y la pantalla Equipo dejó de cargar.
--
-- Las compuestas cubren todo lo que hacían las simples (business_id es NOT
-- NULL, así que siempre se verifican) y además exigen el mismo negocio. Las
-- simples sobran.

alter table staff_services drop constraint staff_services_staff_id_fkey;
alter table staff_services drop constraint staff_services_service_id_fkey;
