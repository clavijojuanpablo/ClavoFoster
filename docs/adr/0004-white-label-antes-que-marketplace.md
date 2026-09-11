# ADR 0004 — White-label ahora, directorio después

- **Fecha:** 2026-09-11
- **Estado:** Aceptada

## Contexto

Hay dos formas de llevarle clientes finales a la plataforma:

- **White-label:** cada negocio tiene su propia página de reservas
  (`laplataforma.com/barberia-juan`) y trae sus propios clientes desde su
  Instagram y su WhatsApp. Vendemos **software**.
- **Marketplace:** un directorio único donde el cliente busca "barbería cerca de
  mí" y descubre negocios. Vendemos **clientes**.

El marketplace es un negocio bastante más valioso: permite cobrar comisión sobre
el cliente nuevo, que es el modelo de Fresha y Booksy.

## Decisión

**White-label para el MVP, con el modelo de datos preparado para encender el
directorio después.**

Desde el registro se le piden al negocio los datos que **solo** sirven para el
directorio —dirección con coordenadas, categoría, fotos del local— y las reseñas
de clientes funcionan desde el MVP aunque todavía no haya dónde mostrarlas
públicamente.

## Alternativas consideradas

**Marketplace desde el inicio.** Se descartó por el arranque en frío. Un
directorio con tres barberías no le sirve a ningún cliente: busca, no encuentra
nada cerca, y no vuelve. Sin clientes buscando, el negocio no recibe citas
nuevas, no ve valor y cancela. Se necesita densidad **por ciudad y por zona**
—del orden de 50 a 100 negocios en la misma ciudad— antes de que le sirva al
primero. Tener 100 negocios regados por el país no sirve de nada.

Además pone a competir de frente con Booksy y Fresha, que tienen presupuesto de
publicidad para atraer clientes finales. El white-label, en cambio, compite
contra un cuaderno.

**White-label puro, sin datos de directorio.** Registro más corto y menos
fricción para entrar. Se descartó porque el día que se encienda el directorio
tocaría perseguir a 200 negocios uno por uno pidiéndoles dirección y fotos, y la
mitad no contestaría.

## Consecuencias

**A favor**

- El negocio número uno recibe valor el mismo día que entra.
- La venta es mucho más fácil: es una herramienta, no una promesa de clientes
  futuros.
- No hay conflicto de intereses: los clientes del negocio siguen siendo suyos,
  lo que quita la principal objeción a las plataformas grandes.
- Cuando llegue la densidad, los datos ya estarán ahí.

**En contra**

- No hay efecto de red: cada negocio nuevo no hace más valioso al producto para
  los demás.
- El techo de precio es más bajo: se cobra por organizar, no por traer plata.
- El registro es más largo por los campos del directorio, con algo de fricción
  en el onboarding.

**Mitigación de la fricción:** los campos de directorio son **salteables**. El
negocio puede terminar el onboarding sin fotos y agregarlas después; hay un
indicador de perfil incompleto que lo empuja sin bloquearlo.

## Cuándo revisar esta decisión

Cuando se cumplan las tres condiciones al tiempo:

1. Entre 50 y 100 negocios activos **en una misma ciudad**.
2. La mayoría con dirección y fotos cargadas.
3. Cancelación mensual por debajo del 5% — el producto base ya funciona y
   retiene.

Antes de eso, encender el directorio le quita foco al producto sin darle valor a
nadie.

## Referencias

`00-vision-y-negocio.md` · `01-modelo-de-negocio-y-precios.md` · `11-roadmap.md`
