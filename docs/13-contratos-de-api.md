# 13 — Contratos de API

> Firma de cada operación, para que el trabajo se pueda repartir sin que las
> piezas dejen de encajar.

## Forma general

No hay una API REST pública. Se usan:

- **Server Actions** de Next.js para todo lo que dispara la interfaz.
- **Route Handlers** (`/api/...`) solo para lo que llega de afuera: webhooks y
  trabajos programados.

Toda operación devuelve el mismo tipo:

```ts
export type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: AppError };

export type AppError = {
  code: ErrorCode;        // para que la interfaz decida qué hacer
  message: string;        // en español, para mostrarle al usuario
  details?: unknown;      // errores de validación por campo
};
```

**Los errores esperados no se lanzan, se devuelven.** Que un cupo esté tomado no
es una excepción: es un resultado normal del negocio, y la interfaz tiene que
reaccionar con cupos frescos, no con una pantalla de error.

### Códigos de error

| Código | Cuándo | Qué hace la interfaz |
|---|---|---|
| `VALIDATION_ERROR` | Entrada inválida | Marca los campos en `details` |
| `UNAUTHENTICATED` | Sin sesión | Manda a iniciar sesión |
| `FORBIDDEN` | Sin permiso sobre ese negocio | Mensaje, sin reintentar |
| `NOT_FOUND` | No existe o no es visible | Pantalla de no encontrado |
| `SLOT_TAKEN` | Otro ganó el cupo | **Recarga cupos y resalta el más cercano** |
| `SLOT_INVALID` | El cupo ya no es válido | Igual que el anterior |
| `OTP_INVALID` | Código errado | Deja reintentar, muestra intentos restantes |
| `OTP_EXPIRED` | Código vencido | Ofrece reenviar |
| `RATE_LIMITED` | Demasiados intentos | Dice cuánto esperar |
| `SUBSCRIPTION_INACTIVE` | Negocio suspendido | En público: no disponible. En panel: cómo reactivar |
| `PLAN_LIMIT` | Se pasó del límite del plan | Ofrece subir de plan. **Nunca bloquea la agenda** |
| `CONFLICT` | Choque de estado | Recarga |
| `INTERNAL_ERROR` | Todo lo demás | Mensaje genérico + Sentry |

**Reglas que aplican a todas las operaciones:**

1. Toda entrada se valida con Zod antes de tocar nada.
2. **El `businessId` nunca se acepta del cliente.** Se deriva del slug verificado
   o de la sesión.
3. Precio y duración se re-resuelven en el servidor desde la base. Lo que mandó
   el navegador es una sugerencia, no un dato.

---

## Reserva pública

Sin sesión. En `app/(public)/[slug]/reservar/actions.ts` y `app/(public)/cita/[token]/actions.ts`; la lógica, en `lib/booking/`.

### `getBusinessBySlug` — **hecho**, como `getNegocioPublico` en `lib/tenant.ts`

```ts
function getBusinessBySlug(slug: string): Promise<Result<PublicBusiness>>;

type PublicBusiness = {
  id: string; slug: string; name: string;
  logoUrl: string | null; coverUrl: string | null; brandColor: string | null;
  address: string | null; phone: string | null; timezone: string;
  allowStaffChoice: boolean;
  services: PublicService[];
  staff: PublicStaff[];
};
```

Solo devuelve negocios con `is_published = true` y una suscripción en
`trialing`, `active` o `past_due` (función `estado_tiene_pagina_publica`). Un
negocio suspendido por mora da `NOT_FOUND` — no "suspendido", porque el estado de
pago del negocio no es asunto del cliente final.

### `cuposDisponibles` — **hecho** (F2 y F3)

**La operación más usada del producto.** En
`app/(public)/[slug]/reservar/actions.ts`.

```ts
function cuposDisponibles(input: {
  slug: string;
  serviceId: string;
  staffId: string;             // un uuid, o 'cualquiera' = el primero disponible
  desde: string;               // 'YYYY-MM-DD', hora local del negocio
}): Promise<{ ok: true; ventana: VentanaDeCupos } | { ok: false; error: string }>;

type VentanaDeCupos = {
  dias: { fecha: string; cupos: Cupo[] }[];
  siguienteDesde: string | null;   // null: se llegó al tope de max_advance_days
};

type Cupo = { inicio: string; staffId: string; staffNombre: string };
```

`inicio` es ISO 8601 en UTC. La conversión a hora local se hace al mostrar,
usando `timezone` del negocio.

**Solo entra el primer día, no el rango.** Cuántos días trae cada tanda lo decide
el servidor (`DIAS_POR_VENTANA`, catorce), así que nadie puede pedir un año de
una. El tope duro de la consulta son 31 días; pedir un año entero es lo que
convierte esta operación en el cuello de botella.

Con `staffId: 'cualquiera'` se combinan los cupos de todos los trabajadores
habilitados para ese servicio y, si dos coinciden en la misma hora, se devuelve
uno solo — el de menor carga ese día, para repartir el trabajo.

El cálculo está en `lib/booking/disponibilidad.ts`. Es el único punto del flujo
público que usa el cliente privilegiado de Supabase, porque horarios, bloqueos y
citas no son legibles para el anónimo y el cliente final no tiene sesión que RLS
pueda evaluar. Las dos barreras que quedan en su lugar: el `business_id` sale
del slug verificado, y hacia afuera solo salen horas libres.

### `pedirCodigo` y `confirmarCodigo` — **hechos** (F4)

```ts
function pedirCodigo(input: { slug: string; telefono: string }):
  Promise<{ ok: true; enmascarado: string; puedeReenviarEnSegundos: number } | { ok: false; error: string }>;

function confirmarCodigo(input: { slug: string; telefono: string; codigo: string }):
  Promise<{ ok: true; token: string; esClienteNuevo: boolean; nombre: string | null } | { ok: false; error: string }>;
```

`telefono` se normaliza a E.164 antes de cualquier cosa. `enmascarado` sale como
`+57 300 *** 4567`, lo justo para que el cliente reconozca su número.

`token` es un **token firmado, sin tabla**: vale para un negocio, un número y
veinte minutos, y es lo único que autoriza a crear la cita. `esClienteNuevo` le
dice a la interfaz si pedir el nombre — es el interruptor del flujo "solo el
celular" de `02-usuarios-y-flujos.md`.

Límites: 3 envíos por número por hora y 10 por conexión por hora, reenvío a los
60 segundos, código de 6 dígitos válido 10 minutos con 5 intentos. En
`otp_codes` se guarda el HMAC del código, nunca el código.

### `holdSlot` — **no existe, y es a propósito**

El diseño original apartaba el cupo con una cita `pending` a 10 minutos mientras
el cliente se identificaba. No se implementó porque `appointments.customer_id`
no admite nulos y al cliente solo se le conoce **después** del código: para
apartar habría que crear primero un cliente a medias.

Lo que protege contra la doble reserva no era la retención de todos modos, sino
la restricción `appointments_sin_solapamiento`. La cita se crea de una vez al
confirmar y Postgres deja pasar una sola; hay una prueba con dos peticiones
simultáneas por el mismo cupo. La ventana de exposición es lo que el cliente
tarde escribiendo su código, y la interfaz reacciona volviendo a pedir cupos.

Si esa ventana llega a costar cupos de verdad, el arreglo es volver
`customer_id` nulable y apartar antes. `expires_at` y `/api/cron/cleanup-holds`
ya están puestos para eso.

### `reservar` — **hecho** (F5)

```ts
function reservar(input: {
  slug: string; serviceId: string; staffId: string;
  inicio: string;                // ISO, UTC
  token: string;                 // el de confirmarCodigo
  nombre: string | null;         // obligatorio si es cliente nuevo
  nota: string | null;
}): Promise<{ ok: true; linkDeGestion: string } | { ok: false; error: string; cupoOcupado?: true }>;
```

Crea la cita en `confirmed`, crea el cliente si es nuevo y manda la confirmación
por WhatsApp con el link de gestión. **El teléfono sale del token, nunca del
formulario**: si viniera del navegador, cualquiera podría agendar a nombre de
otro. Precio y duración se copian de la base, incluido el número propio de esa
persona si lo tiene.

`cupoOcupado` es el `SLOT_TAKEN` de la tabla de errores: la interfaz recarga
cupos en vez de mostrar una pantalla de error.

### Gestión por token — **hecha** (F6)

```ts
function obtenerCitaPorToken(token: string): Promise<CitaDelCliente | null>;
function cancelarCita(input: { token: string }): Promise<{ ok: true } | { ok: false; error: string }>;
function moverCita(input: { token: string; inicio: string; staffId: string }):
  Promise<{ ok: true } | { ok: false; error: string; cupoOcupado?: true }>;
```

`token` es el `manage_token` aleatorio de la cita, nunca su `id`. Devuelve
**solo esa cita**. Respeta `cancel_notice_minutes` del negocio; fuera de plazo,
el mensaje trae el teléfono del negocio, que es lo que de verdad sirve a esa
altura.

**Mover no cancela y recrea.** Es la misma cita, con su mismo token y su mismo
precio: recrearla le cambiaría al cliente el link que ya tiene en su chat.
Reprogramar no pide código otra vez — el token del link ya prueba de quién es la
cita— y reusa la pantalla de reserva con `?mover=<token>`.

---

## Panel

Con sesión. El `businessId` sale de la sesión y se re-verifica la membresía en
**cada** llamada.

### Citas

```ts
function listAppointments(input: {
  from: string; to: string;        // ISO, UTC
  staffIds?: string[];
  statuses?: AppointmentStatus[];
}): Promise<Result<{ appointments: AdminAppointment[] }>>;

function createAppointment(input: {
  serviceId: string; staffId: string; startAt: string;
  customerId?: string;                              // existente
  newCustomer?: { phone: string; name: string };    // o nuevo
  internalNote?: string;
  source?: 'manual' | 'walk_in';
}): Promise<Result<AdminAppointment>>;

function rescheduleAppointment(input: {
  appointmentId: string; startAt: string; staffId?: string; notifyCustomer?: boolean;
}): Promise<Result<AdminAppointment>>;

function setAppointmentStatus(input: {
  appointmentId: string;
  status: 'completed' | 'no_show' | 'cancelled';
  paymentMethod?: PaymentMethod;   // requerido si 'completed'
  amountCop?: number;              // si difiere del precio guardado
  notifyCustomer?: boolean;
}): Promise<Result<AdminAppointment>>;
```

**`createAppointment` desde el panel puede saltarse la anticipación mínima**,
pero **no** la restricción de solapamiento: el dueño puede agendar para dentro de
5 minutos, pero no puede poner a un barbero en dos lugares al tiempo.

Implementada en G3 en `app/(admin)/panel/agenda/actions.ts`, con la forma de
unión simple del resto del módulo en vez de `Result<T>`:

```ts
// La hora llega como reloj local ('YYYY-MM-DD' + 'HH:MM') y se vuelve UTC en el
// servidor con businesses.timezone. El cliente se identifica por celular: si ya
// existe en el negocio se reusa, si no se crea con `nombre`.
function crearCitaDesdePanel(input: {
  serviceId: string; staffId: string; fecha: string; hora: string;
  telefono: string; nombre: string; nota: string;
  origen: 'manual' | 'walk_in';
}): Promise<{ ok: true } | { ok: false; error: string; campos: Record<string, string>; cupoOcupado?: true }>;

// Horas libres del motor para un día, como sugerencia. No limitan la hora.
function cuposParaNuevaCita(input: { serviceId: string; staffId: string; fecha: string }):
  Promise<{ ok: true; cupos: { reloj: string; etiqueta: string }[] } | { ok: false; error: string }>;

// El cliente de ESTE negocio con ese celular, o null.
function buscarClienteParaCita(input: { telefono: string }):
  Promise<{ ok: true; cliente: ClienteConocido | null; telefono: string } | { ok: false; error: string }>;
```

En la práctica la cita manual se salta las reglas de **tiempo** de la reserva:
anticipación, ventana, horario de la persona, bloqueos y ausencias (incluido el
cierre del local) y hora pasada. Sí exige que el servicio esté activo y que la
persona, activa, lo preste. Aparte de eso, solo la frena el solapamiento con otra
cita `pending` o `confirmed` de la misma persona, buffers incluidos. Es a
propósito: el dueño que atiende a su primo el domingo cerrado sabe lo que hace.
Las horas sugeridas sí respetan horario, bloqueos y citas activas, y descartan
las que ya pasaron. No aplican la anticipación mínima, y la ventana se estira a
366 días.

Con `origen: 'manual'` y una hora futura se manda `booking_confirmed` con el link
de gestión; con `walk_in` o con una hora que ya pasó, no. El trabajador solo
puede agendar con su propio `staffId`.

**`setAppointmentStatus` con `completed` es la operación que alimenta la
contabilidad.** Crea el movimiento de ingreso y es **idempotente**: el índice
único sobre `appointment_id` en `ledger_entries` garantiza que un doble clic no
genere dos ingresos. Si se revierte a otro estado, se crea un contra-asiento;
nunca se borra el original.

### Servicios, trabajadores y horarios

```ts
// Implementadas en app/(admin)/panel/servicios/actions.ts (C1), con useActionState:
// reciben el FormData del formulario y, si todo sale bien, redirigen a la lista.
function guardarServicio(anterior: EstadoServicio, form: FormData): Promise<EstadoServicio>;
function cambiarEstadoServicio(anterior: EstadoServicio, form: FormData): Promise<EstadoServicio>;

// Implementadas en app/(admin)/panel/equipo/actions.ts (D1 y D2). Un solo
// formulario guarda la persona y los servicios que presta.
function guardarTrabajador(anterior: EstadoTrabajador, form: FormData): Promise<EstadoTrabajador>;
function cambiarEstadoTrabajador(anterior: EstadoTrabajador, form: FormData): Promise<EstadoTrabajador>;

// Implementada en app/(admin)/panel/equipo/actions.ts (D3), sobre la función
// guardar_horario() de la base. El FormData trae staffId y turnos como JSON:
// [{ weekday, desde: 'HH:MM', hasta: 'HH:MM' }].
function guardarHorario(anterior: EstadoHorario, form: FormData): Promise<EstadoHorario>;
// EstadoHorario.citasFuera: las citas agendadas que quedaron por fuera.

// Implementadas en app/(admin)/panel/equipo/ausencias/actions.ts (D4). El
// FormData trae quien ('local' o id), tipo ('horas' | 'dias') y las fechas y
// horas locales; el servidor las convierte a UTC con la zona del negocio.
function crearBloqueo(anterior: EstadoBloqueo, form: FormData): Promise<EstadoBloqueo>;
// EstadoBloqueo.porConfirmar: { firma, citas } si hay citas en el rango. Se
// guarda cuando el FormData trae confirmado = firma.
function quitarBloqueo(form: FormData): Promise<void>;
```

`guardarHorario` **reemplaza** todo el horario del trabajador, no lo parchea.
Varias filas por día de la semana permiten turno partido. Las citas que quedan
por fuera del horario nuevo **no se cancelan**: se devuelven en `citasFuera`.

`crearBloqueo` muestra las citas que quedan dentro del bloqueo **antes de
guardar y sin cancelarlas**. La interfaz las muestra y el dueño decide qué hacer con cada una.
Cancelarle citas a alguien automáticamente es exactamente lo que no se debe
hacer.

`guardarServicio` crea si el `id` llega vacío y edita si no. El negocio sale
de la sesión; el `id` del servicio se cruza con ese negocio y RLS lo vuelve a
exigir. `cambiarEstadoServicio` desactiva o reactiva, nunca borra (regla 5 de
`CLAUDE.md`). Los errores vuelven como `{ error, campos }` para pintarlos en el
formulario.

### Contabilidad

```ts
function listLedger(input: {
  from: string; to: string;          // fechas, no instantes
  direction?: LedgerDirection; categoryId?: string; staffId?: string;
}): Promise<Result<{ entries: LedgerEntry[]; totals: { incomeCop: number; expenseCop: number; netCop: number } }>>;

function createLedgerEntry(input: {
  direction: LedgerDirection; amountCop: number; occurredOn: string;
  categoryId?: string; paymentMethod: PaymentMethod; description?: string; staffId?: string;
}): Promise<Result<LedgerEntry>>;

function reverseLedgerEntry(entryId: string): Promise<Result<LedgerEntry>>;

function getDailyClose(date: string): Promise<Result<{
  incomeCop: number; expenseCop: number; netCop: number;
  byPaymentMethod: Record<PaymentMethod, number>;
  byStaff: { staffId: string; staffName: string; incomeCop: number; appointments: number }[];
  appointmentsCompleted: number; appointmentsNoShow: number;
}>>;
```

`getDailyClose` separa efectivo de digital porque el efectivo es lo que el dueño
cuenta a mano al cerrar.

**Toda esta sección exige rol `owner`.** El trabajador recibe `FORBIDDEN`.

### Suscripción

```ts
function getSubscription(): Promise<Result<SubscriptionState>>;
function startCheckout(input: { plan: PlanId; billingPeriod: 'monthly'|'annual' }):
  Promise<Result<{ checkoutUrl: string }>>;
function cancelSubscription(input: { reason: string }):
  Promise<Result<{ activeUntil: string }>>;
```

`cancelSubscription` exige motivo. Es la información más valiosa del negocio y
solo se consigue en ese momento exacto.

---

## Route Handlers

### `POST /api/webhooks/mercadopago`

Sin autenticación de usuario; se autentica por firma.

```
1. Verificar la firma        → 401 si no
2. Guardar crudo en subscription_events
3. Si (provider, event_id) ya existía → 200 y salir
4. Procesar
5. 200
```

Responde `200` incluso si el evento ya se había procesado: la pasarela solo
necesita saber que llegó. Detalle en `08-pagos-y-suscripciones.md`.

### `POST /api/webhooks/whatsapp`

Estados de entrega y respuestas entrantes. Actualiza `notification_log` y procesa
bajas de consentimiento.

### `POST /api/cron/reminders` · `/api/cron/cleanup-holds` · `/api/cron/billing`

Protegidos por `CRON_SECRET` en cabecera. Cada 15 minutos, cada 5 minutos y una
vez al día, respectivamente.

**Todos tienen que ser idempotentes.** Los trabajos programados se repiten: si
el ciclo se cae a la mitad y vuelve a correr, no puede mandar el recordatorio dos
veces ni cobrar dos veces. Las garantías están en la base de datos
(`07-modelo-de-datos.md`), no en la lógica.

---

## Tipos compartidos

Viven en `lib/types/`. Los de la base de datos se **generan**, no se escriben:

```bash
npx supabase gen types typescript --local > lib/types/database.ts
```

Se commitean, y se regeneran en el mismo pull request que cambia una migración.
Escribirlos a mano garantiza que tarde o temprano mientan.
