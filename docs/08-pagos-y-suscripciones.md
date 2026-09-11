# 08 — Pagos y suscripciones

> Cómo el negocio nos paga a nosotros. El cobro del cliente final al negocio
> (abonos, pago en línea del servicio) **no es parte del MVP** — está en
> `11-roadmap.md`.

## El problema, en concreto

Hay que cobrarle cada mes, automáticamente, a negocios pequeños colombianos.
Muchos de ellos **no tienen tarjeta de crédito internacional**. Varios operan
casi todo por Nequi y transferencia. Cualquier solución que asuma "tarjeta de
crédito" como única vía deja ventas cerradas en la calle.

## Las opciones, evaluadas

Verificado en septiembre de 2026.

| Opción | Recurrencia | Medios en Colombia | Problema |
|---|---|---|---|
| **Stripe Billing** | Excelente, la mejor del mercado | — | **Stripe no opera en Colombia.** Requiere constituir sociedad en EE.UU. y los negocios tendrían que pagar con tarjeta internacional en dólares. Descartado |
| **Mercado Pago Suscripciones** ✅ | Motor de recurrencia propio (*preapproval*) | Tarjeta, PSE, efectivo | Menos control fino sobre reintentos |
| **Wompi (Bancolombia)** | Tokeniza la tarjeta; la recurrencia la programas tú | Tarjeta, PSE, Nequi, efectivo | Hay que construir y mantener el motor de cobro recurrente |
| **ePayco** | Tiene recurrencia | Amplios | Experiencia de integración menos pulida |
| **Treli** | Capa de suscripciones sobre otras pasarelas | Los de la pasarela | Un intermediario más y su margen; precio bajo cotización |

**Decisión: Mercado Pago Suscripciones como proveedor principal, detrás de una
interfaz propia.**

Las razones, en orden:

1. **El motor de recurrencia ya está hecho.** Los reintentos, el ciclo de
   facturación y el estado de la suscripción los maneja el proveedor. Con Wompi
   tendríamos que escribirlo y, sobre todo, mantenerlo — y un error ahí es
   cobrar de más o no cobrar.
2. **Soporta PSE y efectivo**, no solo tarjeta.
3. Marca reconocida, lo que baja la desconfianza al poner datos de pago.

**Wompi queda como segundo proveedor**, no descartado. Es de Bancolombia, muchos
negocios ya lo conocen, y su tarifa base publicada es **2,65% + $700 + IVA por
transacción exitosa**. Si la conversión con Mercado Pago decepciona, se escribe
un adaptador y se prueba — sin tocar la facturación.

Ver `adr/0002-pasarela-de-pagos.md`.

> **Por verificar antes de integrar:** las tarifas exactas del plan que nos
> corresponda en cada pasarela, y si hay condiciones distintas para cobros
> recurrentes. Las cifras de acá tienen fecha y las tarifas cambian.

## La interfaz propia (tarea J1)

**El código de la aplicación nunca llama a Mercado Pago.** Habla con esto:

```ts
// lib/billing/types.ts
export interface BillingProvider {
  readonly name: 'mercadopago' | 'wompi' | 'manual';

  createSubscription(input: {
    businessId: string;
    plan: PlanId;
    amountCop: number;
    customerEmail: string;
    returnUrl: string;
  }): Promise<{ checkoutUrl: string; providerRef: string }>;

  cancelSubscription(providerRef: string): Promise<void>;
  getSubscription(providerRef: string): Promise<ProviderSubscriptionState>;

  verifyWebhook(req: Request): Promise<VerifiedEvent | null>;
}
```

Cambiar de pasarela, o sumar una segunda, es escribir un adaptador. No es
sobre-ingeniería: depender de un solo proveedor de pagos en un mercado donde las
tarifas y las reglas cambian es un riesgo real del negocio, y el costo de esta
abstracción son unas pocas horas.

**El estado de la verdad vive en nuestra base** (`subscriptions`), no en la
pasarela. La pasarela cobra; nosotros decidimos qué negocio está activo. Eso
permite activar a alguien a mano y que el resto del sistema funcione igual.

## Estados de la suscripción

```
                  ┌──────────┐
   registro ─────►│ trialing │  14 días, sin tarjeta
                  └────┬─────┘
                       │ paga
                       ▼
                  ┌──────────┐
              ┌──►│  active  │◄──┐
              │   └────┬─────┘   │ pago exitoso
   pago ok    │        │ falla   │
              │        ▼         │
              │   ┌──────────┐   │
              └───┤ past_due ├───┘   7 días de gracia
                  └────┬─────┘
                       │ vence la gracia
                       ▼
                  ┌───────────┐
                  │ suspended │  la página pública se apaga
                  └─────┬─────┘
                        │ 60 días sin pagar
                        ▼
                  ┌───────────┐
                  │ cancelled │  datos conservados 6 meses más
                  └───────────┘
```

El mismo `status` vive en `businesses` y gobierna la política de RLS que publica
la página de reservas. **Suspender es cambiar un campo**, no desplegar nada
(`05-arquitectura-multitenant.md`).

## La prueba gratis

**14 días, sin pedir tarjeta.**

Pedir tarjeta por adelantado sube la calidad de los registros y baja muchísimo el
volumen. En un mercado donde buena parte de los dueños no tiene tarjeta de
crédito, no es un filtro de calidad: es un muro. Y el canal de venta es visita
presencial, no publicidad masiva, así que el registro basura no es el problema.

Qué pasa durante la prueba: **todo funciona**, sin límites artificiales. Un
negocio que no puede probar los recordatorios de WhatsApp no puede evaluar lo
que más valor le da.

Avisos: día 11 y día 13 por WhatsApp y email. Al vencer sin pago, pasa a
`suspended` — no a `cancelled`. Los datos se conservan y basta pagar para
reactivar.

## Mora

Cuando falla un cobro de un negocio que ya venía pagando, **la premisa es que
casi siempre es la tarjeta, no la intención**. Vencida, sin cupo, bloqueada por
el banco.

| Día | Qué pasa |
|---|---|
| 0 | Falla el cobro → `past_due`. WhatsApp: *"no pudimos procesar tu pago"*, con link para actualizar el medio |
| 1 | Reintento automático |
| 3 | Reintento + recordatorio por WhatsApp |
| 5 | Reintento + email. Aviso en el panel |
| 7 | Vence la gracia → `suspended`. Aviso claro de qué se apagó y cómo reactivar |
| 7–60 | Suspendido. **El dueño sigue viendo y exportando sus datos** |
| 60 | `cancelled`. Los datos se conservan 6 meses más |

**Qué se apaga al suspender, y qué no.** Se apaga la página pública: nadie puede
reservar. **No se apaga** el acceso del dueño a su agenda, su historia ni su
contabilidad.

Quitarle a un negocio el acceso a su propia información para presionarlo es la
forma más rápida de convertir una cancelación en alguien que habla mal de
nosotros en su barrio. Con el canal de venta que tenemos —boca a boca de barrio—
eso cuesta más que la mensualidad que se está cobrando.

## Cobro manual (tarea J5)

**No es un caso excepcional, es un camino de primera clase.**

Una parte del mercado objetivo va a pagar por transferencia o Nequi. Si eso
obliga a un proceso improvisado por fuera del sistema, el estado de esos
negocios se vuelve inconsistente y se cobra mal.

Cómo funciona:

1. El negocio escoge "pagar por transferencia" y ve los datos de la cuenta con
   una referencia única.
2. Paga y sube el comprobante, o lo manda por WhatsApp.
3. El super-admin confirma desde el panel interno.
4. La suscripción se marca `provider = 'manual'` y se extiende
   `current_period_end` un mes.
5. Un recordatorio automático sale 5 días antes del vencimiento, porque acá no
   hay cobro automático que lo cubra.

Es trabajo manual y no escala más allá de unas decenas de negocios. **A
propósito:** a esa escala es preferible atender a mano a perder la venta, y para
entonces ya habrá datos para decidir si vale la pena automatizarlo.

## Webhooks (tarea J4)

Tres reglas, las tres obligatorias:

**1. Verificar la firma.** Un webhook sin firma válida se rechaza con 401. Sin
esto, cualquiera puede activarle la suscripción a quien quiera con una petición
HTTP.

**2. Guardar crudo antes de procesar.** El evento entra a
`subscription_events` con su `payload` completo y recién ahí se procesa. Si el
procesamiento falla, el evento no se perdió: se reprocesa.

**3. Ser idempotente.** `unique (provider, event_id)` en la base. Las pasarelas
reenvían eventos cuando no reciben respuesta a tiempo; sin esto, un reenvío
puede cobrar o activar dos veces.

```ts
export async function POST(req: Request) {
  const event = await provider.verifyWebhook(req);
  if (!event) return new Response('firma inválida', { status: 401 });

  const { inserted } = await storeEventIdempotent(event);
  if (!inserted) return new Response('ok', { status: 200 }); // ya procesado

  await processSubscriptionEvent(event);
  return new Response('ok', { status: 200 });
}
```

Responder `200` rápido y procesar lo pesado aparte: si la pasarela no recibe
respuesta pronto, reintenta y multiplica los eventos.

## Cambios de plan

- **Subir de plan:** inmediato, cobrando la diferencia prorrateada. Nunca se
  bloquea la operación por estar por encima del límite de trabajadores: se avisa
  y se ofrece subir. Bloquearle la agenda a alguien un sábado a mediodía es
  perderlo.
- **Bajar de plan:** al final del período en curso, sin reembolso. Si queda por
  encima del límite del plan nuevo, se le pide desactivar trabajadores antes.
- **Cancelar:** sigue activo hasta terminar el período pagado. Se pregunta el
  motivo — es la información más valiosa del negocio y solo se consigue en ese
  momento.

## Facturación

La suscripción está gravada con IVA (19%) y los precios de lista se muestran con
IVA incluido (`01-modelo-de-negocio-y-precios.md`).

> **Requisito de lanzamiento, no posterior.** Antes de la primera venta hay que
> confirmar con un contador: régimen aplicable, obligación de facturación
> electrónica ante la DIAN, y si se puede delegar en la pasarela o hay que
> integrar un proveedor de facturación electrónica. Facturar mal desde el
> negocio número uno es muy caro de corregir después.

## Seguridad

- **Nunca se guardan datos de tarjeta.** Ni tokenizados, ni "solo los últimos
  cuatro dígitos con el resto cifrado". La tarjeta la maneja la pasarela; acá
  solo vive una referencia opaca.
- Las claves de la pasarela viven solo en el servidor. Jamás en código del
  navegador ni en variables con prefijo `NEXT_PUBLIC_`.
- Toda acción de cobro queda registrada con quién la hizo y cuándo.
- El panel de super-admin ve estados de suscripción, **nunca** datos de clientes
  finales de los negocios (`02-usuarios-y-flujos.md`).
