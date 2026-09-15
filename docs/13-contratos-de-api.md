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

Sin sesión. En `app/(public)/[slug]/actions.ts`.

### `getBusinessBySlug`

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

### `getAvailability`

**La operación más usada del producto.**

```ts
function getAvailability(input: {
  slug: string;
  serviceId: string;
  staffId: string | null;      // null = cualquiera disponible
  fromDate: string;            // 'YYYY-MM-DD', hora local del negocio
  toDate: string;              // máximo 31 días de rango
}): Promise<Result<{ days: AvailableDay[] }>>;

type AvailableDay = {
  date: string;                // 'YYYY-MM-DD'
  slots: { startAt: string; staffId: string; staffName: string }[];
};
```

`startAt` es ISO 8601 en UTC. La conversión a hora local se hace al mostrar,
usando `timezone` del negocio.

Con `staffId: null` se combinan los cupos de todos los trabajadores habilitados
para ese servicio y, si dos coinciden en la misma hora, se devuelve uno solo —
el de menor carga ese día, para repartir el trabajo.

Rango máximo de 31 días por llamada: pedir un año entero es lo que convierte
esta operación en el cuello de botella.

### `requestOtp` y `verifyOtp`

```ts
function requestOtp(input: { slug: string; phone: string }):
  Promise<Result<{ sentTo: string; expiresInSeconds: number; canResendInSeconds: number }>>;

function verifyOtp(input: { slug: string; phone: string; code: string }):
  Promise<Result<{ token: string; isNewCustomer: boolean; customerName: string | null }>>;
```

`phone` se normaliza a E.164 antes de cualquier cosa. `sentTo` viene enmascarado
(`+57 300 *** 4567`).

`token` es de corta vida y sirve solo para completar esta reserva.
`isNewCustomer` le dice a la interfaz si pedir el nombre — es el interruptor del
flujo "solo el celular" de `02-usuarios-y-flujos.md`.

Límite: 3 envíos por número por hora y 10 por IP por hora → `RATE_LIMITED`. Sin
esto, cualquiera puede quemarnos el saldo de WhatsApp.

### `holdSlot`

```ts
function holdSlot(input: {
  slug: string; serviceId: string; staffId: string; startAt: string;
}): Promise<Result<{ appointmentId: string; expiresAt: string }>>;
```

Crea la cita en estado `pending` con vencimiento a 10 minutos. La retención del
cupo **es** la cita pendiente, gracias a la restricción `no_overlap`
(`06-motor-de-agendamiento.md`).

Devuelve `SLOT_TAKEN` si otro llegó primero.

### `confirmBooking`

```ts
function confirmBooking(input: {
  appointmentId: string;
  token: string;                 // de verifyOtp
  customerName?: string;         // obligatorio si isNewCustomer
  customerNote?: string;
}): Promise<Result<{ appointment: PublicAppointment; manageUrl: string }>>;
```

Pasa la cita a `confirmed`, crea el cliente si es nuevo y encola la confirmación
por WhatsApp. Idempotente: llamarla dos veces con el mismo `appointmentId` no
crea dos citas ni manda dos mensajes.

### `getAppointmentByToken`, `cancelByToken`, `rescheduleByToken`

```ts
function getAppointmentByToken(token: string): Promise<Result<PublicAppointment>>;
function cancelByToken(token: string): Promise<Result<{ cancelled: true }>>;
function rescheduleByToken(input: { token: string; newStartAt: string }):
  Promise<Result<PublicAppointment>>;
```

`token` es el `manage_token` aleatorio de la cita, nunca su `id`. Devuelve
**solo esa cita**. Respeta `cancel_notice_minutes` del negocio; fuera de plazo,
`FORBIDDEN` con el teléfono del negocio en el mensaje.

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
