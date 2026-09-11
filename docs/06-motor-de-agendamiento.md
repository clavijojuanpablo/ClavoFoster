# 06 — Motor de agendamiento

> La pieza más delicada del producto. Si esto falla, el producto no sirve: o se
> ofrecen horas que no existen, o se esconden horas que sí están libres y el
> negocio pierde plata sin saberlo.

## El requisito que origina este diseño

> *"Si un barbero tiene agendado un corte de 60 min a las 12, pero luego le
> agendaron una barba de 30 min a la 1, el usuario ya no tenga que programar a
> las 2 el siguiente corte, porque a la 1:30 hay un cupo."*

Casi todos los sistemas simples fallan acá porque trabajan con una **grilla
fija**: dividen el día en bloques de una hora y marcan cada bloque como libre u
ocupado. Con ese modelo la barba de 30 minutos consume el bloque entero de 1:00
a 2:00 y las 1:30 desaparecen.

La solución es no usar grilla. **Se calculan los intervalos realmente libres y
sobre ellos se generan los cupos.** El caso de arriba sale solo, sin ninguna
regla especial.

## El algoritmo

Cinco pasos. Entrada: una fecha, un trabajador y un servicio.

### Paso 1 — Intervalos de trabajo

Se toma el horario del trabajador para ese día de la semana y se convierte a UTC
usando la **zona horaria del negocio** (nunca la del servidor ni la del
navegador).

```
Andrés, jueves:  09:00–13:00  y  14:00–19:00
```

Son dos intervalos, no uno: el almuerzo no existe como bloqueo, simplemente no
hay horario. El turno partido es la norma en peluquerías.

### Paso 2 — Intervalos ocupados

Se juntan:

- **Citas existentes**, extendidas con sus buffers:
  `[inicio − buffer_antes, fin + buffer_después]`
- **Bloqueos y ausencias** del trabajador.

### Paso 3 — Restar

`libres = trabajo − ocupado`

Aritmética de intervalos pura. El resultado es la lista de huecos reales.

### Paso 4 — Generar cupos

Para cada hueco libre, se recorre desde su inicio avanzando de a
`slot_granularity` minutos (15 por defecto). Cada posición es candidata.

Una candidata `s` es válida si el servicio **cabe completo con sus dos buffers**:

```
buffer_antes + duración + buffer_después  ≤  (fin_del_hueco − s)
```

### Paso 5 — Filtros finales

- **Anticipación mínima:** se descarta todo cupo anterior a
  `ahora + min_notice_minutes`. Evita que alguien reserve para dentro de cinco
  minutos.
- **Ventana máxima:** nada más allá de `max_advance_days`.
- **Días cerrados:** festivos y días sin horario no producen cupos.

## El caso del requisito, resuelto paso a paso

**Datos.** Andrés atiende de 9:00 a 19:00. Granularidad 15 min, sin buffers.
Ya tiene:

- Corte, 60 min → **12:00–13:00**
- Barba, 30 min → **13:00–13:30**

Un cliente quiere una **barba de 30 minutos**.

```
Paso 1 — Trabajo:     [09:00 ─────────────────────────── 19:00]

Paso 2 — Ocupado:                    [12:00──13:00][13:00──13:30]

Paso 3 — Libres:      [09:00 ── 12:00]              [13:30 ── 19:00]

Paso 4 — Cupos del segundo hueco, de a 15 min:
                       13:30 ✅   13:45 ✅   14:00 ✅   14:15 ✅  …
                       (cabe 30 min hasta las 18:30)
```

**Se ofrece las 13:30.** No hubo que programar nada especial: es la consecuencia
directa de restar intervalos en vez de marcar casillas.

### Un segundo caso, para ver el filtro trabajando

Mismo día, pero ahora hay una cita de **14:00 a 15:00**, y el cliente quiere un
**corte de 45 minutos**.

```
Libres:   [13:30 ── 14:00]        [15:00 ── 19:00]
           (30 min)

Hueco de 13:30:  45 min no caben en 30 → ningún cupo ❌
Hueco de 15:00:  15:00 ✅  15:15 ✅  …  hasta 18:15 ✅
```

El hueco de 30 minutos **no se ofrece para un servicio de 45**, pero seguiría
apareciendo para una barba de 30. La disponibilidad depende del servicio que se
está pidiendo — por eso el cliente escoge servicio *antes* de ver el calendario
(flujo 1 de `02-usuarios-y-flujos.md`).

## Dos decisiones que hay que entender

### Dónde se anclan los cupos

Los cupos se generan **desde el inicio de cada hueco libre**, no desde una grilla
de reloj.

Si un hueco empieza a las 13:20, se ofrece 13:20, 13:35, 13:50... en vez de
13:30, 13:45. Se pierde menos tiempo, que es justo lo que se buscaba, pero
aparecen horas de aspecto raro.

Por eso existe la opción por negocio **`align_to_clock`**: activada, redondea
cada cupo hacia arriba al siguiente múltiplo de la granularidad. Un negocio que
prefiere verse ordenado la enciende y acepta perder algunos minutos.

**Por defecto viene apagada**, porque aprovechar la agenda es el objetivo
declarado del producto.

### Los buffers se suman

Si una cita tiene 10 minutos de buffer después y la siguiente tiene 10 antes,
quedan 20 minutos entre ellas, no 10.

Es la opción simple y predecible: cada servicio protege su propio tiempo sin
depender de qué haya al lado. Si en la práctica resulta desperdiciar demasiado,
se cambia a tomar el mayor de los dos — pero se cambia con datos reales, no por
intuición.

## Concurrencia: que dos clientes no tomen el mismo cupo

Dos personas mirando el mismo cupo a la misma hora es un escenario **normal**,
no excepcional. Se defiende en dos capas.

### Capa 1 — La base de datos no lo permite

La garantía real la da Postgres, no la aplicación:

```sql
create extension if not exists btree_gist;

alter table appointments add column blocked_range tstzrange
  generated always as (
    tstzrange(
      start_at - make_interval(mins => buffer_before_minutes),
      end_at   + make_interval(mins => buffer_after_minutes),
      '[)'
    )
  ) stored;

alter table appointments add constraint no_solapamiento
  exclude using gist (
    staff_id     with =,
    blocked_range with &&
  ) where (status in ('pending', 'confirmed'));
```

Con eso, **es imposible** insertar dos citas que se pisen para el mismo
trabajador. No importa cuántas peticiones lleguen al tiempo, ni si la lógica de
la aplicación tiene un error: la segunda es rechazada por la base.

El `where` es importante: las citas canceladas y las que no asistieron no
bloquean el cupo, que es justo lo que se quiere.

### Capa 2 — La retención mientras el cliente confirma

Entre que el cliente escoge las 14:00 y termina de escribir su código de
WhatsApp pasan uno o dos minutos. Sin protección, otro puede ganarle el cupo
mientras tanto.

La cita se crea **de una vez en estado `pending`** con un `expires_at` corto (10
minutos). Como el constraint de arriba ya cuenta `pending`, el cupo queda
apartado de verdad, sin ninguna tabla ni mecanismo adicional.

- Si confirma el OTP → pasa a `confirmed` y se limpia `expires_at`.
- Si abandona → un trabajo programado borra las `pending` vencidas cada pocos
  minutos y el cupo vuelve a estar libre.

### Qué ve el usuario cuando pierde la carrera

Nunca un error genérico. Se le dice que ese cupo lo acaban de tomar y **se le
muestran los cupos recalculados** en la misma pantalla, con el más cercano
resaltado. Un error rojo sin salida es una reserva perdida.

## El tiempo

Las tres reglas que evitan la clase de bug más cara de este producto:

**1. Todo instante se guarda en UTC**, en columnas `timestamptz`. Sin
excepciones.

**2. Los horarios de trabajo NO son instantes.** "Lunes de 9 a 13" es una hora
local recurrente. Se guarda como día de la semana + hora local, y se convierte a
UTC solo cuando se calcula la disponibilidad de una fecha concreta.

Guardarlos ya convertidos a UTC parece más simple y es un error: el día que el
negocio cambie de zona horaria, o que el país tenga horario de verano, todos los
horarios quedan corridos.

**3. La zona la manda el negocio.** `businesses.timezone` (por defecto
`America/Bogota`). Nunca la del servidor, que en Vercel es UTC, ni la del
navegador, que es la del cliente y puede estar viajando.

Colombia no tiene horario de verano, así que hoy este problema está dormido.
Despierta el día que entre un negocio en Chile o en México. Hacerlo bien ahora
cuesta nada; arreglarlo después cuesta migrar datos en producción.

## Dónde vive este código

En `lib/scheduling/`, como **lógica pura**: no importa Supabase, no importa
Next.js, y **no lee la hora del sistema** — el "ahora" se le pasa como
parámetro.

Esa disciplina es lo que permite probar el caso de las 13:30 con una prueba
unitaria de tres líneas, y probar los bordes de horario sin montar una base de
datos ni esperar a que llegue una fecha.

```
lib/scheduling/
├── intervals.ts      restar, unir y normalizar intervalos
├── availability.ts   los cinco pasos del algoritmo
├── rules.ts          anticipación, ventana, granularidad
└── types.ts
```

## Casos de prueba obligatorios

Esta lista es la definición de terminado de las tareas E1 y E2 del backlog.

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | **El del requisito:** corte 60 min a las 12, barba 30 min a la 1 | Ofrece 13:30 |
| 2 | Servicio de 60 min contra hueco de 45 min | Ningún cupo en ese hueco |
| 3 | Turno partido 9–13 y 14–19 | Ningún cupo entre 13:00 y 14:00 |
| 4 | Buffers de 10 min a ambos lados | El cupo siguiente empieza 20 min después del fin |
| 5 | Último cupo del día | Cabe completo antes del cierre; ni uno más |
| 6 | Día sin horario configurado | Lista vacía, sin excepción |
| 7 | Bloqueo de día completo | Lista vacía |
| 8 | Bloqueo parcial a mitad del día | Parte el hueco en dos |
| 9 | Anticipación mínima de 2 h, consultando a las 10:00 | El primer cupo es a las 12:00 o después |
| 10 | Dos peticiones simultáneas al mismo cupo | Exactamente una confirma; la otra recibe conflicto |
| 11 | Negocio en zona horaria distinta a la del servidor | Los cupos corresponden a la hora local del negocio |
| 12 | `align_to_clock` activo, hueco desde 13:20, granularidad 15 | El primer cupo es 13:30 |
| 13 | Cita cancelada en medio del día | Su franja vuelve a ofrecerse |
| 14 | Servicio que dura más que toda la jornada | Lista vacía |
| 15 | `pending` vencida sin confirmar | El cupo se libera tras la limpieza |

## Rendimiento

La consulta de disponibilidad es la más frecuente del producto: cada visita a la
página de reserva la dispara varias veces.

- Índice sobre `(staff_id, start_at)` en `appointments`, y sobre
  `(business_id, start_at)`.
- Se traen las citas del rango consultado **de una sola vez**, no un día a la
  vez. Pedir un mes completo no puede ser treinta consultas.
- Los intervalos se calculan en memoria: es aritmética sobre listas cortas, es
  rápido, y mantiene la lógica probable sin base de datos.
- Se puede cachear por (negocio, trabajador, día) e invalidar cuando cambia una
  cita o un bloqueo. **No hacerlo todavía**: primero medir. Un caché mal
  invalidado ofrece cupos que ya no existen, que es peor que ser un poco lento.
