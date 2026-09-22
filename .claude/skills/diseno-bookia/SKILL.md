---
name: diseno-bookia
description: Sistema de diseño de Bookia para construir o cambiar pantallas y componentes - tokens de color (tinta, lima, papel), tipografía, radios, botones, tarjetas, campos, menú, estados de cita, textos en español y reglas para celular a 375 px. Cárgala antes de crear o modificar cualquier archivo en components/ o una page.tsx con interfaz.
user-invocable: false
---

# Sistema de diseño

Fuente de verdad: `docs/15-sistema-de-diseno.md`. Aquí va lo que se usa al
escribir código.

**La idea:** papel cálido, tinta profunda y **un solo acento lima** para lo
activo o lo que hay que hacer ahora. Todo lo demás se retira para que la agenda
hable.

## Color: tokens, nunca hex

| Clase | Uso |
|---|---|
| `bg-papel` | Fondo de la aplicación |
| `bg-card` | Tarjetas y campos |
| `text-tinta` / `bg-tinta` | Texto; menú lateral, botón principal, tarjeta que pide atención |
| `bg-lima` (texto tinta) · `text-lima` (solo sobre tinta) | Lo activo. **Nunca texto lima sobre papel** |
| `text-muted-foreground` · `text-tenue` | Secundario · terciario y etiquetas |
| `border-border` · `border-input` | Bordes |
| `text-destructive` | Errores, desactivar |

Hex sueltos solo para grises de superficies oscuras (menú, barra inferior).
Colores de servicio: de `lib/colores.ts`, **siempre junto al nombre**.
Estados de cita: `components/admin/estado-cita.tsx`, siempre con palabra.

## Forma y tipografía

- Radios: campos 12 px (`rounded-xl`), tarjetas 20 px, botones y chips píldora.
- Toque mínimo 44 px: botón `h-11`, grande `h-12`.
- Sin sombras en tarjetas (se separan por borde).
- Títulos y cifras: `font-heading` (Bricolage). Cuerpo: Figtree 15 px.
  Etiqueta: 11 px, 600, mayúsculas.
- Íconos: `lucide-react`, trazo 1,8, 20 px.

## Componentes que ya existen (úsalos)

- `Button` de `components/ui/button.tsx`: `default`, `acento`, `outline`,
  `ghost`, `destructive`, `link`; tamaños `sm`, `default`, `lg`, `icon`.
- `Tarjeta` de `components/ui/tarjeta.tsx`: `tono="clara" | "oscura" | "lima"`.
- `Campo`, `AvisoError`, `CLASES_CONTROL`, `CLASES_BOTON_PRIMARIO` de `components/admin/campo.tsx`.
- `MarcoAcceso` para entrar/registro/bienvenida.
- `Pestanas`, `AvatarTrabajador`, `EstadoCita`, `CopiarLink`.

Antes de crear un componente, busca si ya hay uno parecido en `components/`.

## Celular primero

- Diseña a **375 px** y luego escritorio (`lg:` ≥ 1024 px).
- Menú: una sola definición en `components/admin/navegacion.ts`. Sección nueva →
  `disponible: true` al terminar su tarea (antes muestra "Pronto").
- La barra inferior flota: deja espacio abajo para que no tape botones.
- Calendario: las columnas se deslizan de lado con la regla de horas fija; no se apilan.
- Editor de detalle: a la derecha en escritorio, pantalla propia en celular
  (patrón de servicios y equipo).

## Estados que siempre se resuelven

- **Carga:** `loading.tsx` del panel ya cubre la navegación; en acciones,
  botón deshabilitado con texto ("Guardando...").
- **Vacío:** qué hacer ahora, con el botón que lo resuelve ("Agrega tu primer servicio").
- **Error:** en español, qué pasó y qué puede hacer.
- **Nada de relleno:** si un dato no existe, la tarjeta no se muestra; no se
  inventa un número.

## Texto

Español de Colombia, tuteo, frases cortas, sin jerga técnica ("link" sí,
"URL" no; "persona" o "equipo" para trabajadores). Horas `2:30 p. m.` y plata
`$35.000` siempre desde `lib/formato.ts`. El nombre del producto desde
`NOMBRE_PRODUCTO` (`lib/marca.ts`).

Solo tema claro por ahora.
