---
name: qa
description: Sesión de QA de Bookia - prueba en el navegador una pantalla, un flujo o una tarea recién hecha, como dueño o como cliente final, en celular (375 px) y escritorio. Encuentra bugs y los reporta con pasos para reproducir. Úsala con "prueba la agenda", "haz QA de la reserva", "busca errores en /panel/servicios".
argument-hint: <ruta, flujo o ID de tarea>
---

# QA

Qué probar: **$ARGUMENTS** (si está vacío: lo que cambió en la rama, deducido de
`git diff main...HEAD --stat`).

## 1. Prepara el plan de prueba

- Si es una tarea, saca los criterios de aceptación de `docs/03-backlog.md` y
  conviértelos en casos verificables.
- Agrega siempre: 375 px, error de validación, estado vacío, doble envío,
  consola sin errores de hidratación, y los bordes de dinero/horas.
- Para la reserva pública: servicio → persona (incluida "el primero
  disponible") → día → hora → código (sale en la terminal de `npm run dev`,
  modo consola) → confirmación → link `/cita/<token>` → mover → cancelar.
- Para el panel: entra con `demo@barberia.test` / `demo12345` (solo proyecto
  de desarrollo).

## 2. Delega la ejecución

Lanza el agente `qa-explorador` con el plan, la URL base (`http://localhost:3000`
o la vista previa de Vercel si el usuario la da) y lo que no debe tocar.

Si además hay lógica nueva sin pruebas automáticas, lanza en paralelo
`escritor-de-pruebas` con los casos que salieron del plan.

## 3. Con el informe

- Ordena los bugs por gravedad.
- Para cada uno grave o medio, busca la causa probable en el código (archivo y
  línea) antes de presentarlo.
- Pregunta cuáles se arreglan ahora. Un bug que se arregla lleva primero una
  prueba que lo reproduzca, si es lógica (no interfaz).
