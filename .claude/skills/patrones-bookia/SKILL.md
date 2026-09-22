---
name: patrones-bookia
description: Patrones de código del servidor en Bookia - Server Actions, resolución del negocio (requireDueno, requireNegocio, getNegocioPublico), validación con Zod, forma de los resultados y errores, consultas a Supabase con RLS, formularios del panel, fechas y dinero. Cárgala antes de escribir o cambiar una Server Action, una página del panel, un módulo de lib/panel o lib/booking, o un Route Handler.
user-invocable: false
---

# Patrones del servidor

Lo que sigue es cómo está escrito el código **hoy**. Antes de inventar una forma
nueva, copia la de un archivo vecino (`app/(admin)/panel/servicios/actions.ts`
es el ejemplo más limpio).

## Capas

```
app/(admin)/panel/<seccion>/page.tsx     Server Component: resuelve el negocio, carga datos, pinta
app/(admin)/panel/<seccion>/actions.ts   'use server': valida con Zod, llama a lib/, revalida
lib/panel/<tema>.ts                      Consultas y reglas del panel (server-only, cliente con sesión)
lib/booking/<tema>.ts                    Reserva pública (server-only; cliente privilegiado permitido)
lib/scheduling, lib/agenda               Lógica pura. Sin IO
lib/validation/<tema>.ts                 Esquemas Zod, compartidos por formulario y servidor
components/admin | components/booking    Interfaz ('use client' solo donde hay interacción)
```

## El negocio sale del servidor

```ts
const { negocio, rol, staffId } = await requireNegocio(); // dueño o trabajador
const { negocio } = await requireDueno();                  // solo dueño (servicios, equipo, caja)
const negocio = await getNegocioPublico(slug);             // público, sin sesión; null → notFound()
```

`requireDueno`/`requireNegocio` redirigen solos si no hay sesión. Las funciones
de `lib/` reciben `negocio.id` (o el `NegocioPublico`) **como parámetro** desde
ahí; nunca desde `formData`/`searchParams`.

Ids de otras entidades que sí llegan del formulario (servicio, trabajador,
cita) se cruzan con el negocio: `.eq('id', d.id).eq('business_id', negocio.id)`,
y si no vuelve fila → "No encontramos...". RLS lo vuelve a exigir.

## Server Action de formulario

```ts
'use server';

export type EstadoX = { error: string | null; campos: Record<string, string> };

export async function guardarX(_anterior: EstadoX, formData: FormData): Promise<EstadoX> {
  const { negocio } = await requireDueno();

  const datos = esquemaX.safeParse({ nombre: formData.get('nombre') ?? '' /* ... */ });
  if (!datos.success) return { error: null, campos: erroresPorCampo(datos.error) };

  const supabase = await createClient();          // lib/supabase/server — respeta RLS
  const { error } = await supabase.from('x').insert({ business_id: negocio.id, ...fila });
  if (error) return errorAlGuardar(negocio.id, error);

  revalidatePath('/panel/x');
  return { error: null, campos: {} };             // o redirect(...)
}

function errorAlGuardar(businessId: string, error: { code: string; message: string }): EstadoX {
  console.error('[x] no se pudo guardar:', { businessId, code: error.code, message: error.message });
  return { error: 'No pudimos guardar. Intenta de nuevo', campos: {} };
}
```

- Registrar: `business_id`, código y mensaje técnico. **Nunca** nombre ni
  teléfono del cliente final.
- Mensaje al usuario: español, qué pasó y qué hacer. Nunca "Error 500".
- `erroresPorCampo` está en `lib/validation/negocio.ts`.

## Operaciones que no son formulario

Devuelven una unión discriminada, no lanzan por errores esperados:

```ts
export type ResultadoX = { ok: true; citaId: string } | { ok: false; error: string; cupoOcupado?: true };
```

- Conflicto de horario: Postgres `23P01` (exclusión `appointments_sin_solapamiento`)
  → `{ ok: false, cupoOcupado: true }` y la interfaz recarga cupos.
- `docs/13-contratos-de-api.md` describe `Result<T>` con `AppError.code`; el
  código usa uniones más simples por operación. Sigue lo que ya hay en el
  módulo que tocas; si creas un módulo nuevo, usa códigos de docs/13
  (`SLOT_TAKEN`, `VALIDATION_ERROR`...) cuando la interfaz tenga que distinguir casos.

## Formularios del panel (cliente)

```tsx
const [estado, accion, pendiente] = useActionState(guardarX, { error: null, campos: {} });
<form onSubmit={enviarSinReiniciar(accion, { desactivar: accionDesactivar })} noValidate>
```

Nunca `<form action={...}>` con radios/checkboxes/selects: React 19 los
reinicia al terminar la acción (docs/14). Componentes: `Campo`, `AvisoError`,
`CLASES_CONTROL` de `components/admin/campo.tsx`.

## Tiempo y dinero

- Base: `timestamptz` en UTC. Día local del negocio: `lib/fechas.ts`
  (`fechaLocal`, `rangoDelDia`, `sumarDias`). Mostrar: `lib/formato.ts`
  (`hora`, `fechaLarga`, `fechaCorta`, `pesos`, `duracion`).
- "Ahora" se lee una vez en el borde (`new Date()` en la action o la página) y
  se pasa hacia adentro.
- Dinero: enteros en pesos (`price_cop`), `pesos(35000)` → `$35.000`.
- La cita copia `price_cop` y `duration_minutes` del servicio al crearse.

## Rendimiento (cada ida a Supabase ≈ 200 ms desde Colombia)

- Consultas independientes en `Promise.all`.
- Datos relacionados con un solo `select` (`staff_services(...)`); si hay dos
  llaves entre las tablas, nombrar la relación (`PGRST201`).
- Sesión con `getClaims()` (ya lo hace `lib/tenant.ts`); no llames `getUser()`.
- El layout del panel no suma consultas lentas.

## Cliente privilegiado

`createAdminClient()` solo en `lib/booking` (reserva pública), `app/api`
(webhooks, cron) y `lib/notifications`. Si otra parte necesita la misma lógica,
se le pasa el cliente con sesión como parámetro (así lo hace
`lib/booking/disponibilidad.ts` con `cliente?`).

## Next.js 16

Hay cambios respecto a versiones anteriores: `proxy.ts` en vez de
`middleware.ts`, `PageProps<'/ruta'>` tipado, `searchParams`/`params` como
promesas. Ante la duda, lee la guía en `node_modules/next/dist/docs/`.
