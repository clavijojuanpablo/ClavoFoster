---
name: depurar
description: Depura un error o comportamiento raro en Bookia empezando por las trampas ya conocidas del proyecto (hidratación por Intl, middleware ignorado, PGRST201, grants, límite de Auth, RLS que oculta filas, Realtime, variables de entorno en Vercel). Úsala con un mensaje de error, "no funciona", "la pantalla no responde", "falla en Vercel pero no en local".
argument-hint: <síntoma o mensaje de error>
---

# Depurar

Síntoma: **$ARGUMENTS**

## 1. ¿Es una trampa conocida?

Compara con la tabla "Trampas conocidas" de `docs/14-estado-actual.md` antes de
buscar en el código. Las más frecuentes:

| Síntoma | Primera sospecha |
|---|---|
| Se ve bien pero no responde a clics | Error de hidratación, casi siempre espacios de `Intl` (U+202F vs U+00A0). Consola del navegador, no la terminal. Formatear con `lib/formato.ts` |
| Panel sin proteger | Alguien creó `middleware.ts`; en Next 16 es `proxy.ts` |
| "No pudimos cargar esta pantalla" + `PGRST201` | Dos llaves foráneas entre las mismas tablas; nombrar la relación |
| `permission denied` al actualizar `businesses` | Falta `grant update (columna)` |
| Pruebas "skipped" | Límite de Supabase Auth; esperar |
| 404 en la página pública | `is_published` falso o `status` suspendido: RLS haciendo su trabajo |
| Build rojo en rama de Vercel | Variables solo en Production; marcarlas en Preview |
| `typecheck` con rutas `/panel/...` | `npx next typegen` |
| Agenda no se actualiza sola | Tabla fuera de `supabase_realtime` o RLS no deja leer la fila |
| Código de WhatsApp no llega | Modo consola: el código está en la terminal |
| "Alguien acaba de tomar esa hora" | `appointments_sin_solapamiento`: correcto, no es bug |
| Radios/checkbox vuelven al valor inicial | `<form action>`; usar `enviarSinReiniciar()` |
| Consulta devuelve vacío sin error | RLS filtrando: ¿sesión correcta? ¿negocio correcto? ¿política existe? |

## 2. Si no lo es: método

1. **Reproduce** con el mínimo: ruta, datos, pasos. Si es lógica, una prueba
   que falle.
2. **Aísla**: ¿servidor o navegador? ¿local o Vercel? ¿un negocio o todos?
   ¿desde cuándo? (`git log -p` del área).
3. **Diagnostica** con evidencia (logs, consola, red, consulta), no con
   suposiciones. Para Next 16, revisa la guía en `node_modules/next/dist/docs/`
   antes de asumir una API.
4. **Corrige la causa**, no el síntoma. Prueba que lo cubra si es lógica.
5. **Si fue sorpresivo**, agrégalo a "Trampas conocidas" en docs/14 para que el
   próximo no pierda el mismo tiempo.
