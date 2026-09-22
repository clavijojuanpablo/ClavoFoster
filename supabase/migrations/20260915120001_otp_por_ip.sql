-- F4 — Identificación del cliente por OTP de WhatsApp
--
-- Los límites por número no alcanzan: quien quiera quemarnos el saldo de
-- WhatsApp solo tiene que cambiar de número en cada vuelta. El freno que de
-- verdad sirve es por conexión.
--
-- Se guarda una HUELLA de la IP (HMAC), no la IP. Contar envíos no necesita
-- saber de dónde vienen, y una IP es dato personal: si mañana se filtra este
-- registro, no hay nada que filtrar.
alter table otp_codes add column ip_hash text;

-- Los dos caminos de lectura del límite: "cuántos pidió este número en la
-- última hora" y "cuántos salieron de esta conexión".
create index otp_codes_ip_idx on otp_codes (ip_hash, created_at desc);

-- Un código consumido o vencido no vuelve a servir para nada, y estos datos
-- son de un desconocido. Se borran los de más de un día.
--
-- Nadie lo llama solo todavía, igual que `cleanup-holds`: el programador va
-- con pg_cron cuando se configure. Ver docs/14-estado-actual.md
create or replace function limpiar_otp_vencidos()
returns integer
language sql
security definer
set search_path = public
as $$
  with borrados as (
    delete from otp_codes where created_at < now() - interval '1 day' returning 1
  )
  select count(*)::integer from borrados;
$$;

-- ---------------------------------------------------------------------------
-- F5 — Crear la cita desde la página pública
-- ---------------------------------------------------------------------------

-- `blocked_range` la llena el trigger `appointments_set_blocked_range` antes de
-- cada insert, pero en los tipos generados aparece como columna obligatoria:
-- toda inserción tendría que mandar un rango inventado que el trigger pisa un
-- microsegundo después. Con un default deja de ser obligatoria y el trigger
-- sigue siendo el único que la escribe de verdad.
alter table appointments alter column blocked_range set default 'empty'::tstzrange;
