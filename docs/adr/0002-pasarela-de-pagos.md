# ADR 0002 — Mercado Pago detrás de una interfaz propia

- **Fecha:** 2026-09-11
- **Estado:** Aceptada

## Contexto

Hay que cobrarle una suscripción mensual automática a negocios pequeños
colombianos. Dos restricciones del mercado mandan sobre todo lo demás:

1. **Stripe no opera en Colombia** (verificado en septiembre de 2026). Usarlo
   exigiría constituir una sociedad en Estados Unidos y que los negocios pagaran
   en dólares con tarjeta internacional.
2. **Muchos negocios objetivo no tienen tarjeta de crédito.** Operan con Nequi,
   PSE, transferencia y efectivo.

## Decisión

**Mercado Pago Suscripciones (*preapproval*) como proveedor principal, detrás de
una interfaz propia (`BillingProvider`).**

**Y un camino de cobro manual de primera clase**, por transferencia o Nequi,
activado por el super-admin.

## Alternativas consideradas

**Stripe Billing vía sociedad en EE.UU.** El mejor producto de facturación
recurrente que existe. Descartado: no resuelve el medio de pago local, que es el
problema real. Un negocio que no tiene tarjeta internacional no puede pagar, por
muy bueno que sea el sistema de facturación.

**Wompi (Bancolombia).** Marca muy conocida en Colombia y buena cobertura local
—incluido Nequi—. Tarifa base publicada: 2,65% + $700 + IVA por transacción
exitosa. Se descartó como principal porque **tokeniza la tarjeta pero deja la
recurrencia en nuestras manos**: habría que construir y mantener el motor de
cobro periódico y sus reintentos, y un error ahí es cobrar de más o no cobrar.
**Queda como segundo proveedor**, no descartado.

**ePayco.** Tiene recurrencia y buena cobertura; experiencia de integración menos
pulida.

**Treli.** Capa de suscripciones sobre otras pasarelas. Resuelve bien el
problema, pero suma un intermediario y su margen, con precio bajo cotización.
Se puede reconsiderar si construir la gestión de suscripciones resulta más
costoso de lo previsto.

## Consecuencias

**A favor**

- El motor de recurrencia, los reintentos y el ciclo de facturación los mantiene
  el proveedor.
- Soporta tarjeta, PSE y efectivo.
- Cambiar de pasarela o sumar una segunda es escribir un adaptador, no reescribir
  la facturación.
- El estado de la verdad vive en nuestra base (`subscriptions`), no en la
  pasarela. Eso permite activar a alguien a mano sin que nada más se entere.

**En contra**

- Menos control fino sobre los reintentos que con un motor propio.
- La interfaz propia es trabajo extra que hoy no da beneficio visible.
- El cobro manual **no escala**: es trabajo humano por cada pago.

**Sobre el cobro manual:** que no escale es aceptado a propósito. A la escala de
las primeras decenas de negocios, atender un pago a mano es preferible a perder
una venta ya cerrada. Cuando duela, habrá datos para decidir cómo automatizarlo.

## Cuándo revisar esta decisión

- Si la conversión de pago con Mercado Pago resulta mala → probar Wompi con un
  adaptador y comparar con datos reales.
- Si Stripe abre operaciones en Colombia.
- Si el cobro manual supera un volumen que consuma demasiado tiempo.
- **Antes de integrar:** reverificar las tarifas vigentes de cada pasarela. Las
  cifras de este documento tienen fecha.

## Referencias

`08-pagos-y-suscripciones.md` · `01-modelo-de-negocio-y-precios.md`
