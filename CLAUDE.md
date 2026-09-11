# CLAUDE.md

Contexto permanente del proyecto. Léelo antes de escribir cualquier código.

## Qué es esto

SaaS multi-tenant de agendamiento y administración para negocios de belleza y
salud en Colombia: barberías, peluquerías, spas, tatuadores, cosmetología.

Tres superficies, un solo repositorio:

| Superficie | Quién la usa | Cómo se accede |
|---|---|---|
| Página pública de reserva | Cliente final | Navegador, sin instalar nada, sin contraseña |
| Panel de administración | Dueño del negocio | Navegador + PWA instalable en el celular |
| Vista de agenda | Trabajador (barbero, estilista) | Navegador + PWA |

Modelo de negocio: suscripción mensual que paga el **negocio**. El cliente final
nunca paga por usar la plataforma.

**El producto no tiene nombre comercial todavía.** En el código y los documentos
se le dice "la Plataforma".

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** en modo estricto
- **Supabase**: Postgres, Auth, Storage, Realtime, Edge Functions
- **Vercel** para hosting
- **Tailwind CSS** + **shadcn/ui** para la interfaz
- **Mercado Pago Suscripciones** para el cobro recurrente al negocio
- **WhatsApp Cloud API** (Meta, directo) para OTP y notificaciones
- **Resend** para email transaccional
- **Zod** para validación en el borde de cada entrada
- **Vitest** (unitario) + **Playwright** (end to end)

Justificación de cada pieza y lo que se descartó: `docs/04-stack-tecnologico.md`.

## Reglas no negociables

Estas cinco reglas no se discuten en un pull request. Si algo las viola, se
devuelve.

**1. Toda tabla de negocio lleva `tenant_id` y tiene Row Level Security activa.**
El aislamiento entre negocios lo garantiza la base de datos, no el código de la
aplicación. Una tabla nueva sin política RLS es un incidente de seguridad, no un
detalle pendiente. Ver `docs/05-arquitectura-multitenant.md`.

**2. El `tenant_id` jamás viene del cliente.**
Ni de un campo de formulario, ni de un parámetro de URL, ni de un header. Se
deriva siempre en el servidor desde la sesión o desde el slug público
verificado. Aceptar un `tenant_id` enviado por el navegador es dejar que
cualquiera lea la agenda de otro negocio.

**3. Todo instante de tiempo se guarda en UTC, en columnas `timestamptz`.**
La zona horaria vive en el negocio (`businesses.timezone`, ej.
`America/Bogota`) y solo se aplica al mostrar y al interpretar lo que el usuario
escribe. Nunca guardes hora local. Nunca uses `timestamp` sin zona.

**4. El precio y la duración de un servicio se copian a la cita al reservar.**
Si el dueño sube el precio del corte mañana, las citas de ayer no pueden
cambiar de valor — la contabilidad quedaría corrupta. La cita guarda su propio
`price_cop` y `duration_minutes`.

**5. Nunca se borra información con historia. Se marca.**
Servicios, trabajadores y clientes se desactivan (`is_active = false`) o se
archivan, no se eliminan. Un `DELETE` sobre un trabajador con citas pasadas
destruye la contabilidad del negocio.

## Dinero

Todo valor monetario se guarda como **entero en pesos colombianos** (`bigint`),
nunca como decimal ni como float. El peso colombiano no usa centavos en la
práctica. Una columna se llama `*_cop` para que sea evidente.

## Estructura de carpetas

```
/app                 Rutas de Next.js (App Router)
  /(public)          Página de reserva del cliente — sin sesión
  /(admin)           Panel del dueño y del trabajador — con sesión
  /api               Webhooks entrantes (pasarela, WhatsApp)
/components          Componentes de interfaz
  /ui                shadcn/ui, sin lógica de negocio
/lib
  /supabase          Clientes de Supabase (servidor, navegador, admin)
  /scheduling        Motor de cupos — lógica pura, sin dependencias de IO
  /billing           Interfaz de pagos y adaptadores por pasarela
  /notifications     WhatsApp y email
/supabase
  /migrations        Migraciones SQL versionadas
/docs                Definición del producto
/tests
```

Regla de dependencias: `lib/scheduling` es **lógica pura**. No importa Supabase,
no importa Next.js, no lee la hora del sistema. Recibe datos y devuelve datos.
Es lo que hace que se pueda probar bien y lo que protege la parte más delicada
del producto. Ver `docs/06-motor-de-agendamiento.md`.

## Convenciones

- Tablas y columnas en `snake_case` y en inglés. Texto visible al usuario, en
  español.
- Commits en formato Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:`.
- Una rama por tarea del backlog: `feat/A3-horarios-trabajador`.
- Cada pull request referencia el ID de la tarea del backlog que cierra.

Detalle completo, incluida la definición de terminado:
`docs/12-convenciones-de-desarrollo.md`.

## Índice de la documentación

| Documento | Para qué sirve |
|---|---|
| `docs/00-vision-y-negocio.md` | Qué problema resolvemos y a quién le vendemos |
| `docs/01-modelo-de-negocio-y-precios.md` | Planes, precios y márgenes |
| `docs/02-usuarios-y-flujos.md` | Los cuatro roles y sus recorridos |
| `docs/03-backlog.md` | **Control de avance. Empieza aquí para trabajar.** |
| `docs/04-stack-tecnologico.md` | Qué se eligió y qué se descartó |
| `docs/05-arquitectura-multitenant.md` | Cómo se aíslan 100 negocios en una base |
| `docs/06-motor-de-agendamiento.md` | El algoritmo de cupos |
| `docs/07-modelo-de-datos.md` | Tablas, relaciones y restricciones |
| `docs/08-pagos-y-suscripciones.md` | Cobro recurrente, prueba gratis, mora |
| `docs/09-notificaciones.md` | Plantillas de WhatsApp y cuándo se disparan |
| `docs/10-costos-de-infraestructura.md` | Cuánto cuesta operar esto |
| `docs/11-roadmap.md` | Fases y qué queda fuera del MVP |
| `docs/12-convenciones-de-desarrollo.md` | Cómo se trabaja en este repositorio |
| `docs/13-contratos-de-api.md` | Firma de cada endpoint y Server Action |
| `docs/adr/` | Decisiones de arquitectura y por qué se tomaron |

## Advertencias para quien escriba código aquí

- **No inventes precios ni tarifas de proveedores.** Las cifras de
  `docs/10-costos-de-infraestructura.md` tienen fecha de verificación. Si
  necesitas una cifra actual, búscala.
- **El motor de cupos es la parte más delicada del producto.** Cualquier cambio
  ahí necesita pruebas unitarias que cubran los casos de
  `docs/06-motor-de-agendamiento.md`, incluidos los bordes.
- **Las llaves secretas (`SUPABASE_SECRET_KEY`, tokens de Meta y de la pasarela)
  jamás se exponen al navegador.** Solo viven en el servidor. Supabase usa el
  esquema nuevo de llaves —`sb_publishable_...` y `sb_secret_...`—, no las
  antiguas `anon` y `service_role`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
