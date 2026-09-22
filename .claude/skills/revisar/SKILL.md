---
name: revisar
description: Revisión de código de Bookia con el orden de docs/12 (fuga entre negocios, confianza en el navegador, qué pasa cuando falla, regresiones, y al final estilo). Úsala antes de un commit o PR, o cuando el usuario pida "revisa esto", "¿está bien?", "busca errores". Lanza los agentes especialistas que correspondan en paralelo.
argument-hint: <opcional - archivo, carpeta o "rama">
---

# Revisión

Alcance: **$ARGUMENTS** — si está vacío, los cambios de la rama contra `main`
más lo que está sin commit:

```bash
git diff main...HEAD --stat; git status --porcelain; git diff
```

## 1. Decide qué especialistas hacen falta

| Si el cambio toca... | Agente |
|---|---|
| Cualquier cosa en `app/`, `lib/`, `proxy.ts`, migraciones | `guardian-multitenant` (siempre) |
| `supabase/migrations/` | `revisor-migraciones` |
| `lib/scheduling`, `lib/agenda`, disponibilidad, zonas horarias | `revisor-motor` |
| Pantallas o componentes | `qa-explorador` (si el usuario quiere prueba en navegador) |
| `docs/` o comportamiento descrito en docs | `guardian-docs` |

Lánzalos **en paralelo** en un solo mensaje, cada uno con el alcance exacto.

## 2. Mientras tanto, revisa tú lo que no es de ningún especialista

En el orden de docs/12 → "Revisión de pull request":

1. **¿Filtra datos entre negocios?**
2. **¿Confía en algo del navegador?** Precio, duración, ids.
3. **¿Qué pasa cuando falla?** Sin red, datos vacíos, Supabase caído, doble
   clic, cupo tomado entre que se vio y se confirmó (`SLOT_TAKEN` → recarga
   cupos, no pantalla de error). Errores esperados como resultados, no
   excepciones. Mensajes en español que dicen qué hacer.
4. **¿Rompe algo que ya funcionaba?** Busca quién más usa lo que cambió
   (`Grep` de la función/tipo). Revisa las "Trampas conocidas" de docs/14:
   hidratación por `Intl`, `<form action>`, `PGRST201`, grants de `businesses`,
   `middleware.ts`, rutas de primer nivel sin reservar el slug.
5. Recién después: legibilidad, duplicación, nombres (código en inglés, texto
   en español; `camelCase`, `_cop`, `_at`, `is_`).

## 3. Informe único

Junta los resultados de los agentes y los tuyos, sin repetir:

```
## Veredicto: BLOQUEA | LISTO CON OBSERVACIONES | LISTO

### Bloqueantes (puntos 1–4)
1. archivo:línea — problema → escenario → arreglo

### Sugerencias (punto 5)
### Verificado
```

Pregunta si se corrigen los bloqueantes ahora. No los corrijas sin avisar si el
arreglo cambia comportamiento.
