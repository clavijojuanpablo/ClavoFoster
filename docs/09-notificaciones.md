# 09 — Notificaciones

> Los recordatorios automáticos son **la función que justifica el precio del
> producto**. Si evitan dos citas perdidas al mes, la mensualidad ya se pagó. Es
> el argumento de venta más fuerte que tenemos.

## Por qué WhatsApp y no SMS ni email

En Colombia el SMS se lee poco y cuesta caro. El email de una barbería termina
en promociones. WhatsApp es donde la gente de verdad conversa con los negocios.

Y la diferencia de costo es brutal:

| Canal | Costo aproximado por mensaje | Se lee |
|---|---|---|
| SMS | ~$0,05 USD | Poco |
| WhatsApp (utilidad) | ~$0,001 USD | Sí |
| WhatsApp (autenticación) | ~$0,0008 USD | Sí |
| Email | ~$0,0004 USD | Poco, en este público |

*Verificado en septiembre de 2026 contra la tabla de precios de Meta para
Colombia. **Las tarifas cambian: reverificar antes de comprometer márgenes.***

Un OTP por SMS cuesta unas 60 veces más que por WhatsApp. Con 100 negocios eso
deja de ser un detalle y se vuelve el margen del producto.

## Una sola línea para toda la plataforma

**Decisión: un único número de WhatsApp para todos los negocios**, con el nombre
del negocio dentro del mensaje.

> *Barbería Juan: te recordamos tu cita mañana jueves a las 2:30 p.m. con
> Andrés.*

La alternativa —un número propio por negocio— se ve más profesional, pero cada
número exige su propia verificación de negocio ante Meta, con documentos y
esperas. **Eso es exactamente la "instalación personalizada" que el modelo de
negocio prohíbe.** Con 100 negocios serían 100 procesos de verificación
manuales.

*Queda como posible función premium de v2*, para el negocio que quiera su propia
línea y esté dispuesto a pasar por el proceso.

## Las plantillas

Meta exige que todo mensaje que inicia una conversación sea una **plantilla
aprobada por ellos**. No se puede mandar texto libre.

| Plantilla | Categoría | Cuándo | Para quién |
|---|---|---|---|
| `auth_otp` | Autenticación | Al pedir el código de verificación | Cliente |
| `booking_confirmed` | Utilidad | Al confirmar la reserva | Cliente |
| `reminder_24h` | Utilidad | 24 h antes | Cliente |
| `reminder_2h` | Utilidad | 2 h antes | Cliente |
| `booking_cancelled` | Utilidad | Al cancelar | Cliente |
| `booking_rescheduled` | Utilidad | Al mover la cita | Cliente |
| `owner_new_booking` | Utilidad | Reserva nueva en línea | Dueño |
| `owner_cancelled` | Utilidad | Cancelación del cliente | Dueño |
| `trial_ending` | Utilidad | Días 11 y 13 de la prueba | Dueño |
| `payment_failed` | Utilidad | Falla el cobro | Dueño |
| `review_request` | Marketing | 2 h después de la cita cumplida | Cliente |
| `reactivation` | Marketing | v2 — campañas | Cliente |

**La categoría importa por el precio.** Las de marketing cuestan alrededor de
diez veces más que las de utilidad. `review_request` es la única de marketing en
el MVP, y por eso es la única que el negocio tiene apagada por defecto.

> **Operación, no programación:** las plantillas hay que registrarlas ante Meta y
> esperar aprobación. Puede tardar. **Hay que enviarlas a aprobación al empezar
> la épica I, no al terminarla** — quedarse esperando aprobación con todo el
> código listo es un bloqueo evitable.

## Cuándo se dispara cada cosa

### Al cliente

| Momento | Mensaje | Por qué |
|---|---|---|
| Al reservar | Confirmación con fecha, hora, dirección, trabajador y link para cancelar | Deja el comprobante en su chat, donde lo va a buscar |
| 24 h antes | Recordatorio con opción de cancelar | El que más reduce el no-show. A 24 h todavía hay tiempo de llenar el cupo |
| 2 h antes | Recordatorio corto | Atrapa al que se le olvidó el día |
| Al cancelar | Confirmación de la cancelación | Cierra el ciclo y evita que llegue igual |
| Al mover la cita | Nuevos datos | — |
| 2 h después de cumplida | Pedir reseña *(apagado por defecto)* | Marketing: cuesta más y no todos lo quieren |

**El de 24 horas es el importante.** El de 2 horas ayuda, pero a esa altura ya no
hay tiempo de vender el cupo a otro. El valor real está en enterarse temprano.

### Al dueño

Reserva nueva, cancelación y reprogramación. **Esto es lo que reemplaza a las
notificaciones push** de una app nativa, según la decisión de
`adr/0003-web-pwa-antes-que-app-nativa.md`.

Llega a donde el dueño ya vive todo el día y funciona igual en iPhone que en
Android, sin depender de que haya instalado la PWA ni de que le haya dado
permiso a las notificaciones del navegador.

**Con agrupación.** Una barbería con 30 reservas al día no quiere 30 mensajes.
Configurable:

- *Cada reserva* — para negocios de poco volumen.
- *Resumen diario* — un mensaje en la mañana con la agenda del día.
- *Solo cancelaciones* — lo más común en negocios con volumen: lo urgente es
  enterarse del hueco que se abrió.

## Cómo se envían los recordatorios

Trabajo programado que corre **cada 15 minutos** (`pg_cron` + Edge Function).

```
1. Buscar citas confirmadas cuya ventana de recordatorio cae en este ciclo
   y que no tengan ya un registro en notification_log para esa plantilla.
2. Insertar en notification_log con estado 'queued'.   ← reserva el envío
3. Enviar a la API de WhatsApp.
4. Actualizar el estado con la respuesta.
```

**El paso 2 va antes del 3, y no al revés.** El índice
`unique (appointment_id, template)` de `07-modelo-de-datos.md` hace que sea
imposible encolar dos veces el mismo recordatorio. Si el trabajo se cae a la
mitad y se repite, la base rechaza el duplicado.

Recibir dos recordatorios de la misma cita es de las cosas que más rápido hacen
que un negocio apague la función — y apagada, no hay producto.

Reglas:

- Una cita cancelada o ya cumplida **no** dispara recordatorio.
- Si la cita es dentro de menos de 24 h, el recordatorio de 24 h no se manda.
- Si el envío falla, se reintenta con espera creciente hasta tres veces, y
  después se marca `failed` con el motivo.
- Nada se envía entre las 9 p.m. y las 7 a.m., hora del negocio. Un recordatorio
  a medianoche molesta y no sirve.

## Costo real por negocio

Supuestos: barbería con 200 citas al mes.

| Concepto | Cantidad | Costo unitario | Total |
|---|---|---|---|
| OTP de verificación | 200 | $0,0008 | $0,16 |
| Confirmaciones | 200 | $0,001 | $0,20 |
| Recordatorios 24 h | 200 | $0,001 | $0,20 |
| Recordatorios 2 h | 200 | $0,001 | $0,20 |
| Cancelaciones y cambios | ~40 | $0,001 | $0,04 |
| Avisos al dueño | ~230 | $0,001 | $0,23 |
| **Total** | **~1.070** | | **≈ $1,03 USD** |

**Poco más de un dólar al mes por negocio**, unos $4.100 COP. Contra un plan de
$129.000 COP es menos del 4% del ingreso.

Por eso no se cobra aparte (`01-modelo-de-negocio-y-precios.md`): complicaría la
venta y asustaría al dueño para ahorrar centavos.

**Pero se vigila.** El campo `cost_usd` de `notification_log` (tarea I5) existe
justamente para que esto sea un dato medido y no un supuesto. Si un negocio se
dispara —mucho volumen, muchas campañas— hay que saberlo antes de que se coma el
margen.

## Consentimiento y salida

Meta exige que el destinatario haya aceptado recibir mensajes.

- **El consentimiento se obtiene al reservar.** El cliente escribe su número
  para agendar y se le indica con claridad que ahí recibirá la confirmación y
  los recordatorios. Queda registrado con fecha.
- **Salirse tiene que ser fácil.** Cualquiera puede responder para dejar de
  recibir mensajes, y eso se respeta por (cliente, negocio).
- Los mensajes de utilidad ligados a una cita que la persona misma agendó son de
  bajo riesgo. **Los de marketing son los que generan reportes de spam**, y un
  número muy reportado puede perder calidad ante Meta y terminar limitado. Por
  eso `review_request` viene apagada y las campañas de v2 necesitan reglas
  estrictas.

## Cuando WhatsApp falla

Todo pasa por una interfaz propia en `lib/notifications/`, igual que los pagos:

```ts
export interface NotificationChannel {
  send(input: {
    to: string;
    template: TemplateId;
    variables: Record<string, string>;
  }): Promise<{ providerRef: string; costUsd?: number }>;
}
```

Escala de respaldo:

1. **WhatsApp** — el canal principal.
2. **Email** (Resend) — si el cliente dejó email. Automático cuando WhatsApp
   falla.
3. **SMS** — solo para OTP, y solo tras dos intentos fallidos de WhatsApp. Es
   caro; es una red de seguridad, no un canal.

Riesgo de fondo: **dependemos de que Meta no cambie las reglas ni los precios.**
Ya lo ha hecho. La interfaz propia es lo que permite reaccionar sin reescribir
media aplicación, y está anotado como riesgo en `04-stack-tecnologico.md`.

## Email

Resend, para lo que WhatsApp no cubre bien:

- Recibos y facturas de la suscripción.
- Restablecer contraseña del dueño y del trabajador.
- Invitación de trabajador (tarea D5).
- Reportes mensuales al dueño (v1.1).

El email transaccional no reemplaza a WhatsApp en este público, pero es el
canal correcto para cualquier cosa que la persona vaya a necesitar buscar
después, como una factura.
