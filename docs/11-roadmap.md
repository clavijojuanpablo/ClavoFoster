# 11 — Roadmap

## Las fases

```
Fase 0  Fundación          A            El esqueleto
Fase 1  El motor           B C D E      Lo que nadie ve pero todo depende
Fase 2  Reservar           F I(parcial) Ya sirve para algo
Fase 3  Administrar        G H K        Ya se puede vender
Fase 4  Cobrar             J I(resto)   Ya es un negocio
────────────────────────────────────────────────────────
        MVP vendible
Fase 5  Retención          v1.1         Que no te cancelen
Fase 6  Expansión          v2           Que valga más
```

Las fases 0 a 4 son el MVP completo del `03-backlog.md`. **No se puede vender
antes de terminar la fase 4**, porque sin cobro no hay negocio.

Pero sí se puede **poner en manos de un negocio piloto al terminar la fase 3**.
De hecho hay que hacerlo: un piloto real usando el producto mientras se construye
el cobro enseña más que cualquier reunión.

---

## Fase 0 — Fundación

Proyecto, base de datos, RLS, autenticación, despliegue.

**Terminada cuando:** un negocio de prueba existe en la base, su dueño entra al
panel, y **la prueba automática de aislamiento pasa**. Esa prueba es el
entregable real de esta fase.

## Fase 1 — El motor

Negocio, servicios, trabajadores, horarios y el motor de cupos.

**Terminada cuando:** los 15 casos de prueba de `06-motor-de-agendamiento.md`
pasan, incluido el del corte de 60 minutos a las 12 y la barba a la 1.

Todavía no hay interfaz bonita. **No importa.** Con el motor funcionando y datos
reales cargados ya se le puede mostrar a un dueño de barbería —aunque sea en una
pantalla fea— que el sistema le ofrece las 1:30 en vez de las 2:00. Esa demo ya
convence.

## Fase 2 — Reservar

Página pública, selección de servicio y trabajador, calendario de cupos, OTP por
WhatsApp, confirmación.

**Terminada cuando:** una persona ajena al proyecto reserva una cita desde su
celular, sin ayuda y sin explicación previa. Si hay que explicarle algo, la
fase no está terminada.

## Fase 3 — Administrar

Calendario del dueño, crear y mover citas, estados, contabilidad, panel de
inicio, PWA.

**Terminada cuando:** un negocio piloto real lleva **una semana completa**
operando sin volver al cuaderno.

Acá entra el primer piloto. Gratis, acompañado, y con la expectativa explícita de
que van a aparecer problemas.

## Fase 4 — Cobrar

Suscripciones, prueba gratis, webhooks, mora, cobro manual, y el resto de las
notificaciones.

**Terminada cuando:** un negocio pasa por todo el ciclo —prueba, pago, cobro del
segundo mes— sin intervención manual. Probar también el camino de la
transferencia, que es el que más se va a usar de lo que uno espera.

**Al terminar esta fase se puede vender.**

---

## v1.1 — Retención

> **Todo lo de esta versión existe para que no te cancelen.** A esta altura ya no
> falta producto: falta que el negocio no pueda imaginarse volviendo al cuaderno.
>
> Bajar la cancelación del 10% al 5% mensual duplica lo que deja cada cliente. Es
> más rentable que cualquier función nueva para vender.

**Comisiones por trabajador.** La función más pedida en barberías colombianas.
El reparto 50/50 se calcula a mano cada quincena y es fuente constante de
desconfianza entre el dueño y sus barberos. Que salga solo del sistema resuelve
un conflicto humano, no solo una cuenta.

**Lista de espera.** Cuando se cancela una cita, avisar automáticamente a quien
quería esa franja. Convierte una cancelación —pérdida— en una venta. Es la
función con mejor retorno directo de toda la lista.

**Historial y notas del cliente.** "El 3 a los lados", "alérgica al tinte con
amoníaco", "no le gusta la máquina en la nuca". Es lo que hace que el trabajador
quiera abrir el sistema en vez de evitarlo. Y **es lo que hace doloroso irse a
otra plataforma**: la historia no se lleva.

**Varios servicios en una cita.** Corte + barba encadenados, con la duración
sumada. Muy común y hoy toca reservar dos citas seguidas a mano.

**Bloqueo de clientes con no-shows repetidos.** Tras N faltas, el cliente no
puede reservar en línea y tiene que llamar. El dueño decide el umbral.

**Reportes de servicio más rentable y hora pico.** Le dice al dueño qué subir de
precio y cuándo hacer promoción. Le pone números a decisiones que hoy toma por
intuición.

**Solicitud de reseña en Google.** Después de una cita cumplida, un mensaje con
el link directo. Las reseñas de Google son el principal canal de descubrimiento
de una barbería de barrio; ayudarle con eso es valor real y **prepara el terreno
del directorio**.

---

## v2 — Expansión

Cada ítem lleva por qué está y qué lo bloquea.

### Pagos del cliente final

**Abono para reservar.** El remedio de verdad contra el no-show: quien pone
$10.000 para apartar, llega.

*Lo que lo bloquea:* hay que desembolsarle esa plata a cada negocio, lo que
significa manejar plata ajena. Eso trae obligaciones regulatorias y de
conciliación serias. **Es el ítem más complejo de todo el roadmap** y hay que
entrar con asesoría, no improvisando.

*Lo que abre:* una línea de ingreso nueva por comisión sobre el valor procesado.

### Para tatuadores y cosmetología

**Fotos antes y después.** Es el portafolio del tatuador y el registro de
evolución del tratamiento estético. Para ellos no es un extra: es su herramienta
de venta.

**Consentimiento digital firmado.** Formulario y firma en pantalla antes del
procedimiento, guardado con fecha. En tatuajes y en procedimientos estéticos
tiene peso legal.

*Por qué importa estratégicamente:* son dos funciones que las plataformas
genéricas no tienen, y que permiten cobrar más a un segmento con ticket más alto
que una barbería.

> **Antes de construirlas hay que validar con tatuadores reales.** Están en v2
> justamente porque el cliente objetivo inicial es barbería, y construir para un
> segmento que todavía no nos compra es la forma más común de perder meses.

### Fidelización y reactivación

**Programa de fidelidad.** Cada 10 cortes, uno gratis. Hoy se lleva en tarjetas
de cartón que la gente pierde.

**Campañas de reactivación.** "Clientes que no vienen hace 60 días" → mensaje con
una oferta. Es de las acciones de marketing más rentables que existe para este
tipo de negocio, porque le habla a alguien que ya compró.

*Riesgo:* son mensajes de marketing, que cuestan ~10× más y generan reportes de
spam. Nacen con cupo por negocio y con reglas estrictas
(`09-notificaciones.md`).

### Operación

**Inventario de productos.** Tintes, agujas, cremas. Lo necesitan spa y
peluquería; una barbería no tanto.

**Venta de productos en la cita.** Ceras, shampoos. Suma al ingreso de la cita y
al reporte del trabajador.

**Multi-sede.** Un dueño con dos o tres locales. El modelo de datos ya lo
soporta; falta la interfaz y el plan Estudio.

**Recursos y cabinas reservables.** Un spa no reserva solo a la masajista:
reserva la cabina. Es una extensión del motor de cupos —el cupo exige que
coincidan trabajador *y* recurso libres— y es requisito para vender spa en serio.

**Sincronización con Google Calendar.** Que el trabajador vea sus citas en su
calendario personal. Muy pedido, técnicamente incómodo, y hay que decidir si es
en una dirección o en las dos.

### Plataforma

**App nativa para el dueño.** Según `adr/0003-web-pwa-antes-que-app-nativa.md`,
la PWA con avisos por WhatsApp cubre el MVP.

*Cuándo reconsiderarlo:* si los dueños piden la app en la tienda como condición
de compra, o si los avisos por WhatsApp resultan insuficientes. Para entonces ya
se sabrá **cuáles 4 o 5 pantallas usa realmente el dueño en el celular**, y se
construye solo eso. Construirla ahora sería adivinar.

**Encendido del directorio.** El cambio de white-label a marketplace.

*Lo que lo bloquea:* densidad. Se necesitan entre 50 y 100 negocios activos en
una misma ciudad, con dirección y fotos cargadas. Los datos ya se vienen
recogiendo desde el MVP (tarea B4) justamente para no tener que perseguirlos
después.

*Lo que abre:* cobrar comisión sobre el cliente nuevo que le llevamos al negocio
— un modelo mucho más rentable que la suscripción
(`01-modelo-de-negocio-y-precios.md`).

---

## Lo que está fuera, y seguirá fuera

| Qué | Por qué no |
|---|---|
| **Consultorios médicos y odontología** | Historia clínica, normativa de datos de salud y facturación a EPS. Es otro producto, no una función más |
| **Nómina completa** | Comisiones sí; liquidación laboral, prestaciones y seguridad social no. Hay software especializado y es un pozo sin fondo |
| **Punto de venta con facturación electrónica** | Requisito regulatorio pesado. Mejor integrarse con quien ya lo hace |
| **Personalizaciones por cliente** | Rompe el modelo de negocio completo. Todo se resuelve con configuración (`05-arquitectura-multitenant.md`) |
| **Versión gratis permanente** | Con costo marginal de $2 USD por negocio, un plan gratis atrae a quien nunca va a pagar y consume el soporte que necesitan los que sí pagan. La prueba de 14 días cumple esa función |

---

## Cómo se decide qué sigue

El backlog de v1.1 y v2 es una hipótesis, no un compromiso. Tres reglas para no
construir lo que nadie pidió:

1. **Nada de v2 se construye sin que al menos tres negocios distintos lo hayan
   pedido**, sin que se les haya sugerido.
2. **Lo que baja la cancelación va antes que lo que trae clientes nuevos**, hasta
   que la cancelación esté por debajo del 5% mensual.
3. **Al terminar cada fase se habla con los pilotos.** Lo que digan pesa más que
   este documento; este documento se actualiza con lo que digan.
