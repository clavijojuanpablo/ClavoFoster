# ADR 0003 — Web y PWA antes que app nativa

- **Fecha:** 2026-09-11
- **Estado:** Aceptada

## Contexto

El cliente final **tiene** que reservar desde el navegador: pedirle que descargue
una app para agendar un corte de pelo mata la conversión. Eso no está en
discusión.

La pregunta real era el panel del dueño. Administrar un negocio desde el
navegador del celular es incómodo, y una app en las tiendas se vende mejor
("descarga nuestra app" pesa en una visita comercial).

## Decisión

**Todo en web, con el panel del dueño instalable como PWA. Los avisos críticos al
dueño van por WhatsApp, no por notificaciones push.**

La app nativa queda en el roadmap de v2, para construirse con ingresos ya
existentes.

## Alternativas consideradas

**React Native Web desde el día 1.** Un solo código que corre como web y como app
nativa; salir a las tiendas después serían días. Se descartó por el calendario:
la pantalla más importante del producto necesita vista por trabajador y
arrastrar-y-soltar para reprogramar, y en web eso está resuelto con librerías
maduras mientras que en React Native es de lo más doloroso que hay. Adoptarlo
significaría pelear con la pantalla principal durante todo el MVP para ganar una
salida a tiendas que tal vez nunca se necesite.

**App nativa desde el MVP.** Push confiables y mejor argumento de venta. Se
descartó por costo y velocidad: $99 al año de Apple, $25 de Google, ciclos de
revisión de 1 a 3 días por cada actualización, y un proyecto más que mantener
—todo antes del primer peso facturado.

**Cáscara nativa (Capacitor) sobre la misma web.** Sigue disponible como camino
rápido a las tiendas. No se descarta; simplemente no se necesita todavía.

## Consecuencias

**A favor**

- Un solo código, un solo despliegue, una sola cosa que mantener.
- Las mejoras llegan a todos al instante, sin revisión de Apple.
- Cero costo de tiendas.
- El calendario se construye con herramientas maduras.

**En contra**

- Las notificaciones push del navegador son frágiles en iPhone.
- Instalar la PWA en iPhone es un proceso poco obvio (Compartir → Añadir a
  pantalla de inicio) que probablemente haya que explicarle a cada dueño.
- No hay presencia en las tiendas, y eso resta en el pitch.

**La mitigación es lo que hace viable la decisión:** los avisos importantes al
dueño —cita nueva, cancelación— salen por **WhatsApp**. En este mercado eso no es
un reemplazo pobre del push, es mejor: llega a donde el dueño ya vive todo el
día, no compite con notificaciones silenciadas, y funciona igual en iPhone que en
Android sin depender de que haya instalado nada. El costo verificado es de
alrededor de un dólar al mes por negocio (`09-notificaciones.md`).

## Cuándo revisar esta decisión

- Si varios dueños ponen la app en la tienda como condición de compra.
- Si los avisos por WhatsApp resultan insuficientes en la práctica.
- Si Meta encarece o restringe la API al punto de volverla inviable.

**Cuando llegue ese momento, se sabrá cuáles 4 o 5 pantallas usa realmente el
dueño en el celular, y se construye solo eso.** Construirla hoy sería adivinar
cuáles son.

## Referencias

`04-stack-tecnologico.md` · `09-notificaciones.md` · `11-roadmap.md`
