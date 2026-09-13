# 04 — Stack tecnológico

## El criterio de selección

Somos dos personas y no hay equipo de infraestructura. Cada pieza se eligió
optimizando, en este orden:

1. **Menos operación.** Todo lo que haya que mantener, actualizar o vigilar de
   madrugada es tiempo que no se está vendiendo.
2. **Un solo lenguaje.** TypeScript de punta a punta. Dos lenguajes en un equipo
   de dos personas duplica el costo de todo.
3. **Costo que crece con los ingresos**, no antes. Empezar gratis y pagar cuando
   haya negocios pagando.
4. **Salida posible.** Nada que deje el producto secuestrado si el proveedor
   sube precios o cierra.

## Resumen

| Capa | Elección | Costo inicial |
|---|---|---|
| Framework web | Next.js 16 (App Router) | $0 |
| Lenguaje | TypeScript estricto | $0 |
| Base de datos | Postgres administrado por Supabase | $0 → $25/mes |
| Autenticación | Supabase Auth | Incluido |
| Archivos | Supabase Storage | Incluido |
| Tiempo real | Supabase Realtime | Incluido |
| Tareas programadas | pg_cron + Edge Functions | Incluido |
| Hosting | Vercel | $0 → $20/mes |
| Interfaz | Tailwind CSS 4 + shadcn/ui | $0 |
| Calendario | Librería de agenda con arrastrar y soltar | $0 |
| Mapa | Leaflet + OpenStreetMap (Nominatim para buscar) | $0 |
| Validación | Zod | $0 |
| Cobro recurrente | Mercado Pago Suscripciones | Comisión por transacción |
| Mensajería | WhatsApp Cloud API (Meta, directo) | Por mensaje |
| Email | Resend | $0 → $20/mes |
| Errores | Sentry | $0 |
| Analítica de producto | PostHog | $0 |
| Pruebas | Vitest + Playwright | $0 |

## Por qué cada pieza

### Next.js 16 con App Router

Las tres superficies del producto —página pública de reservas, panel del dueño y
vista del trabajador— viven en un solo proyecto, comparten tipos y comparten
lógica. Para un equipo de dos, tener un solo despliegue y un solo repositorio
vale más que cualquier ventaja teórica de separar.

Además la página pública necesita **renderizado en servidor**: es la cara del
producto, la que se comparte por WhatsApp y la que un día tiene que aparecer en
Google. Una aplicación que solo renderiza en el navegador arranca lenta en un
celular de gama media con red móvil, que es exactamente el escenario real.

*Se descartó:* separar backend (NestJS, Express) y frontend. Es más limpio en
teoría y es lo correcto con un equipo grande, pero acá significa mantener dos
despliegues, dos configuraciones y un contrato entre ellos, para el mismo
resultado.

### Supabase

Da en un solo producto lo que de otro modo son cinco servicios: Postgres
administrado, autenticación, almacenamiento de archivos, actualizaciones en
vivo y funciones en el borde.

Pero la razón de fondo es otra: **Row Level Security**. Es la pieza que hace
viable el multi-tenant sin reescribir el aislamiento en cada consulta, y
Supabase la expone de forma directa y cómoda. Ver
`05-arquitectura-multitenant.md`.

Y por debajo es **Postgres estándar**. Si algún día hay que salir, es una copia
de base de datos hacia cualquier Postgres administrado. Eso es lo que lo hace
una apuesta razonable.

*Se descartó:*

- **Firebase / Firestore.** Su modelo no relacional no sirve acá. Este producto
  es relacional hasta el hueso (negocio → trabajador → cita → servicio →
  movimiento contable) y necesita consultas con rangos de tiempo, sumas por
  período y restricciones de integridad. Hacer contabilidad en Firestore es
  pelear contra la herramienta.
- **Neon o Postgres puro + autenticación propia.** Más control y probablemente
  más barato a gran escala, pero hay que construir autenticación, archivos y
  tiempo real. Son semanas que no tenemos.
- **Base de datos propia en un servidor.** Copias de seguridad, parches,
  monitoreo y disponibilidad pasan a ser problema nuestro. No.

### Vercel

Despliegue por `git push`, entorno de vista previa por cada pull request (muy
útil con un dev contratado: se revisa el cambio funcionando, no el código a
secas) y cero configuración con Next.js.

*Se descartó:* Cloudflare Pages y Railway, ambos buenos y más baratos a volumen.
La razón de quedarse con Vercel es que cualquier rareza de Next.js está
resuelta ahí primero. **Si el costo se dispara, migrar es realista** — está
anotado como riesgo en `10-costos-de-infraestructura.md`.

### Tailwind CSS + shadcn/ui

shadcn/ui no es una dependencia: **copia los componentes a tu repositorio**. No
hay versión que se rompa ni estilos peleando contra una librería. Para un
producto que va a tener identidad propia y que hay que ajustar mucho, es la
opción correcta.

### La librería de calendario

Es la decisión de interfaz más importante y hay que tomarla al llegar a la
épica G, evaluando con datos reales. Los requisitos no negociables:

- Vista de día con una columna por trabajador.
- Arrastrar y soltar para reprogramar.
- Que funcione bien en celular.
- Licencia compatible con un producto comercial. **Verificar esto antes de
  escribir una línea**: varias librerías populares de calendario son de pago
  para uso comercial, y descubrirlo después de construir encima es carísimo.

### Leaflet y OpenStreetMap para el mapa

Se usa en un solo lugar: el dueño marca dónde queda su local (tarea B4). Las
coordenadas no se usan en el MVP; alimentan el directorio futuro.

**Se eligió sobre Google Maps** porque es gratis, no pide llave ni tarjeta, y el
uso es mínimo (cada negocio marca su ubicación una vez). Lo que se guarda es la
posición del pin que el dueño arrastra, no el resultado del buscador, así que
la peor calidad de búsqueda de direcciones colombianas en OpenStreetMap importa
poco. También hay botón "Estoy en el local", que usa el GPS del celular.

**Límites que hay que respetar:** el buscador gratuito (Nominatim) permite como
máximo una petición por segundo, exige identificar la aplicación y prohíbe el
autocompletado. Por eso solo se llama al tocar "Buscar", desde el servidor. Los
mosaicos de `tile.openstreetmap.org` son para uso liviano y exigen la
atribución visible.

**Cuándo cambiar:** si el directorio se enciende y el mapa pasa a mostrarse a
clientes finales, ese volumen ya no es uso liviano. Ahí toca un proveedor de
mosaicos pago o Google Maps, con cifras verificadas en ese momento. El cambio
queda contenido en `components/admin/mapa-ubicacion.tsx` y en `buscarDireccion`.

### Zod

Toda entrada externa —formularios, parámetros de ruta, webhooks— se valida en el
borde y de ahí sale un tipo de TypeScript. Un webhook de pasarela mal formado
que llega hasta la base de datos es una corrupción silenciosa de datos.

### WhatsApp Cloud API directo, no un intermediario

Meta cobra por mensaje. Un intermediario (Twilio, 360dialog) cobra su margen
encima, y a nuestro volumen esa diferencia importa. La API directa es más
trabajo de configuración inicial, pero es una sola vez.

*Cuándo reconsiderarlo:* si el proceso de verificación de negocio con Meta se
vuelve un bloqueo, un intermediario lo resuelve más rápido. Es una decisión de
velocidad contra costo, y se puede cambiar después porque el código de
notificaciones ya está detrás de una interfaz propia.

### Sentry y PostHog

Sentry avisa cuando algo se rompe **antes de que el dueño de la barbería llame**.
PostHog muestra dónde abandona la gente el flujo de reserva, que es la métrica
más valiosa del producto. Ambos con capa gratuita suficiente para esta etapa.

### Vitest y Playwright

Vitest para la lógica pura del motor de cupos, que es donde las pruebas
realmente pagan. Playwright para dos o tres recorridos completos: reservar una
cita, y que un negocio no vea los datos de otro. No se busca cobertura alta: se
busca cubrir lo que, si se rompe, mata el producto.

## Lo que NO está en el stack, a propósito

| Qué | Por qué no |
|---|---|
| **Docker y Kubernetes** | No hay servidores que orquestar. Sería infraestructura para un problema que no tenemos |
| **GraphQL** | Un consumidor, un equipo. Los Server Actions de Next.js resuelven lo mismo con mucho menos aparato |
| **Redis** | Postgres aguanta de sobra este volumen. Se suma si aparece un cuello de botella medido |
| **Microservicios** | Con dos personas, dividir en servicios multiplica la complejidad sin ningún beneficio |
| **React Native** | Decidido: web y PWA primero. Ver `adr/0003-web-pwa-antes-que-app-nativa.md` |
| **Un ORM pesado** | El cliente de Supabase con tipos generados alcanza. Un ORM encima esconde el SQL justo donde hay que verlo, que es en las consultas de disponibilidad |

## Riesgos del stack

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Vercel se vuelve caro al crecer | Media | Se mide desde el principio. Migrar a Cloudflare o Railway es viable |
| Supabase cambia precios | Media | Es Postgres estándar: la salida existe y es real |
| Meta cambia reglas de WhatsApp | Media | Notificaciones detrás de interfaz propia; fallback a email y SMS |
| La librería de calendario no da | Media | Evaluar y probar **antes** de construir encima |
| Dependencia de un solo proveedor de pagos | Alta | Adaptadores desde el día 1 (tarea J1) |
