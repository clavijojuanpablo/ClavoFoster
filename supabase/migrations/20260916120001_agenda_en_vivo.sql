-- G1 — La agenda se actualiza sola
--
-- Si un cliente reserva mientras el dueño mira la pantalla, la cita tiene que
-- aparecer sin recargar. Para eso Supabase Realtime necesita que la tabla esté
-- publicada; no basta con suscribirse desde el navegador.
--
-- Esto NO abre nada: Realtime respeta RLS igual que cualquier consulta, así que
-- por el canal solo viajan las filas que esa sesión ya podría leer. Un negocio
-- no se entera de las citas de otro.
alter publication supabase_realtime add table appointments;

-- Realtime manda los valores viejos de la fila en un UPDATE o un DELETE solo si
-- la tabla tiene REPLICA IDENTITY FULL. Sin esto, al cancelar una cita el
-- evento llega sin `business_id` y el filtro del canal lo descarta: la cita
-- desaparecida se quedaría en pantalla hasta recargar.
alter table appointments replica identity full;
