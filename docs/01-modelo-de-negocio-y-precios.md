# 01 — Modelo de negocio y precios

> **Tasa de referencia usada en todo este documento: 1 USD = 4.000 COP.**
> Verificar al momento de fijar precios reales. Los costos de infraestructura se
> pagan en dólares y los ingresos entran en pesos: una devaluación fuerte
> comprime el margen sin que nadie lo note hasta que ya pasó.

## Cómo se gana plata

Suscripción mensual que paga el **negocio**. El cliente final nunca paga por
usar la plataforma — si tuviera que pagar, no reservaría, y sin reservas el
producto no le sirve al negocio.

Se cobra **por negocio con un límite de trabajadores**, no por trabajador
individual. Cobrar por trabajador castiga exactamente lo que queremos que pase:
que el negocio crezca y meta a todo el mundo al sistema. Un dueño que deja a dos
barberos por fuera para no pagar más tiene la agenda incompleta, y una agenda
incompleta no sirve para nada.

## Planes propuestos

| | **Esencial** | **Profesional** | **Estudio** |
|---|---|---|---|
| **Precio mensual** | $69.000 COP | $129.000 COP | $229.000 COP |
| **Precio anual** (2 meses gratis) | $690.000 | $1.290.000 | $2.290.000 |
| Trabajadores | Hasta 2 | Hasta 6 | Ilimitados |
| Sedes | 1 | 1 | Varias |
| Citas al mes | Ilimitadas | Ilimitadas | Ilimitadas |
| Página pública de reservas | Sí | Sí | Sí |
| Recordatorios por WhatsApp | Sí | Sí | Sí |
| Contabilidad y caja | Sí | Sí | Sí |
| Comisiones por trabajador | — | Sí | Sí |
| Reportes avanzados | — | Sí | Sí |
| Campañas de reactivación | — | — | Sí |
| Soporte | WhatsApp | WhatsApp prioritario | WhatsApp prioritario |

**Las citas nunca se limitan.** Un plan que corta las reservas al llegar a cierto
número le rompe la operación al negocio justo el día que más está trabajando, y
lo empuja de vuelta al cuaderno. El límite es por trabajadores, que es lo que
el negocio entiende y puede prever.

**Prueba gratis de 14 días, sin tarjeta.** Pedir tarjeta por adelantado en un
mercado donde muchos dueños no tienen tarjeta de crédito mata la conversión.
Ver `08-pagos-y-suscripciones.md`.

> **Por validar antes de publicar estos precios:** qué cobran Agendapro y Booksy
> en Colombia hoy. El plan Profesional debería quedar claramente por debajo del
> competidor regional más cercano, porque en la primera venta no tenemos marca
> que respalde un precio mayor.

## Margen por negocio

Cálculo sobre el plan Profesional a $129.000 COP:

| Concepto | Mensual (COP) | De dónde sale |
|---|---|---|
| Ingreso | $129.000 | Precio de lista |
| Comisión de pasarela | −$4.900 | 2,65% + $700 + IVA sobre la comisión |
| Infraestructura marginal | −$8.000 | ≈ $2 USD por negocio, ver `10-costos` |
| WhatsApp | *incluido arriba* | ≈ 400 mensajes de utilidad al mes |
| **Margen bruto** | **$116.100** | **90%** |

Para el plan Esencial a $69.000 el margen bruto queda alrededor del 82%, que
sigue siendo sano. Ese plan existe menos por su margen y más por bajar la
barrera de entrada: un negocio de un solo barbero que entra hoy es un negocio de
cuatro barberos dentro de dos años.

**El margen bruto no es la ganancia.** Falta restar soporte, ventas y tu propio
tiempo. Con 100 negocios en Profesional el ingreso mensual recurrente es de
unos $12.900.000 COP y la infraestructura cuesta alrededor de $1.200.000 COP
— el resto es lo que financia el negocio y el equipo.

## Punto de equilibrio de la infraestructura

Con el costo fijo en etapa piloto (~$70 USD ≈ $280.000 COP al mes),
**tres negocios en plan Profesional ya cubren toda la infraestructura.** De ahí
en adelante cada negocio nuevo es casi todo margen. Esto es lo que hace viable
arrancar sin inversión: el producto se paga solo muy temprano.

## Costo de adquirir un cliente, y cuánto tarda en devolverse

Estos números hay que medirlos, no adivinarlos. Van como hipótesis a validar con
los primeros 20 negocios:

- **Adquisición inicial esperada: visita presencial.** Barrio por barrio, demo en
  el local. Es lento y no escala, pero es lo único que funciona cuando no hay
  marca. Las primeras 20 ventas enseñan qué objeciones existen de verdad.
- **Costo por cliente en esa etapa: tu tiempo.** Si una venta toma 3 visitas y
  cada visita hora y media, son 4,5 horas por cliente.
- **Tiempo de recuperación:** si más adelante se paga publicidad y adquirir un
  negocio cuesta $200.000 COP, en plan Profesional se recupera en menos de dos
  meses. Cualquier cosa por debajo de seis meses es saludable para un SaaS.

**La métrica que decide si el negocio sirve: la cancelación mensual.** Con 5%
mensual, un cliente dura en promedio 20 meses y deja unos $2.580.000 COP. Con
10%, dura 10 meses y deja la mitad. Bajar la cancelación vale más que subir el
precio, y por eso el roadmap de v1.1 está lleno de funciones de retención y no
de funciones nuevas para vender.

## Lo que NO se cobra (por ahora), y por qué

**Comisión por cita.** Es el modelo de Fresha y Booksy y es mucho más rentable,
pero solo se justifica cuando tú le traes el cliente al negocio. En white-label
los clientes son suyos: cobrarle comisión por atender a su propio cliente de
toda la vida es indefendible y lo haría cancelar. Esto cambia el día que el
directorio esté encendido, y solo para el cliente que llegó por el directorio.

**Cobro por mensaje de WhatsApp.** Complica la venta, asusta al dueño y el costo
real es de centavos. Se absorbe y se vigila en `10-costos`.

**Pasarela de pagos para el cliente final.** Cobrar el abono o el servicio en
línea es una función de v2. Cuando exista, abre un ingreso adicional por
comisión sobre el valor procesado — pero requiere resolver desembolsos a cada
negocio, que es un problema serio de operación y de cumplimiento.

## Descuentos y casos especiales

- **Anual con 2 meses gratis.** Mejora el flujo de caja y baja la cancelación,
  pero solo ofrecerlo después del primer mes de uso real — un negocio que paga
  un año por adelantado y a la semana abandona es un reembolso y una mala
  reseña.
- **Negocios piloto: gratis los primeros 3 a 6 meses** a cambio de reuniones de
  retroalimentación y permiso para usarlos como caso de referencia. Dejar por
  escrito la fecha en que empiezan a pagar, desde el primer día.
- **Nunca un precio personalizado por negocio en el MVP.** Cada excepción hay
  que sostenerla para siempre y ensucia la facturación. Si el precio no cierra
  ventas, se cambia la lista de precios para todos.

## Impuestos

El cobro de suscripciones en Colombia está gravado con IVA (19%). **Los precios
de lista deben mostrarse con IVA incluido** — un dueño de barbería espera pagar
lo que ve, y descubrir un 19% extra al facturar genera desconfianza y disputas.
La plataforma debe emitir el soporte correspondiente a cada negocio.

> **Por confirmar con un contador antes de la primera venta:** régimen aplicable,
> obligación de facturación electrónica ante la DIAN, y si la facturación se
> puede delegar en la pasarela o hay que integrar un proveedor de facturación
> electrónica. Esto es un requisito de lanzamiento, no un detalle posterior:
> facturar mal desde el negocio número uno es muy caro de corregir después.
