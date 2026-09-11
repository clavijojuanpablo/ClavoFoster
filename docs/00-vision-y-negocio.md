# 00 — Visión y negocio

## El problema

Una barbería de barrio en Bogotá maneja sus citas así: el cliente escribe por
WhatsApp, el dueño mira un cuaderno, responde "a las 3 te puedo", y lo anota. Si
el barbero se enferma, toca llamar uno por uno. Si el cliente no llega, esa hora
se perdió y nadie la registró. A fin de mes nadie sabe cuánto entró, cuánto
salió, ni cuál barbero produjo más.

Los cuatro dolores concretos, en orden de cuánto duelen:

**1. El no-show.** El cliente no llega y no avisa. Es plata que no se recupera
porque la hora ya pasó. En agendamiento de belleza esta es la pérdida más
grande y la más invisible: el dueño ni siquiera sabe cuánto le cuesta al mes.

**2. El WhatsApp como agenda.** Coordinar cada cita a mano consume horas del
dueño, que además está cortando pelo. Se traslapan citas, se olvidan, se
responde tarde y el cliente se va a otro lado.

**3. No saber los números.** Cuánto se facturó, qué servicio deja más, qué hora
está muerta, qué barbero produce. Sin eso no se puede decidir nada: ni subir un
precio, ni contratar, ni despedir.

**4. La plata de los trabajadores.** En barberías colombianas el reparto por
comisión (50/50 es común) se calcula a mano cada quincena. Es fuente constante
de desconfianza y de discusión.

## Qué construimos

Una plataforma donde:

- El cliente entra a un link, ve los horarios **realmente** disponibles, escoge
  servicio y trabajador, y reserva. La primera vez deja nombre y celular;
  después solo el celular.
- El dueño ve todo en un calendario, reprograma arrastrando, y cada cita
  cumplida entra sola a su contabilidad.
- Los recordatorios por WhatsApp salen solos y bajan el no-show.
- Cada trabajador tiene su horario, sus servicios y su propia vista.

## A quién le vendemos

**Cliente objetivo inicial: barberías y peluquerías de 2 a 8 trabajadores en
ciudades principales de Colombia.**

Por qué ese y no otro:

- Ya tienen el dolor. Con un solo trabajador un cuaderno alcanza; con más de
  ocho ya suelen tener algún sistema.
- El dueño está en el local y decide solo. No hay comité de compras ni
  departamento de sistemas. Se vende en una visita.
- Hay muchísimos y se parecen entre sí, que es exactamente lo que permite vender
  el mismo producto 100 veces sin personalizar.

Se atiende también a spa, cosmetología y tatuadores porque el modelo de datos es
el mismo — servicio con duración, trabajador con horario, cita. Pero el mensaje
de venta y las primeras funciones se afinan para barbería. Un producto que
intenta ser perfecto para cinco industrias al tiempo no es bueno para ninguna.

Lo que **no** atendemos: consultorios médicos y odontología. Suenan parecidos
pero traen historia clínica, normativa de datos de salud y facturación a EPS.
Es otro producto.

## Propuesta de valor

> Tu agenda organizada, tus clientes recordados y tus números claros — sin
> cuaderno y sin perder horas en WhatsApp.

Tres promesas verificables, en orden de fuerza para vender:

1. **Menos citas perdidas.** El recordatorio automático por WhatsApp reduce el
   no-show. Es el argumento que se paga solo: si evita dos no-shows al mes, la
   mensualidad ya se pagó.
2. **Menos tiempo coordinando.** El cliente reserva solo, a cualquier hora,
   incluso de madrugada y con el local cerrado.
3. **Saber cuánto entra.** Contabilidad que se llena sola con las citas
   cumplidas, más ingresos y egresos manuales.

## Competencia

| Quién | Qué es | Dónde nos diferenciamos |
|---|---|---|
| **Cuaderno y WhatsApp** | El competidor real del 80% del mercado objetivo | Es gratis y ya lo saben usar. Hay que ganarle en dolor concreto, no en funciones |
| **Booksy** | Marketplace global con app de negocio y de cliente | Producto muy completo y con marca fuerte. Su modelo empuja al negocio a depender del directorio |
| **Fresha** | Plataforma global, gratis para el negocio, monetiza por comisión y pagos | Su "gratis" es muy difícil de competir de frente en precio |
| **Agendapro** | Origen chileno, presencia en Colombia, apunta a belleza y salud | Competidor regional directo. Suele apuntar a negocios más grandes |
| **Calendly y similares** | Agendamiento genérico | No entienden trabajadores, comisiones ni caja. No es competencia real |

> **Por verificar antes de fijar precio:** planes y precios vigentes de
> Agendapro y Booksy en Colombia, y bajo qué condiciones Fresha es gratis. De
> esto depende `01-modelo-de-negocio-y-precios.md`.

**Cómo se compite contra un producto global:** no por funciones, sino por
cercanía. Soporte en español colombiano y por WhatsApp, cobro en pesos por
PSE y Nequi sin necesidad de tarjeta de crédito internacional, comisiones de
barbero resueltas como se usan acá, y alguien que contesta. Las plataformas
globales no hacen ninguna de esas cuatro cosas bien en este mercado.

## Por qué white-label antes que marketplace

Se decidió vender **software**, no clientes — al menos al principio. Cada
negocio tiene su propia página de reservas (`laplataforma.com/barberia-juan`)
que pone en su bio de Instagram y en su WhatsApp. Los clientes que llegan son
los suyos.

La razón es el arranque en frío. Un directorio con tres barberías no le sirve a
ningún cliente: busca, no encuentra nada cerca, y no vuelve. Sin clientes
buscando, el negocio no recibe citas nuevas, no ve valor y cancela. Se necesita
densidad por zona — del orden de 50 a 100 negocios en una misma ciudad — antes
de que el directorio le sirva al primero. El white-label, en cambio, le entrega
valor al negocio número uno el mismo día que entra.

**Pero se deja el terreno preparado.** Desde el registro se le piden al negocio
los datos que solo sirven para el directorio: dirección con ubicación en el
mapa, categoría, fotos del local. Y las reseñas de clientes funcionan desde el
MVP aunque todavía no haya dónde mostrarlas públicamente. Es poco trabajo hoy;
el día que se encienda el directorio, estarán los 200 negocios con datos
completos en vez de tener que perseguirlos uno por uno.

Ver `adr/0004-white-label-antes-que-marketplace.md`.

## Cómo se ve el éxito

**Primeros 3 meses:** 5 negocios piloto usando la plataforma de verdad todos los
días. No pagan o pagan simbólico. El objetivo es que dejen el cuaderno.

**Mes 6:** 20 negocios pagando. Ingreso recurrente mensual suficiente para
cubrir infraestructura y herramientas con holgura.

**Mes 12:** 100 negocios pagando, cancelación mensual por debajo del 5%, y al
menos una ciudad con densidad suficiente para evaluar encender el directorio.

La métrica que de verdad importa no es cuántos negocios se registran, sino
**cuántos siguen agendando en la semana 8**. Un negocio que vuelve al cuaderno
al mes ya se perdió, aunque siga pagando.

## Riesgos

| Riesgo | Qué tan grave | Cómo se mitiga |
|---|---|---|
| El negocio se registra y nunca carga sus servicios | Alto y muy común | Onboarding guiado y acompañado en los primeros negocios; carga inicial hecha por nosotros si hace falta |
| El dueño no confía en que el cliente sepa reservar solo | Alto | El dueño puede seguir agendando manualmente; la reserva en línea se suma, no reemplaza |
| WhatsApp cambia precios o reglas de la API | Medio | Fallback a email y SMS; el costo por mensaje se monitorea |
| Fresha entra fuerte con gratis | Medio | Competir en cercanía y cobros locales, no en precio |
| Un solo cliente grande pide personalización | Medio | Se resuelve con configuración, nunca con código específico para un negocio |
