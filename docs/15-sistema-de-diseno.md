# 15 — Sistema de diseño

> Maquetas aprobadas el 2026-09-12:
> https://claude.ai/code/artifact/b9bc2ff9-22de-4397-9c34-4cf5a18d381d
> (panel en escritorio y celular, menú "Más", servicios, perfil, reserva pública
> y guía de estilo).

## La idea en una frase

Papel cálido, tinta profunda y **un solo acento lima** para lo que está activo o
hay que hacer ahora. Todo lo demás se retira para que la agenda hable. Tipo
dashboard, moderno y limpio.

## Color

Los tokens viven en `app/globals.css` y se usan como clases de Tailwind
(`bg-tinta`, `text-lima`, `bg-papel`...). **No se escriben colores sueltos en
los componentes** salvo los grises del menú oscuro, que no tienen token propio.

| Token | Valor | Para qué |
|---|---|---|
| `tinta` | `#121412` | Texto, menú lateral, botón principal, tarjetas que piden atención |
| `lima` | `#D4F66A` | Lo activo: ítem de menú, estado confirmado, acción secundaria destacada |
| `papel` | `#F4F3EE` | Fondo de toda la aplicación |
| `card` | `#FFFFFF` | Superficie de tarjetas y campos |
| `muted-foreground` | `#5E625C` | Texto secundario |
| `tenue` | `#8F938C` | Texto terciario, etiquetas de grupo |
| `border` / `input` | `#E6E4DC` / `#E0DED6` | Bordes de tarjeta y de campo |
| `destructive` | `#B7351F` | Errores y acciones que desactivan |

**El lima no es para texto sobre papel**: no tiene contraste. Va de fondo (con
texto tinta) o como texto sobre tinta.

### Colores de servicio

Paleta categórica en `lib/colores.ts`, **validada** para que los servicios se
distingan también con daltonismo: violeta `#6D5CE8`, coral `#E4633F`, turquesa
`#1E9E8C`, ámbar `#C98A1E`, azul `#3B86D9`, rosa `#C9559F`. El orden es fijo:
un servicio sin color toma el de su posición. **Un color de servicio nunca va
solo**: siempre acompaña al nombre.

### Estados de la cita

Siempre con su palabra, nunca solo color (`components/admin/estado-cita.tsx`):
Confirmada (lima), Apartada (ámbar suave), Cumplida (gris), No llegó (rojo
suave), Cancelada (tachada).

## Tipografía

| Uso | Fuente | Tamaño / peso |
|---|---|---|
| Títulos y cifras | **Bricolage Grotesque** (`font-heading`) | Página 32/700 · tarjeta 20/700 · cifra 40/700 |
| Texto e interfaz | **Figtree** (`font-sans`) | Cuerpo 15/400 · botón 15/600 · etiqueta 11/600 mayúsculas |

Se cargan con `next/font` en `app/layout.tsx`. Los `h1`–`h3` toman
`font-heading` solos.

## Forma

- **Radios:** 12 px campos, 20 px tarjetas, píldora en botones y chips.
- **Alto mínimo de toque:** 44 px. Botón por defecto `h-11`, grande `h-12`.
- **Íconos:** lucide, trazo 1,8, 20 px.
- **Sin sombras** en tarjetas: se separan por borde. La única sombra es la de la
  barra inferior flotante.

## Componentes base

| Componente | Archivo |
|---|---|
| Botón (`default`, `acento`, `outline`, `ghost`, `destructive`, `link`) | `components/ui/button.tsx` |
| Tarjeta (`clara`, `oscura`, `lima`) | `components/ui/tarjeta.tsx` |
| Campo con etiqueta, ayuda y error | `components/admin/campo.tsx` |
| Marco de entrar / registro / bienvenida | `components/admin/marco-acceso.tsx` |

## Navegación

Una sola definición en `components/admin/navegacion.ts` alimenta los dos menús:

- **Escritorio (≥ 1024 px):** menú lateral oscuro. *Operación*: Inicio, Agenda,
  Clientes. *Negocio*: Servicios, Equipo, Caja, Reportes. Abajo, la tarjeta del
  link público, Configuración y Cerrar sesión.
- **Celular:** barra flotante inferior con lo diario —Inicio, Agenda, Nueva
  cita, Caja— y el resto en la hoja **Más**.
- **Trabajador:** solo Inicio y Agenda.

Las secciones que todavía no existen se muestran con la etiqueta **Pronto** y no
navegan. Al terminar la tarea del backlog, se cambia `disponible` a `true`.

## Decisiones de producto que tocan el diseño

- **"Completa tu negocio" es una cajita pequeña que se cierra**, no un bloque
  principal: cuando el negocio está completo sobra. Desaparece sola al completar
  todo y cerrarla se recuerda en ese navegador.
- **Solo tema claro** por ahora.
- **Nada de elementos de relleno**: si un dato no existe todavía (ocupación sin
  horarios, por ejemplo), la tarjeta no se muestra en vez de inventar un número.
