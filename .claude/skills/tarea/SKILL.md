---
name: tarea
description: Flujo completo para trabajar una tarea del backlog de Bookia (ej. "/tarea G3", "trabajemos en H1", "sigamos con la siguiente tarea"). Lee criterios y documentos, crea o verifica la rama, planea la versión más simple, implementa con las reglas del proyecto, prueba y deja lista la definición de terminado.
argument-hint: <ID de tarea, ej. G3>
---

# Trabajar una tarea del backlog

Tarea pedida: **$ARGUMENTS** (si viene vacío, propone la siguiente según
"Qué sigue" de `docs/14-estado-actual.md` y el orden de épicas de
`docs/03-backlog.md`, y confirma con el usuario antes de empezar).

## 1. Entender (antes de escribir código)

1. Busca la fila y la sección de la tarea en `docs/03-backlog.md`: criterios de
   aceptación, notas, lo que quedó "fuera a propósito" en tareas vecinas.
2. Lee los documentos del tema. Guía rápida:
   | Tema | Documentos |
   |---|---|
   | Cupos, horarios, reservas | `06-motor-de-agendamiento.md`, `13-contratos-de-api.md` |
   | Tablas nuevas o cambios de esquema | `07-modelo-de-datos.md`, `05-arquitectura-multitenant.md` |
   | Panel, pantallas | `02-usuarios-y-flujos.md`, `15-sistema-de-diseno.md` |
   | Contabilidad (H) | `07` (ledger), backlog H1–H5 |
   | Notificaciones (I) | `09-notificaciones.md` |
   | Suscripciones (J) | `08-pagos-y-suscripciones.md`, `adr/0002` |
3. Lee `docs/14-estado-actual.md` → "Decisiones que se tomaron sobre la marcha"
   y "Trampas conocidas". Muchas tareas ya tienen media solución ahí (ej. G4:
   `reprogramarPorToken` ya existe).
4. Mira el código existente que se reusa. **No dupliques**: si ya hay una
   función que hace el 80 %, se extiende.
5. Si hay trabajo sin commit (`git status`), averigua si es de esta tarea antes
   de tocar nada.

## 2. Rama

- Formato `feat/<ID>-descripcion-corta` (o `fix/`, `docs/`). Si ya estás en
  otra rama con cambios sin commit, **pregunta** antes de cambiar.
- Nunca trabajes en `main`.

## 3. Plan (corto, al usuario)

- **La versión más simple que cumple el objetivo del negocio** (criterio del
  backlog y preferencia del usuario). Lo opcional se anota para después, no se
  construye.
- Lista: archivos a crear/tocar, migración sí/no, pruebas, docs a actualizar.
- Si hay una decisión de producto abierta (algo que los criterios no dicen),
  pregúntala ahora con opciones concretas, no a mitad del trabajo.
- Para una tarea grande, usa el modo plan.

## 4. Implementar

Sigue la skill `patrones-bookia` (Server Actions, `Result`, Zod, tenant,
formularios) y `diseno-bookia` para interfaz. Recordatorios que más se olvidan:

- El negocio sale de `requireDueno()` / `requireNegocio()` (`lib/tenant.ts`) o de
  `getNegocioPublico(slug)`. Nunca del navegador.
- Precio y duración de la cita se copian del servicio **en el servidor**.
- Nada con historia se borra.
- Horas: UTC en la base, zona del negocio al mostrar, con `lib/formato.ts`.
- Esquema: skill `migracion`. Motor: agente `revisor-motor`.
- Texto al usuario en español de Colombia, claro para alguien no técnico.
- Sección nueva del menú: `disponible: true` en `components/admin/navegacion.ts`.

Los hooks revisan cada archivo; si uno bloquea, corrige la causa, no la
esquives.

## 5. Probar

- Pruebas de lo que importa (agente `escritor-de-pruebas` si es mucho).
- `npm run test`, `npm run typecheck`, `npm run lint`, y `npm run build` al final.
- Si hay interfaz: agente `qa-explorador` sobre las pantallas tocadas (375 px).

## 6. Cerrar

Ejecuta la skill `cerrar-tarea`. No marques la tarea como Hecho si falta algo de
la definición de terminado: dilo.
