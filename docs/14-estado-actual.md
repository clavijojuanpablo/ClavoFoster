# 14 — Estado actual y cómo retomar

> **Empieza por acá si vuelves al proyecto después de un tiempo, o si eres
> alguien nuevo.** Este documento se actualiza al terminar cada tarea.
>
> Última actualización: 2026-09-11

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

**10 de 55 tareas del MVP.** El detalle vive en `03-backlog.md`; acá va el resumen.

| Épica | Estado |
|---|---|
| A — Fundación técnica | 5 de 6. Falta solo A6 (despliegue en Vercel), aplazado a propósito |
| **E — Motor de agendamiento** | **Completa** |
| B, C, D, F, G, H, I, J, K | Sin empezar |

**El esquema de datos está completo para todo el MVP.** Las épicas B, C, D y H
ya no necesitan tocar la base salvo ajustes menores.

### Lo que ya funciona

- `/[slug]` — página pública del negocio, sin sesión
- `/login` — ingreso con correo y contraseña
- `/panel` — panel protegido, con las próximas citas
- `/api/cron/cleanup-holds` — libera retenciones vencidas
- `lib/scheduling/` — el motor de cupos, con 28 pruebas

### Qué sigue

**Épica F (reserva pública)** es lo que más rinde: conecta el motor con la base
y convierte `/[slug]` en una página donde de verdad se reserva. Es lo primero
que se le puede mostrar a un dueño de barbería.

La alternativa es la **épica D** (horarios y bloqueos desde el panel), que hoy
solo existen porque los creó el seed.

## Entorno

| Qué | Valor |
|---|---|
| Proyecto Supabase (desarrollo) | `pubpfmsgwnyuhxleaysr` |
| Repositorio | `github.com/clavijojuanpablo/ClavoFoster` |
| Negocio de demostración | `/barberia-demo` |
| Usuario de demostración | `demo@barberia.test` / `demo12345` |

> Esas credenciales son **solo del proyecto de desarrollo** y las crea
> `npm run db:seed`. No existen en producción.

`.env.local` **no está en el repositorio** y nunca debe estarlo. Sus valores se
sacan del dashboard de Supabase: Project Settings → API Keys.

## Despliegue

Vercel está conectado al repositorio: cada `push` a `main` dispara un
despliegue.

**El build FALLA si faltan variables de entorno.** Es a propósito —
`lib/env.ts` valida al arrancar, para que un secreto faltante se descubra en el
despliegue y no cuando un cliente intente reservar. Hay que configurarlas en
Project Settings → Environment Variables:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Ídem, la llave *publishable* |
| `SUPABASE_SECRET_KEY` | Ídem, la llave *secret*. **Nunca con prefijo público** |
| `NEXT_PUBLIC_APP_URL` | La URL que asigne Vercel, no `localhost` |
| `CRON_SECRET` | `openssl rand -hex 32`, o el mismo de `.env.local` |

> **Este primer despliegue apunta al proyecto de DESARROLLO de Supabase.**
> Sirve para mostrar el producto, no para negocios reales. Antes de la primera
> venta hay que crear un proyecto de producción aparte y apuntar Vercel allá.
> Ver `12-convenciones-de-desarrollo.md`.

**Trabajos programados: todavía no hay ninguno configurado.**
`/api/cron/cleanup-holds` existe y funciona, pero nadie lo llama solo. Ojo con
esto al configurarlo: el plan gratuito de Vercel solo permite tareas
programadas **una vez al día**, y una limpieza diaria de retenciones de 10
minutos no sirve de nada. Lo correcto es `pg_cron` dentro de Supabase, como
dice `04-stack-tecnologico.md`. No es urgente: las retenciones todavía no se
crean, eso llega con la épica F.

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

**`lib/scheduling` no tiene dependencias, ni siquiera de fechas.** La
conversión de zona horaria son ~35 líneas con `Intl`. Se necesitaba una sola
operación y no valía la pena arrastrar una librería.

## Trampas conocidas

| Síntoma | Qué es |
|---|---|
| Las pruebas fallan y quedan "skipped" | Límite de peticiones de Supabase Auth. Esperar unos minutos. No es un bug |
| `npm run dev` dice que el puerto está ocupado | Quedó un servidor anterior vivo. `taskkill /PID <pid> /F` |
| Aparece un bloque raro al final de `CLAUDE.md` | Lo escribe `next dev` solo. Se vuelve a poner si se borra |
| Un negocio no aparece en su página pública | `is_published` en falso o `status` distinto de `active`. Es RLS haciendo su trabajo |

## Cómo mantener esto vivo

Al cerrar cada tarea del backlog:

1. Marcarla en `03-backlog.md` y actualizar la tabla de avance.
2. Si cambió algo descrito en `docs/`, corregirlo **en el mismo cambio**.
3. Si fue una decisión de arquitectura, escribir un ADR.
4. Actualizar la sección "Avance" y "Qué sigue" de este documento.
5. **Hacer commit y push.** Sin eso, nada de lo anterior existe fuera de esta
   máquina.
