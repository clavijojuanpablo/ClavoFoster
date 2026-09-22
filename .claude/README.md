# `.claude/` — cómo trabaja Claude Code en Bookia

Configuración compartida del equipo (va en git). Lo personal va en
`.claude/settings.local.json`, que no se versiona.

## Flujo de una tarea

```
/estado            ¿dónde íbamos?
/tarea G3          entender → rama → plan mínimo → implementar → probar
/revisar           seguridad multi-tenant + especialistas, en paralelo
/qa G3             prueba en el navegador, 375 px, bugs con pasos
/cerrar-tarea      definición de terminado, backlog, estado, commit, texto del PR
```

## Comandos (skills)

| Comando | Para qué |
|---|---|
| `/tarea <ID>` | Trabajar una tarea del backlog de punta a punta |
| `/cerrar-tarea [ID]` | Definición de terminado de docs/12, docs al día, commit y PR |
| `/revisar [alcance]` | Revisión en el orden de docs/12, con agentes en paralelo |
| `/qa <ruta\|flujo\|ID>` | QA exploratorio en Chrome |
| `/migracion <cambio>` | Migración SQL con RLS, tipos, docs/07 y prueba de aislamiento |
| `/depurar <síntoma>` | Empieza por las trampas conocidas de docs/14 |
| `/proponer [área]` | Mejoras y prioridades con criterio de negocio |
| `/adr <decisión>` | Registro de decisión en docs/adr |
| `/verificar-costos [proveedor]` | Tarifas actuales con fuente y fecha → docs/10 |
| `/estado` | Resumen corto y siguiente paso |

Claude carga solo, sin comando, `patrones-bookia` (servidor) y `diseno-bookia`
(interfaz) cuando escribe ese tipo de código.

## Agentes

| Agente | Qué hace | Edita |
|---|---|---|
| `guardian-multitenant` | Fugas entre negocios, datos del navegador, secretos, datos personales | No |
| `revisor-migraciones` | SQL: RLS, tipos, llaves, índices, grants | No |
| `revisor-motor` | Motor de cupos contra docs/06; escribe pruebas de bordes | Pruebas |
| `qa-explorador` | Prueba en Chrome como dueño o cliente final | No |
| `escritor-de-pruebas` | Vitest en el estilo del repo | Sí |
| `estratega-producto` | Propuestas y prioridades | No |
| `guardian-docs` | Encuentra dónde los documentos mienten | No |

## Hooks (automáticos)

| Cuándo | Script | Qué hace |
|---|---|---|
| Al abrir sesión | `inicio-de-sesion.mjs` | Rama, tarea de la rama, avance del MVP, pendientes M |
| Antes de escribir | `guardia-previa.mjs` | **Frena**: editar `.env*`, crear `middleware.ts`, secretos con `NEXT_PUBLIC_`, llaves literales, llaves viejas de Supabase. **Pregunta**: editar una migración ya versionada |
| Antes de un comando | `guardia-bash.mjs` | **Frena**: `db reset --linked`, `push --force`, commits fuera de Conventional Commits, `.env.local` en git. **Pregunta**: `db push`, commit en main, push a main, `reset --hard` |
| Después de escribir | `revisar-archivo.mjs` | Revisa las reglas de CLAUDE.md en el archivo (ver abajo) |
| Al terminar | `verificar-al-terminar.mjs` | `tsc` + pruebas sin base si el árbol cambió; si fallan, Claude sigue hasta arreglarlo |

`revisar-archivo.mjs` **devuelve para corregir**:
- Migraciones: `timestamp` sin zona, dinero que no es `bigint`, tabla sin RLS o
  sin `business_id`, `delete` sobre tablas con historia, `security definer` sin `search_path`.
- `lib/scheduling` y `lib/agenda`: imports de IO/framework, `Date.now()`.
- Código: cliente privilegiado fuera de los lugares permitidos, `business_id`
  desde el navegador, `.delete()` sobre tablas con historia, precio o duración
  desde el formulario, código de servidor en `'use client'`.

Y **avisa** (sin frenar): catch vacío, datos personales en `console.*`,
`<form action>` con radios, horas con `Intl` en cliente, hex sueltos, `Bookia`
escrito a mano, `getUser()` en el panel, Server Action sin Zod, ruta de primer
nivel sin reservar su slug, índices y políticas faltantes.

Las reglas son heurísticas. Si una marca algo legítimo, se ajusta la regla (y
se documenta la excepción en el script), no se desactiva el hook.

## Permisos

`settings.json` deja correr sin preguntar pruebas, typecheck, lint, build y git
de solo lectura; pide confirmación para `db:push`, `db:seed` y `git push`; y
niega leer o editar `.env.local`.

## Requisitos

Node (el mismo del proyecto). Sin `jq` ni otras dependencias: los hooks corren
igual en Git Bash y en PowerShell.
