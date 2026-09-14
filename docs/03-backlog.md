# 03 — Backlog

**Este es el documento de control del proyecto.** Cada tarea tiene un ID que se
usa en la rama de git, en el commit y en el pull request.

## Cómo se lee

**Prioridad (MoSCoW):**

| | Significado |
|---|---|
| **M** | *Must.* Sin esto no se puede vender. Es el MVP |
| **S** | *Should.* Muy importante, pero se puede lanzar sin ello |
| **C** | *Could.* Se hace si sobra tiempo |
| **W** | *Won't.* Decidido explícitamente para después. Está en `11-roadmap.md` |

**Estado:** `Pendiente` · `En curso` · `En revisión` · `Hecho` · `Bloqueado`

Una tarea solo pasa a `Hecho` cuando cumple la definición de terminado de
`12-convenciones-de-desarrollo.md`. No basta con que funcione en la máquina de
quien la hizo.

## Avance

| Épica | Tareas | Hechas | Estado |
|---|---|---|---|
| A. Fundación técnica | 7 | 7 | **Hecho** |
| B. Negocio y onboarding | 5 | 4 | En curso |
| C. Servicios | 2 | 1 | En curso |
| D. Trabajadores y horarios | 5 | 0 | Pendiente |
| E. Motor de agendamiento | 5 | 5 | **Hecho** |
| F. Reserva pública | 6 | 0 | Pendiente |
| G. Panel y calendario | 6 | 0 | Pendiente |
| H. Contabilidad | 5 | 0 | Pendiente |
| I. Notificaciones | 5 | 0 | Pendiente |
| J. Suscripciones | 6 | 0 | Pendiente |
| K. Reportes | 3 | 0 | Pendiente |
| **Total MVP** | **55** | **17** | |

## Orden de ejecución

Las épicas tienen dependencias reales. Este es el orden en que hay que
atacarlas:

```
A (fundación)
└── B (negocio) ── C (servicios) ── D (trabajadores)
                                     └── E (motor de cupos)  ← el corazón
                                          ├── F (reserva pública)
                                          └── G (panel del dueño)
                                               └── H (contabilidad) ── K (reportes)
I (notificaciones) ── se engancha después de F y G
J (suscripciones) ── se puede hacer en paralelo desde B
```

**E es la épica crítica.** Todo lo demás es interfaz sobre ella. Si el motor de
cupos está mal, el producto no sirve. Hacerla temprano y con pruebas.

**Recomendación de arranque:** hacer A→B→C→D→E completas antes de tocar
interfaz bonita. Con el motor funcionando y datos reales cargados se puede hacer
una demo por consola que ya convence a un dueño de barbería.

---

# Épica A — Fundación técnica

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| A1 | Proyecto Next.js 16 + TypeScript estricto + Tailwind + shadcn/ui | M | **Hecho** |
| A2 | Proyecto Supabase (en la nube, enlazado) y migraciones versionadas | M | **Hecho** |
| A3 | Esquema base y políticas RLS de `07-modelo-de-datos.md` | M | **Hecho** |
| A4 | Resolución de tenant por slug y por sesión | M | **Hecho** |
| A5 | Autenticación de dueño y trabajador (email + contraseña) | M | **Hecho** |
| A6 | Despliegue en Vercel con entornos de desarrollo y producción | M | **Hecho** |
| A7 | Sistema de diseño, menú responsive y pantallas existentes con el nuevo estilo | M | **Hecho** |

**A7 — Sistema de diseño.** Se adelantó antes de la épica C para no construir
las pantallas de servicios, equipo y calendario con un estilo que habría que
rehacer. Detalle en `15-sistema-de-diseno.md`. Incluye: tokens de color y
tipografía, botón/tarjeta/campo, menú lateral en escritorio y barra inferior con
hoja "Más" en celular, y el Inicio del panel con datos reales (citas de hoy,
siguiente cita, caja del día y el recordatorio "Completa tu negocio").

Cerrada el 2026-09-14. Revisada a mano sobre el build de producción, a 375 px y
en escritorio: Inicio, Perfil del negocio, la hoja "Más" y la página pública.
Las secciones que todavía no existen quedan en "Pronto" y se activan en
`components/admin/navegacion.ts` al terminar su tarea.

**A3 — Esquema base y RLS.** Criterios de aceptación:
- Toda tabla de negocio tiene `tenant_id` y RLS activa.
- Existe una prueba automatizada que, autenticada como negocio A, intenta leer
  filas del negocio B y obtiene cero resultados. **Esta prueba es obligatoria y
  se corre en cada despliegue.**
- Las migraciones corren desde cero en una base vacía sin intervención manual.

**A4 — Resolución de tenant.** Criterios:
- Desde una ruta pública `/[slug]`, el negocio se resuelve por slug y solo se
  exponen sus datos públicos.
- Desde el panel, se resuelve por la sesión del usuario.
- Un `tenant_id` enviado por el cliente se ignora siempre. Hay una prueba que lo
  verifica.

**A6 — Despliegue en Vercel.** Cerrada el 2026-09-11. Vercel está conectado al
repositorio: cada `push` a `main` despliega a producción y cada rama genera un
despliegue de vista previa. Lo verificado en vivo:

- La página pública `/[slug]` sirve datos reales desde Supabase.
- `/panel` sin sesión responde `307` hacia `/login`. El `proxy.ts` corre.
- Un slug inexistente responde `404`, no una página en blanco.
- `/api/cron/cleanup-holds` sin cabecera responde `401`, no `500` — es decir,
  `CRON_SECRET` sí quedó configurado en Vercel.

**Lo que quedó aplazado a propósito, y no bloquea ninguna épica:**

- **No hay proyecto de Supabase de producción todavía.** El despliegue apunta al
  proyecto de *desarrollo*. Sirve para mostrar el producto, no para negocios
  reales. Crear el proyecto de producción y repuntar Vercel es requisito **antes
  de la primera venta**, no antes de la épica B. Ver la épica J.
- **Nadie llama a `/api/cron/cleanup-holds` todavía.** El endpoint funciona,
  pero no hay programador. Se resuelve con `pg_cron` en Supabase cuando la
  épica F empiece a crear retenciones — el plan gratuito de Vercel solo permite
  una ejecución diaria, que para retenciones de 10 minutos no sirve.

---

# Épica B — Negocio y onboarding

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| B1 | Registro de negocio (email, contraseña, nombre, celular) | M | **Hecho** |
| B2 | Asistente de onboarding por pasos, salteable y retomable | M | Pendiente |
| B3 | Selección de slug público con validación de disponibilidad | M | **Hecho** |
| B4 | Perfil del negocio: dirección con mapa, categoría, fotos, zona horaria | M | **Hecho** |
| B5 | Plantillas de servicios precargadas por tipo de negocio | S | **Hecho** |

**B1 — Registro.** Dos pantallas, no una: `/registro` crea la cuenta y
`/bienvenida` crea el negocio. La razón es técnica: si Supabase exige confirmar
el correo, al registrarse todavía no hay sesión y `create_business()` necesita
`auth.uid()`. El nombre del negocio y el celular viajan en los metadatos del
usuario y prellenan `/bienvenida`, así que el dueño no escribe nada dos veces.
Funciona con la confirmación de correo encendida o apagada.

**B3 — Slug público.** En `/bienvenida` el link se sugiere desde el nombre
y se revisa en vivo 400 ms después de dejar de escribir. Si está tomado, se
ofrece una alternativa libre (`-2`, `-3`...) con un toque. La revisión es solo
ayuda: la garantía es el índice único al crear el negocio. **Cambiar el slug
después del alta queda fuera a propósito**: rompe los links que el negocio ya
compartió en Instagram y WhatsApp, y necesita redirección desde el slug viejo.

**B4 — Perfil del negocio.** La dirección con coordenadas, la categoría y las
fotos **no se usan en el MVP**: alimentan el directorio futuro. Se piden ahora
para no tener que perseguir a 200 negocios después. Ver
`adr/0004-white-label-antes-que-marketplace.md`.

Criterios:
- `timezone` se guarda por negocio, con `America/Bogota` por defecto.
- La dirección guarda latitud y longitud, no solo texto.
- El negocio puede terminar el onboarding sin fotos y agregarlas luego.

Implementado en `/panel/negocio`, solo para el dueño. El mapa es Leaflet con
OpenStreetMap (ver `04-stack-tecnologico.md`): se guarda la posición del pin,
que se puede ubicar tocando el mapa, buscando la dirección o con el GPS. Las
fotos se reducen en el navegador a 1600 px antes de subirse. **Pendiente
conocido:** una foto subida y quitada antes de guardar queda huérfana en
Storage; es poco peso y se limpia con un trabajo programado cuando haga falta.

Al revisar esta tarea apareció un hueco de seguridad y se cerró en la misma
migración: el dueño podía cambiarse `status` y `slug` por API. Ver
`07-modelo-de-datos.md`.

**B5 — Plantillas precargadas.** Al escoger "Barbería" se crean servicios
sugeridos (corte, barba, corte + barba, cejas...) con duración y precio de
referencia editables. Es una de las tareas con mejor retorno del backlog: ataca
directamente el abandono en el onboarding.

Cerrada el 2026-09-14 junto con C1: `create_business()` ya creaba los servicios
de la plantilla, y con C1 el dueño los edita, desactiva o agrega. Cambiar el
tipo de negocio después del alta **no** vuelve a crear plantillas: el dueño ya
tiene sus servicios y duplicarlos sería peor.

---

# Épica C — Servicios

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| C1 | CRUD de servicios: nombre, duración, precio, color, descripción | M | **Hecho** |
| C2 | Buffer antes y después del servicio | W | Fuera del MVP |
| C3 | Categorías de servicio y orden de presentación | S | Pendiente |

**C2 — Buffer. Fuera del MVP (decidido 2026-09-12).** Un tiempo de limpieza
aparte de la duración es un concepto más que el dueño tiene que entender y
configurar. Para el MVP, **la duración del servicio incluye todo el tiempo que
necesita**: un masaje de 60 minutos con 15 de preparación se configura de 75. El
formulario de servicios lo dice en pantalla.

Lo que queda y no se toca: las columnas `buffer_before_minutes` y
`buffer_after_minutes` siguen en la base en 0, y el motor de cupos las sigue
soportando (probado). Nadie las ve. Al hacer C1, las plantillas que traían
buffer suman ese tiempo a su duración (Tinte 120 → 135, Sesión pequeña de
tatuaje 120 → 150...).

**C1 — Servicios.** Cerrada el 2026-09-14. En `/panel/servicios`, solo el dueño:
lista con pestañas Activos y Desactivados, y un editor (a la derecha en
escritorio, pantalla propia en celular) con nombre, descripción, duración en
chips o "Otra", precio, color de la paleta y la vista previa de cómo lo ve el
cliente.

- **No se borra: se desactiva y se puede reactivar.** Desactivado sale de la
  página pública; las citas ya agendadas con ese servicio se mantienen.
- **Cambiar precio o duración no toca las citas existentes** (regla 4).
- La base repite los límites del formulario: nombre de 2 a 80 caracteres,
  descripción hasta 300, precio hasta $100.000.000 y color en hex
  (`20260914130001_servicios.sql`). La misma migración sumó los buffers de
  plantillas y servicios a su duración.
- Un servicio nuevo va al final de la lista y **no queda asignado a ningún
  trabajador**: eso es D2, y hasta entonces no se puede reservar.
- Quedó fuera a propósito: buscador (un negocio tiene de 5 a 20 servicios),
  reordenar (C3) y duplicar un servicio.

**Criterio que aplica a todo el backlog:** en cada tarea se construye la versión
más simple que cumpla el objetivo del negocio, y lo opcional se anota para
después en vez de construirse.

**Nota de implementación:** los servicios no se borran, se desactivan
(`is_active = false`). Un servicio borrado con citas históricas rompe la
contabilidad. Ver regla 5 de `CLAUDE.md`.

---

# Épica D — Trabajadores y horarios

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| D1 | CRUD de trabajadores: nombre, foto, teléfono, perfil | M | Pendiente |
| D2 | Qué servicios presta cada trabajador | M | Pendiente |
| D3 | Horario semanal por trabajador, con varios turnos por día | M | Pendiente |
| D4 | Bloqueos y ausencias (vacaciones, cita médica, almuerzo) | M | Pendiente |
| D5 | Invitación de trabajador por email para que acceda a su agenda | S | Pendiente |

**D3 — Horario semanal.** Tiene que soportar turno partido: lunes de 9:00 a
13:00 y de 15:00 a 19:00. Es lo normal en peluquerías, no una excepción.
Criterios:
- Varios intervalos por día de la semana.
- El horario del trabajador no puede exceder el horario de atención del local.
- Guardado como hora local del negocio + día de la semana; la conversión a UTC
  ocurre al generar cupos para una fecha concreta.

**D4 — Bloqueos.** Un rango de tiempo puntual donde el trabajador no atiende.
Criterios:
- Bloqueo de un rato, de un día completo o de varios días.
- Si hay citas dentro del bloqueo, se avisa y se listan antes de confirmar.
  **No se borran solas.**

---

# Épica E — Motor de agendamiento

**La épica crítica.** Especificación completa en `06-motor-de-agendamiento.md`.

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| E1 | Cálculo de intervalos libres (horario − citas − bloqueos) | M | **Hecho** |
| E2 | Generación de cupos con paso configurable y buffers | M | **Hecho** |
| E3 | Reglas: anticipación mínima, ventana máxima, granularidad | M | **Hecho** |
| E4 | Restricción anti-solapamiento en base de datos (`EXCLUDE`) | M | **Hecho** |
| E5 | Retención temporal del cupo mientras el cliente confirma | M | **Hecho** |

**E1 y E2 — Criterios de aceptación.** Con pruebas unitarias que cubran:
- **El caso del usuario:** corte de 60 min a las 12:00 y barba de 30 min a las
  13:00 → el motor ofrece las 13:30 para un servicio de 30 min. Este caso va
  escrito tal cual como prueba.
- Un servicio de 60 min **no** cabe en un hueco de 45 min y no se ofrece.
- Turno partido: no se ofrecen cupos dentro del almuerzo.
- Buffers respetados por ambos lados.
- Un día sin horario configurado no ofrece cupos (no revienta).
- El último cupo del día cabe completo antes del cierre.
- Cambio de horario de verano en otras zonas: el cálculo usa la zona del
  negocio, no la del servidor ni la del navegador.

**E4 — Anti-solapamiento.** Criterio: con dos peticiones simultáneas por el
mismo cupo, exactamente una queda confirmada y la otra recibe un error
específico de conflicto. Se prueba con peticiones concurrentes reales, no con
lógica en la aplicación.

---

# Épica F — Reserva pública

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| F1 | Página pública del negocio en `/[slug]` | M | Pendiente |
| F2 | Selección de servicio y de trabajador (con "el primero disponible") | M | Pendiente |
| F3 | Calendario de cupos disponibles | M | Pendiente |
| F4 | Identificación por celular con OTP de WhatsApp | M | Pendiente |
| F5 | Alta de cliente nuevo (solo nombre) y reconocimiento del que vuelve | M | Pendiente |
| F6 | Página de gestión de la cita: cancelar y reprogramar por link | M | Pendiente |

**F4 — OTP por WhatsApp.** Ver `09-notificaciones.md`. Criterios:
- Código de 6 dígitos, válido 10 minutos, máximo 5 intentos.
- Límite de envíos por número y por IP, para que nadie nos queme el saldo.
- Reenvío disponible a los 60 segundos.
- El número se normaliza a formato internacional (`+57...`) antes de guardarlo.

**F6 — Gestión por link.** Criterios:
- El link lleva un token aleatorio largo, no el ID de la cita.
- Muestra únicamente esa cita.
- Respeta las anticipaciones mínimas configuradas por el negocio.
- Al cancelar, el cupo queda inmediatamente disponible para otros.

**Nota de rendimiento:** `/[slug]` es la página que ven los clientes finales y
es la cara del producto. Tiene que cargar rápido en un celular de gama media con
red móvil. Se mide, no se supone.

---

# Épica G — Panel y calendario

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| G1 | Calendario día y semana, por trabajador y en columnas | M | Pendiente |
| G2 | Detalle de la cita y datos del cliente | M | Pendiente |
| G3 | Crear cita manual desde el panel | M | Pendiente |
| G4 | Reprogramar arrastrando, y cancelar | M | Pendiente |
| G5 | Cambios de estado: cumplida, no asistió, cancelada | M | Pendiente |
| G6 | PWA instalable (manifest, íconos, pantalla de carga) | M | Pendiente |

**G1 — Calendario.** Es la pantalla más usada del producto y la más difícil de
construir. Criterios:
- Vista de día con una columna por trabajador, y vista de semana.
- Se ve bien en celular: en pantalla angosta cae a un trabajador a la vez.
- Las citas se distinguen por color de servicio y muestran estado.
- Actualización en vivo: si un cliente reserva mientras el dueño mira la
  pantalla, la cita aparece sin recargar (Supabase Realtime).

**G5 — Estados.** Marcar **cumplida** dispara el asiento de ingreso de la épica
H. Debe ser idempotente: marcar dos veces no puede generar dos ingresos.

**G6 — PWA.** Criterios:
- Se puede instalar desde Chrome en Android y desde Safari en iOS.
- Abre en pantalla completa, sin barra de navegador.
- Muestra un aviso claro cuando no hay conexión, en vez de una pantalla en
  blanco.

---

# Épica H — Contabilidad

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| H1 | Ingreso automático al marcar una cita como cumplida | M | Pendiente |
| H2 | Ingresos y egresos manuales con categoría | M | Pendiente |
| H3 | Métodos de pago (efectivo, transferencia, Nequi, datáfono) | M | Pendiente |
| H4 | Corte de caja diario | M | Pendiente |
| H5 | Reporte de ingresos y egresos por período, exportable | S | Pendiente |

**H1 — Ingreso automático.** Criterios:
- Al marcar cumplida se crea un movimiento de ingreso con el precio **guardado
  en la cita**, no el precio actual del servicio.
- Queda ligado a la cita, al trabajador y al método de pago.
- Si la cita se revierte a otro estado, el movimiento se anula con un
  contra-asiento. **Nunca se borra**: la contabilidad se corrige sumando, no
  borrando.
- El dueño puede ajustar el valor cobrado (descuento, propina) antes de cerrar.

**H3 — Métodos de pago.** En Colombia el efectivo y Nequi dominan en este tipo
de negocio. El corte de caja tiene que separar efectivo de digital, porque el
efectivo es el que el dueño cuenta a mano al cerrar.

---

# Épica I — Notificaciones

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| I1 | Integración con WhatsApp Cloud API y registro de plantillas | M | Pendiente |
| I2 | Confirmación de cita al cliente | M | Pendiente |
| I3 | Recordatorios programados 24 h y 2 h antes | M | Pendiente |
| I4 | Aviso al dueño de cita nueva, cancelada o reprogramada | M | Pendiente |
| I5 | Registro de mensajes enviados, su estado y su costo | S | Pendiente |

**I3 — Recordatorios.** Es la función que justifica el precio del producto. Ver
`09-notificaciones.md`. Criterios:
- Trabajo programado que corre cada 15 minutos y envía lo que toca.
- **Nunca se envía dos veces el mismo recordatorio.** Se marca como enviado de
  forma atómica antes de enviar.
- Una cita cancelada no dispara recordatorio.
- Si el envío falla, se reintenta con espera creciente y se registra.
- Cada negocio puede activar o desactivar cada recordatorio.

**I5 — Registro y costo.** Sin esto no se sabe cuánto cuesta realmente cada
negocio al mes, y el margen de `01-modelo-de-negocio-y-precios.md` es un
supuesto y no un hecho.

---

# Épica J — Suscripciones

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| J1 | Interfaz propia de pagos con adaptador por pasarela | M | Pendiente |
| J2 | Adaptador de Mercado Pago Suscripciones | M | Pendiente |
| J3 | Prueba gratis de 14 días y estados de la suscripción | M | Pendiente |
| J4 | Webhooks de pago, con verificación de firma e idempotencia | M | Pendiente |
| J5 | Cobro manual (transferencia/Nequi) activado por super-admin | M | Pendiente |
| J6 | Mora, avisos, período de gracia y suspensión | M | Pendiente |

**J3 — Estados y página pública.** Ya resuelto en la base (2026-09-12): la
página pública está visible en `trialing`, `active` y `past_due`, y se apaga al
pasar a `suspended`. La regla vive en `estado_tiene_pagina_publica()`. Falta el
resto de J3: el trabajo que vence la prueba a los 14 días.

**J1 — Interfaz propia.** El código de la aplicación nunca llama a Mercado Pago
directamente. Habla con una interfaz propia (`crearSuscripcion`, `cancelar`,
`obtenerEstado`) y detrás hay un adaptador. Así, cambiar a Wompi o sumarlo es
escribir un adaptador, no reescribir la facturación. Ver
`adr/0002-pasarela-de-pagos.md`.

**J4 — Webhooks.** Criterios:
- Se verifica la firma de la petición. Un webhook sin firma válida se rechaza.
- Es idempotente: el mismo evento llegando tres veces produce un solo efecto.
- Todo evento se guarda crudo antes de procesarlo, para poder reprocesar.

**J5 — Cobro manual.** No es opcional. Una parte del mercado objetivo no tiene
tarjeta y paga por transferencia o Nequi. Sin este camino se pierden ventas ya
cerradas.

---

# Épica K — Reportes

| ID | Tarea | Pri | Estado |
|---|---|---|---|
| K1 | Panel de inicio: citas de hoy, ingresos del mes, ocupación | M | Pendiente |
| K2 | Ingresos por trabajador y por servicio | S | Pendiente |
| K3 | Ocupación por franja horaria y tasa de no-show | S | Pendiente |

**K3 — No-show.** Mostrarle al dueño cuánta plata perdió por clientes que no
llegaron, y cuánto bajó ese número desde que usa recordatorios. Es el reporte
que hace que renueve, porque le pone cifra al beneficio.

---

# Después del MVP

Detalle y justificación en `11-roadmap.md`.

**v1.1 — retención.** Comisiones por trabajador · lista de espera con aviso
automático · historial y notas del cliente · varios servicios en una sola cita ·
bloqueo de clientes con no-shows repetidos · solicitud de reseña en Google.

**v2 — expansión.** Abono para reservar · fotos antes y después · consentimiento
digital firmado · fidelización · campañas de reactivación · inventario · venta de
productos · multi-sede · recursos y cabinas reservables · sincronización con
Google Calendar · app nativa · encendido del directorio.
