---
name: proponer
description: Propone mejoras y nuevas funciones para Bookia, o prioriza lo que falta, con criterio de negocio (vender, retener, reducir no-shows) y esfuerzo real. Úsala con "¿qué deberíamos hacer ahora?", "propón mejoras", "¿vale la pena X?", "¿qué le falta al producto para vender?".
argument-hint: <opcional - área o pregunta concreta>
---

# Proponer

Pregunta o área: **$ARGUMENTS** (si está vacío: "¿qué es lo más valioso que
podemos hacer en las próximas dos semanas para llegar a la primera venta?").

## 1. Recoge la evidencia (en paralelo)

- Agente `estratega-producto` con la pregunta, para la mirada de negocio y
  mercado colombiano.
- Tú, mientras tanto, revisa el estado técnico real: `docs/14-estado-actual.md`
  ("Qué sigue", pendientes antes de un cliente real), el backlog M pendiente, y
  deuda visible en el código (`TODO`, "Pendiente conocido", trampas repetidas).

## 2. Síntesis

Junta las dos miradas en una sola lista corta (máximo 5–7 propuestas):

```
### 1. Nombre — Hacer ya | Siguiente | Después | No hacer
Por qué: problema de quién, cómo se nota en plata
Versión mínima: ...
Esfuerzo: N días · Depende de: IDs
```

Incluye, si aplica, los bloqueos no técnicos que frenan vender: plantillas de
WhatsApp con Meta, confirmación de correo (Resend), proyecto de Supabase de
producción, `pg_cron`, política de datos (Ley 1581, con abogado).

## 3. Si el usuario acepta alguna

- Tarea nueva o cambio de prioridad → propón la edición de `docs/03-backlog.md`
  (ID en la épica que corresponda, prioridad MoSCoW, criterios de aceptación).
- Algo para después del MVP → `docs/11-roadmap.md`.
- Una decisión de arquitectura → skill `adr`.

No edites el backlog sin que el usuario lo apruebe: es su documento de control.
