---
name: estado
description: Resumen corto de dónde va Bookia - rama y cambios en curso, avance del MVP, siguiente tarea recomendada y bloqueos antes de vender. Úsala al retomar el trabajo o con "¿dónde íbamos?", "¿qué sigue?", "estado del proyecto".
---

# Estado

Reúne, sin inventar nada que no esté en el repo:

1. `git status --porcelain`, rama actual, `git log --oneline -8`, y si la rama
   tiene commits que no están en `main` (`git log main..HEAD --oneline`).
2. Tarea de la rama (ID en el nombre) y su fila en `docs/03-backlog.md`.
3. Tabla de avance del backlog y "Qué sigue" de `docs/14-estado-actual.md`.
4. Trabajo sin commit: qué parece ser (lee los diffs por encima) y a qué tarea
   pertenece.
5. Pendientes antes de un cliente real que sigan abiertos en docs/14.

Responde en este formato, corto:

```
**Rama:** feat/G3-... — G3 Crear cita manual (En curso)
**Sin commit:** 3 archivos — parece ser <qué>
**MVP:** 30/57 · Épicas completas: A, E, F

**Siguiente paso recomendado:** <uno solo, concreto>

**Antes de vender (abierto):**
- ...
```

Si encuentras que los documentos se contradicen (ej. el conteo del backlog vs
docs/14), dilo en una línea.
