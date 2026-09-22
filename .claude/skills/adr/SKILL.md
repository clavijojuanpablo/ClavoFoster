---
name: adr
description: Escribe un registro de decisión de arquitectura (ADR) en docs/adr/ con el formato del proyecto. Úsala cuando se tome una decisión que cambia cómo se construye Bookia (proveedor, patrón, estructura de datos, algo que costaría deshacer) o con "documenta esta decisión", "hagamos un ADR".
argument-hint: <título de la decisión>
---

# ADR

Decisión: **$ARGUMENTS**

1. Lee los ADR existentes en `docs/adr/` para numerar (`NNNN`, siguiente al
   último) y copiar el formato exacto.
2. Nombre del archivo: `docs/adr/NNNN-titulo-en-kebab-case.md`.
3. Estructura (la que usan los existentes):

```markdown
# ADR NNNN — Título que dice la decisión, no el tema

- **Fecha:** AAAA-MM-DD
- **Estado:** Propuesta | Aceptada | Reemplazada por NNNN

## Contexto
Qué problema hay y qué restricciones mandan (mercado, costo, equipo de dos).
Cifras con fecha de verificación y fuente; nada inventado.

## Decisión
Una frase en negrita con lo que se decidió. Luego el detalle.

## Alternativas consideradas
Cada una con por qué se descartó.

## Consecuencias
Lo que se gana, lo que se pierde, y cuándo se reconsidera.
```

4. Si la decisión cambia algo descrito en otro documento (`04-stack`, `05`,
   `07`...), actualízalo en el mismo cambio y enlaza el ADR desde ahí.
5. Si es una decisión pequeña que no merece ADR, va en `docs/14-estado-actual.md`
   → "Decisiones que se tomaron sobre la marcha". Dile al usuario cuál de las
   dos aplica si no es obvio.
