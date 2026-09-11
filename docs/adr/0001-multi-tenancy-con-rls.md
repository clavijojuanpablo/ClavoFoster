# ADR 0001 — Multi-tenancy con fila por negocio y RLS

- **Fecha:** 2026-09-11
- **Estado:** Aceptada

## Contexto

El modelo de negocio exige vender el mismo producto a 100 negocios **sin hacerle
una instalación a cada uno**. Dar de alta un negocio tiene que ser automático,
instantáneo y sin intervención humana.

Al mismo tiempo, los datos de cada negocio son sensibles: su agenda, sus clientes
y su contabilidad. Que un negocio vea los datos de otro —sobre todo de un
competidor del mismo barrio— acabaría con el producto.

El equipo es de dos personas y no hay nadie dedicado a infraestructura.

## Decisión

**Una sola base de datos, un solo esquema, `business_id` en cada tabla, y Row
Level Security de Postgres haciendo cumplir el aislamiento.**

Dar de alta un negocio es insertar una fila. Sin migraciones, sin
aprovisionamiento, sin despliegues.

## Alternativas consideradas

**Base de datos por negocio.** Aislamiento perfecto y es lo que pediría un
cliente corporativo. Se descartó porque 100 negocios son 100 migraciones, 100
copias de seguridad y un costo fijo por negocio que destruye el margen de un
producto de $129.000 COP al mes.

**Esquema por negocio.** Menos costo fijo, aislamiento fuerte. Se descartó por
las migraciones: cambiar una columna implica recorrer 100 esquemas, y si falla a
la mitad quedan versiones distintas en producción. Inmanejable de a dos personas.

**Filtrar por `business_id` en el código, sin RLS.** Es lo más simple y funciona
perfecto hasta que alguien olvida una condición una sola vez. Ese olvido no da
error ni falla: devuelve datos de otro negocio en silencio. Se descartó porque el
aislamiento no puede depender de que nadie se equivoque nunca — y menos con un
dev contratado que va a tocar código sin todo el contexto.

## Consecuencias

**A favor**

- Alta de negocio en menos de un minuto, sin intervención.
- Una migración sirve para todos.
- Costo de infraestructura que no crece por negocio (`10-costos`).
- Aunque el código haga `select * from appointments` sin condiciones, Postgres
  devuelve solo las filas del negocio de la sesión.

**En contra**

- Una política de RLS mal escrita filtra datos entre negocios. Es el riesgo
  central de esta decisión.
- Las políticas tienen costo de rendimiento si se escriben mal (de ahí la forma
  `business_id in (select auth_business_ids())`).
- Un negocio con volumen atípico afecta a los demás al compartir recursos.

**Mitigación obligatoria**

La prueba automática de aislamiento entre negocios (tarea A3) **corre en cada
despliegue**. Si falla, no se despliega. No es opcional ni se pospone: es lo
único que convierte esta decisión de "confiamos en que está bien" a "está
verificado".

Y en cada pull request que agregue una tabla se revisa: ¿`business_id`?, ¿RLS
activa?, ¿políticas de lectura y escritura?, ¿índice? Está en la definición de
terminado de `12-convenciones-de-desarrollo.md`.

## Cuándo revisar esta decisión

- Si llega un cliente con exigencia contractual de base separada. **La respuesta
  no es cambiar la arquitectura para todos**, sino desplegar una instancia
  dedicada del mismo código para ese cliente.
- Si un solo negocio genera tanto volumen que degrada a los demás.
- Si el rendimiento de las políticas se vuelve un problema medido, no supuesto.

## Referencias

`05-arquitectura-multitenant.md` · `07-modelo-de-datos.md`
