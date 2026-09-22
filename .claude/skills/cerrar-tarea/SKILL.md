---
name: cerrar-tarea
description: Cierra una tarea del backlog de Bookia con la definición de terminado de docs/12 - verificación completa, revisión de seguridad, backlog y estado actualizados, commit con Conventional Commits y texto del pull request. Usar al terminar una tarea ("cerremos G3", "ya quedó, cierra la tarea").
argument-hint: <ID de tarea, opcional si la rama lo dice>
---

# Cerrar una tarea

Tarea: **$ARGUMENTS** (si está vacío, sale del nombre de la rama:
`feat/G3-...` → G3).

## 1. Verificación automática

Corre y reporta el resultado real de cada uno (si algo falla, se para aquí):

```bash
npm run typecheck
npm run lint
npm run test        # si hay "skipped" por límite de Auth de Supabase, espera y repite; no es un bug
npm run build
```

Si `typecheck` falla por tipos de rutas (`does not satisfy the constraint`):
`npx next typegen`.

## 2. Revisión

En paralelo, con el diff de la rama (`git diff main...HEAD` + archivos sin seguimiento):

- Agente `guardian-multitenant` — siempre.
- Agente `revisor-migraciones` — si hay archivos en `supabase/migrations/`.
- Agente `revisor-motor` — si tocó `lib/scheduling`, `lib/agenda` o disponibilidad.
- Agente `guardian-docs` — siempre.

Corrige los bloqueantes. Las observaciones, al usuario.

## 3. Definición de terminado (docs/12)

Recorre la lista y marca cada casilla con evidencia, no de memoria:

**Funciona**
- [ ] Cumple cada criterio de aceptación del backlog (cítalos uno por uno)
- [ ] Probado a mano en la **vista previa de Vercel**, no solo en local → esto lo
      hace el usuario después del push; déjalo como pendiente explícito
- [ ] Se ve bien a 375 px (agente `qa-explorador` o verificación manual)
- [ ] Estados de carga y de error resueltos

**Es seguro**
- [ ] Tabla nueva: `business_id`, RLS, políticas, índice
- [ ] Ningún `business_id` desde el navegador
- [ ] Entrada externa validada con Zod
- [ ] Cliente privilegiado solo en los casos permitidos

**Está probado**
- [ ] Lógica pura con pruebas de bordes
- [ ] Cobros/notificaciones: camino de fallo probado
- [ ] `test` y `build` pasan · la prueba de aislamiento sigue pasando

**Está documentado**
- [ ] `docs/` actualizado en el mismo cambio si cambió comportamiento
- [ ] ADR si fue decisión de arquitectura (skill `adr`)
- [ ] Backlog actualizado

## 4. Documentos

1. `docs/03-backlog.md`: estado `**Hecho**`, tabla de avance por épica y total,
   y una nota "Cerrada el AAAA-MM-DD" con lo que quedó y lo que quedó fuera a
   propósito (el estilo de las tareas ya cerradas).
2. `docs/14-estado-actual.md`: "Última actualización", "Avance", "Lo que ya
   funciona", número de pruebas, "Qué sigue", y decisiones o trampas nuevas.
3. Otros documentos que describan lo que cambió.

## 5. Commit y PR

- Muestra al usuario `git status` y el resumen antes de hacer commit.
- Commit en Conventional Commits, en español, con cuerpo que explique el porqué,
  y `Closes <ID>` al final (más la línea de coautoría que indique el sistema).
- `git push` pide confirmación: explícale que es una rama y abre vista previa.
- Redacta el texto del pull request: qué hace, cómo probarlo en la vista previa,
  qué quedó fuera, casillas de la definición de terminado. No hay `gh` en esta
  máquina: dale el texto para pegarlo en GitHub.

Si algo de la definición de terminado no se cumple, la tarea queda **En revisión**,
no Hecho, y se dice qué falta.
