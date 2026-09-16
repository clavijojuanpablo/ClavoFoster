# 14 — Estado actual y cómo retomar

> **Empieza por acá si vuelves al proyecto después de un tiempo, o si eres
> alguien nuevo.** Este documento se actualiza al terminar cada tarea.
>
> Última actualización: 2026-09-16

## Retomar en cinco minutos

```bash
npm install
# .env.local no está en el repositorio: pedirlo o reconstruirlo con .env.example
npm run db:login          # autenticarse con Supabase
npm run db:link           # enlazar con el proyecto de desarrollo
npm run db:push           # aplicar migraciones pendientes
npm run db:types          # regenerar lib/types/database.ts
npm run db:seed           # datos de demostración (opcional pero recomendado)
npm run dev               # http://localhost:3000
```

Comprobación rápida de que todo quedó bien:

```bash
npm run test              # deben pasar todas
npm run typecheck
```

## Dónde mirar qué

| Pregunta | Documento |
|---|---|
| ¿Qué falta por hacer? | `03-backlog.md` — **el control de avance** |
| ¿Por qué se eligió esto? | `adr/` y el documento del tema |
| ¿Cómo se trabaja acá? | `12-convenciones-de-desarrollo.md` |
| ¿Cómo funciona el motor de cupos? | `06-motor-de-agendamiento.md` |
| ¿Qué tablas hay? | `07-modelo-de-datos.md` |
| ¿Cuánto cuesta operar esto? | `10-costos-de-infraestructura.md` |

## Avance

**30 de 55 tareas del MVP.** El detalle vive en `03-backlog.md`; acá va el resumen.

| Épica | Estado |
|---|---|
| **E — Motor de agendamiento** | **Completa** |
| **A — Fundación técnica** | **Completa** |
| B — Negocio y onboarding | B1, B3, B4 y B5 hechas. B2 pendiente |
| C — Servicios | C1 hecha. C3 (categorías y orden) pendiente. C2 (buffers) salió del MVP |
| D — Trabajadores y horarios | D1 a D4 hechas. D5 (invitación del trabajador) pendiente |
| **F — Reserva pública** | **Completa** |
| G — Panel y calendario | G1, G2 y G5 hechas. Faltan G3, G4 y G6 |
| H, I, J, K | Sin empezar |

### Lo que ya funciona

Desplegado en **https://clavo-foster-5lt7.vercel.app** (rama `main`):

- `/[slug]` — página pública del negocio, sin sesión. Ej. `/barberia-demo`
- `/[slug]/reservar` — **la reserva completa**: servicio, persona, día y hora con
  cupos reales, código por WhatsApp y la cita guardada
- `/cita/[token]` — la cita del cliente: ver, mover la hora y cancelar
- `/login`, `/registro`, `/bienvenida` — entrar, crear cuenta y crear el negocio
- `/panel` — Inicio: citas de hoy, siguiente cita, caja del día y "Completa tu negocio"
- `/panel/negocio` — perfil: página visible u oculta, datos, mapa, fotos, zona horaria
- `/panel/servicios` — crear, editar, desactivar y reactivar servicios
- `/panel/equipo` — el equipo, los servicios que presta y el horario semanal de cada persona
- `/panel/agenda` — **el calendario**: día y semana, una columna por persona,
  detalle de la cita y marcarla cumplida o no llegó. Se actualiza sola cuando
  alguien reserva
- `/panel/equipo/ausencias` — bloqueos y cierres del local, con aviso de citas afectadas
- `/api/cron/cleanup-holds` — libera retenciones vencidas (nadie lo llama aún)
- `lib/scheduling/` — el motor de cupos, con 28 pruebas

Todo con el sistema de diseño de `15-sistema-de-diseno.md`: menú lateral en
escritorio y barra inferior con hoja "Más" en celular.

Comprobación: 312 pruebas en verde, `typecheck`, `lint` y `build` limpios.

### Qué sigue

**El producto ya hace lo que promete de lado del cliente final.** Un
desconocido entra a `/barberia-demo`, escoge corte, persona y hora, recibe un
código, y la cita queda guardada con su link para moverla o cancelarla. La
épica F está completa.

**⚠️ Antes de un cliente real: las credenciales de WhatsApp.** Sin
`WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`, el canal está en *modo consola*: no
manda nada y escribe el código de verificación en el registro del servidor.
Sirve para desarrollar y no bloquea nada, pero **con clientes de verdad es un
agujero**: cualquiera con acceso a los registros vería los códigos. La pantalla
del código lo avisa mientras esté así. Hay que sacar el número y las plantillas
(`auth_otp`, `booking_confirmed`, `booking_cancelled`, `booking_rescheduled`)
con Meta; es trámite, no programación, y conviene empezarlo ya porque la
aprobación tarda. Ver `09-notificaciones.md`.

**El dueño ya tiene dónde ver lo que le reservaron** (G1, G2 y G5). El
calendario está en `/panel/agenda`, con vista de día y de semana, y se
actualiza solo si alguien reserva mientras lo tiene abierto.

De la épica G faltan tres:

- **G3 — crear cita manual.** Es la que más falta hace: el cliente que llega sin
  reservar o el que llama por teléfono no tiene cómo entrar a la agenda.
- **G4 — reprogramar arrastrando.** Cancelar ya está; falta el arrastre.
- **G6 — PWA instalable.**

Después H (contabilidad), que se engancha con "marcar cumplida". B2, C3 y D5 se
cierran al final. No hay horario del local (decidido el 2026-09-14).

**Pendiente antes de tener dueños reales: la confirmación de correo.** El
proyecto parece exigir que el dueño confirme su correo, y el servicio de correo
que trae Supabase por defecto no le entrega a direcciones reales. O se apaga la
confirmación, o se configura Resend como servidor de correo. El código funciona
con las dos.

**Negocios en prueba:** su página pública es visible (decidido el 2026-09-12). Se
apaga solo al pasar a `suspended`. Ojo: mientras no exista el trabajo programado
de la épica J que vence las pruebas, un negocio se queda en `trialing` para
siempre.

## Entorno

| Qué | Valor |
|---|---|
| Proyecto Supabase (desarrollo) | `pubpfmsgwnyuhxleaysr` |
| Repositorio | `github.com/clavijojuanpablo/ClavoFoster` |
| Despliegue (producción) | `https://clavo-foster-5lt7.vercel.app` |
| Negocio de demostración | `/barberia-demo` |
| Usuario de demostración | `demo@barberia.test` / `demo12345` |

> Esas credenciales son **solo del proyecto de desarrollo** y las crea
> `npm run db:seed`. No existen en producción.

`.env.local` **no está en el repositorio** y nunca debe estarlo. Sus valores se
sacan del dashboard de Supabase: Project Settings → API Keys.

## Despliegue

**En vivo: https://clavo-foster-5lt7.vercel.app** — proyecto `clavo-foster` en
Vercel, conectado al repositorio. Cada `push` a `main` despliega a producción y
cada rama abre un despliegue de vista previa.

**El build FALLA si faltan variables de entorno.** Es a propósito —
`lib/env.ts` valida al arrancar, para que un secreto faltante se descubra en el
despliegue y no cuando un cliente intente reservar. Se configuran en Project
Settings → Environment Variables:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Ídem, la llave *publishable* |
| `SUPABASE_SECRET_KEY` | Ídem, la llave *secret*. **Nunca con prefijo público** |
| `NEXT_PUBLIC_APP_URL` | La URL que asigne Vercel, no `localhost` |
| `CRON_SECRET` | `openssl rand -hex 32`, o el mismo de `.env.local` |
| `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` | Meta → WhatsApp Cloud API. **Opcionales en desarrollo**: sin ellas el canal escribe en el log en vez de enviar. Obligatorias antes de un cliente real |

> **Márcalas en los tres entornos (Production, Preview y Development), no solo
> en Production.** Si solo están en Production, cualquier rama que no sea `main`
> revienta el build por `lib/env.ts` — y la definición de terminado exige probar
> a mano en el entorno de vista previa antes de fusionar. Si un despliegue de
> rama sale en rojo con un error de variables faltantes, es esto.

**Este despliegue apunta al proyecto de DESARROLLO de Supabase.** Sirve para
mostrar el producto, no para negocios reales. Antes de la primera venta hay que
crear un proyecto de producción aparte y apuntar Vercel allá. Ver
`12-convenciones-de-desarrollo.md`.

**Trabajos programados: todavía no hay ninguno configurado.**
`/api/cron/cleanup-holds` existe y funciona —sin cabecera responde `401`, así
que `CRON_SECRET` sí quedó puesto— pero nadie lo llama solo. Ojo con esto al
configurarlo: el plan gratuito de Vercel solo permite tareas programadas **una
vez al día**, y una limpieza diaria de retenciones de 10 minutos no sirve de
nada. Lo correcto es `pg_cron` dentro de Supabase, como dice
`04-stack-tecnologico.md`.

Lo que sí hay pendiente de programar es **`limpiar_otp_vencidos()`**, que borra
los códigos de más de un día. Nadie la llama todavía. No es urgente —son unas
pocas filas— pero son datos de desconocidos y no tienen por qué quedarse.
`cleanup-holds` sigue sin tener nada que limpiar: la reserva no crea
retenciones (ver `13-contratos-de-api.md`, `holdSlot`).

## Decisiones que se tomaron sobre la marcha

Las grandes están en `adr/`. Estas son las pequeñas que sorprenden si uno se las
encuentra sin contexto:

**Next.js 16 renombró `middleware.ts` a `proxy.ts`.** Un `middleware.ts` en la
raíz no se ejecuta y **no da error**: simplemente se ignora. Si alguna vez el
panel deja de estar protegido, mirar ahí primero.

**Supabase: llaves nuevas, no las antiguas.** `sb_publishable_...` y
`sb_secret_...` en vez de `anon` y `service_role`. Ojo con la confusión: el
**rol** de Postgres sigue llamándose `anon`, así que las políticas escritas
`for select to anon` son correctas y no hay que "arreglarlas".

**`blocked_range` lo mantiene un trigger, no una columna generada.** Postgres
exige que las columnas generadas sean `IMMUTABLE` y `timestamptz - interval` no
lo es.

**Se desarrolla contra Supabase en la nube, no local.** Docker no arrancaba en
la máquina de desarrollo. Las consecuencias —sin `db reset` seguro, estado
compartido, pruebas que pueden fallar por límite de peticiones— están en
`12-convenciones-de-desarrollo.md`.

**La sesión se verifica con `getClaims()`, no con `getUser()`.** Medido el
2026-09-14: cada ida y vuelta a Supabase (Montreal, `ca-central-1`) cuesta
~200 ms desde Colombia, y cada clic del panel hacía cinco seguidas. `getUser()`
le preguntaba al servidor de Auth dos veces por petición (en `proxy.ts` y en
`lib/tenant.ts`); `getClaims()` verifica la firma del token con la llave
pública ES256, que se guarda en memoria 10 minutos. Membresía y negocio salen
en una sola consulta. `/panel/servicios` pasó de ~1 s a ~0,43 s en local. La
contracara: una sesión cerrada desde otro dispositivo sigue valiendo hasta que
vence su token (1 hora). RLS valida ese mismo token en cada consulta.

**Los formularios del panel se envían con `onSubmit`, no con `action`.** React 19
reinicia un `<form action={...}>` cuando la acción termina, también cuando
devuelve errores de validación: radios y checkboxes volvían en pantalla a su
valor inicial mientras el estado decía otra cosa, y el siguiente envío mandaba
lo que se veía (otro color de servicio, la página publicada u oculta). Todo
formulario nuevo usa `enviarSinReiniciar()` de `lib/formularios.ts`.

**Toda sección del panel muestra un esqueleto al instante** (`app/(admin)/panel/loading.tsx`).
Sin él, la pantalla se quedaba quieta hasta que llegaban los datos. Una sección
nueva no necesita el suyo; si quiere uno propio, va en su carpeta. Ojo: lo que
el layout del panel carga con cookies no lo cubre, así que el layout no debe
sumar consultas lentas.

**La disponibilidad pública se calcula con el cliente privilegiado.** Es el
cuarto caso de uso de `lib/supabase/admin.ts`, además de los tres que lista su
comentario: horarios, bloqueos y citas no son legibles para el anónimo —y así
debe ser—, y el cliente final no tiene sesión que RLS pueda evaluar. Lo que
queda en pie: el `business_id` sale del slug verificado, no del navegador, y de
`lib/booking/disponibilidad.ts` solo salen horas libres.

**El OTP no se guarda: se guarda su HMAC, con la llave secreta de Supabase.** Se
reutiliza esa llave en vez de pedir otra variable de entorno: ya es secreta, ya
vive solo en el servidor y ya es obligatoria para arrancar. El permiso que sale
de verificar es un token firmado con la misma llave, sin tabla que limpiar.

**La cita se crea de una vez, sin apartar el cupo antes.** `holdSlot` no existe:
`appointments.customer_id` no admite nulos y al cliente solo se le conoce
después del código. Lo que impide la doble reserva es la restricción de Postgres,
no una consulta previa. El razonamiento completo, y cómo se arreglaría si hace
falta, en `13-contratos-de-api.md`.

**`Intl` no pone el mismo espacio en Node y en el navegador, y eso rompe la
hidratación.** Según la versión de ICU, el espacio antes de "a. m." es U+202F o
U+00A0. Se ven idénticos, pero para React son textos distintos: un componente de
cliente que muestre una hora revienta la hidratación y **se le caen los
manejadores de eventos a todo el árbol** — en el calendario, los bloques dejaban
de abrirse. Todas las funciones de `lib/formato.ts` normalizan esos espacios, y
hay una prueba que lo vigila. Si una pantalla deja de responder a los clics sin
error visible, mirar acá primero.

**En las pruebas, `server-only` es un módulo vacío.** Ese paquete existe para
que el empaquetador reviente si un módulo de servidor se cuela en el navegador,
y revienta también dentro de vitest, donde todo corre en Node. El alias está en
`vitest.config.mts` y apunta a `tests/server-only.ts`.

**`lib/scheduling` no tiene dependencias, ni siquiera de fechas.** La
conversión de zona horaria son ~35 líneas con `Intl`. Se necesitaba una sola
operación y no valía la pena arrastrar una librería.

## Trampas conocidas

| Síntoma | Qué es |
|---|---|
| Las pruebas fallan y quedan "skipped" | Límite de peticiones de Supabase Auth. Esperar unos minutos. No es un bug |
| `npm run dev` dice que el puerto está ocupado | Quedó un servidor anterior vivo. `taskkill /PID <pid> /F` |
| Aparece un bloque raro al final de `CLAUDE.md` | Lo escribe `next dev` solo. Se vuelve a poner si se borra |
| Un negocio no aparece en su página pública (404) | `is_published` en falso —todo negocio nace oculto y se activa en Perfil del negocio— o `status` en `suspended`/`cancelled`. Es RLS haciendo su trabajo |
| El despliegue de una rama sale rojo por variables faltantes | Las variables están solo en Production. Marcarlas también en Preview |
| Un `update` del dueño sobre `businesses` falla con "permission denied" | La columna no tiene `grant update` para `authenticated`. Es a propósito para `status` y `slug`; para una columna nueva, falta el grant |
| El panel se siente lento en local | Casi todo es red: ~200 ms por consulta hasta Supabase. `next dev` suma ~20% y compila cada ruta la primera vez que se abre. En Vercel (Washington) la base queda cerca, pero la primera visita después de un rato sin uso tarda unos segundos: es la función arrancando en frío |
| `npm run dev` avisa "Slow filesystem detected" | El proyecto está en un disco mecánico o en una carpeta comprimida o sincronizada. Va en `C:\Proyectos\bookia` (SSD). Ver `12-convenciones-de-desarrollo.md` |
| `typecheck` falla con `Type '"/panel/..."' does not satisfy the constraint` | Se agregó un `layout.tsx` o una página y los tipos de rutas de Next están viejos. `npx next typegen` |
| Una pantalla del panel dice "No pudimos cargar esta pantalla" y el registro muestra `PGRST201` | Hay dos llaves foráneas entre las mismas dos tablas y la consulta con datos relacionados (`staff_services(...)`) no sabe cuál usar. Dejar una sola llave; si hacen falta las dos, nombrar la relación: `staff_services!nombre_de_la_llave(...)` |
| Una sección del menú dice "Pronto" y no abre | Es a propósito: todavía no existe. Se activa en `components/admin/navegacion.ts` al terminar su tarea |
| Un negocio con slug `registro`, `bienvenida`, etc. no se puede crear | Slugs reservados por rutas de la aplicación. Una ruta nueva de primer nivel va en `slug_es_reservado()` |
| El código de WhatsApp nunca llega | Falta `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_ID`: el canal está en modo consola y el código sale en el registro del servidor (`[whatsapp] SIN CREDENCIALES`). La pantalla del código lo avisa |
| Reservar falla con "Alguien acaba de tomar esa hora" | Es la restricción `appointments_sin_solapamiento` haciendo su trabajo. No es un error: la interfaz recarga cupos sola |
| Una pantalla se ve bien pero no responde a los clics | Casi siempre es un error de hidratación, y casi siempre son los espacios de `Intl`. Ver la decisión sobre `lib/formato.ts` arriba. La consola del navegador lo dice, la terminal no |
| La agenda no se actualiza sola | La tabla tiene que estar en la publicación `supabase_realtime` (migración `20260916120001`). Realtime respeta RLS, así que si la sesión no puede leer la fila, tampoco le llega el evento |

## Cómo mantener esto vivo

Al cerrar cada tarea del backlog:

1. Marcarla en `03-backlog.md` y actualizar la tabla de avance.
2. Si cambió algo descrito en `docs/`, corregirlo **en el mismo cambio**.
3. Si fue una decisión de arquitectura, escribir un ADR.
4. Actualizar la sección "Avance" y "Qué sigue" de este documento.
5. **Hacer commit y push.** Sin eso, nada de lo anterior existe fuera de esta
   máquina.
