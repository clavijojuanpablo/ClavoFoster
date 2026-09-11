# 02 — Usuarios y flujos

## Los cuatro roles

| Rol | Quién es | Cómo entra | Qué ve |
|---|---|---|---|
| **Cliente final** | Quien se corta el pelo | Link público, sin contraseña. Se identifica con su celular por WhatsApp | Solo sus propias citas en ese negocio |
| **Trabajador** | El barbero, la estilista | Email y contraseña | Su propia agenda. Sus comisiones si el dueño lo permite |
| **Dueño** | Quien administra el negocio | Email y contraseña | Todo lo de su negocio: agenda completa, contabilidad, configuración |
| **Super-admin** | Nosotros | Panel interno aparte | Los negocios, sus suscripciones y su estado. **Nunca los datos de clientes finales** |

Un mismo email puede ser dueño de un negocio y trabajador en otro. Los permisos
se resuelven siempre por la pareja (usuario, negocio), nunca por el usuario
solo. Ver `05-arquitectura-multitenant.md`.

### Sobre el super-admin

Puede ver que la Barbería Juan tiene 340 citas este mes y está al día en su
suscripción. **No puede ver quiénes son esos clientes ni sus teléfonos.** No es
una restricción técnica opcional: es lo que permite mirar a un dueño a los ojos
y decirle que sus clientes son suyos. Las políticas de RLS tienen que hacerlo
cumplir de verdad, no la buena intención.

## Flujo 1 — El cliente reserva por primera vez

El flujo más importante del producto. Si este falla, no hay negocio. Cada paso
de más pierde gente.

1. Camila toca el link en la bio de Instagram de la barbería.
2. Ve la página del negocio: nombre, logo, dirección, servicios con precio y
   duración. **Sin registro, sin nada que aceptar.**
3. Escoge "Corte de cabello — $30.000 — 45 min".
4. Escoge trabajador. Puede elegir "el primero disponible", que suele convertir
   mejor y llena mejor la agenda.
5. Ve un calendario con los días y las horas realmente libres. No una grilla
   fija: cupos reales calculados según duración del servicio y agenda del
   trabajador (ver `06-motor-de-agendamiento.md`).
6. Escoge jueves 2:30 p.m.
7. Escribe su celular.
8. Recibe un código por WhatsApp y lo escribe.
9. **Como es nueva:** se le pide el nombre. Nada más. Ni apellido, ni email, ni
   fecha de nacimiento. Cada campo extra cuesta reservas.
10. Confirma. Recibe la confirmación por WhatsApp con fecha, hora, dirección y
    un link para cancelar o reprogramar.

**El cupo se aparta en el paso 6, no en el 10.** Se retiene unos minutos
mientras la persona verifica su código. Sin eso, dos clientes pueden tomar la
misma hora mientras uno escribe el código.

## Flujo 2 — El cliente que vuelve

Lo que se pidió explícitamente: de aquí en adelante, solo el número.

1. Entra al link, escoge servicio, trabajador y hora.
2. Escribe su celular.
3. Código por WhatsApp.
4. **Se reconoce el número:** "Hola Camila". Confirma y listo.

No se le vuelve a pedir el nombre. El sistema ya sabe qué se hizo la última vez
y con quién, y lo puede sugerir de entrada: el mismo servicio con el mismo
trabajador, a un toque.

## Flujo 3 — El cliente cancela o reprograma

Desde el link de su mensaje de WhatsApp, sin contraseña. El link lleva un
identificador imposible de adivinar y muestra **solo esa cita**.

Reglas configurables por el negocio:

- Anticipación mínima para cancelar (ej. 4 horas antes).
- Anticipación mínima para reprogramar.
- Pasado ese límite, se le muestra el WhatsApp del negocio para que hable con
  ellos.

**Cancelar tiene que ser fácil.** Un cliente al que se le pone difícil cancelar
no cancela: simplemente no llega, y eso es peor para el negocio. El objetivo es
que la hora se libere a tiempo para que la tome otro.

## Flujo 4 — El día del dueño

Lo que hace al abrir el celular, en orden:

**En la mañana.** Abre la PWA. Ve las citas de hoy en una lista: hora, cliente,
servicio, trabajador. Ve si alguien canceló en la noche.

**Durante el día.** Entra alguien sin cita: la agenda a mano desde el panel,
escogiendo un cliente existente o creando uno nuevo con solo el celular. Un
cliente llama a mover su cita: la arrastra a otra hora en el calendario y el
sistema le avisa solo al cliente.

**Cuando termina un servicio.** Marca la cita como **cumplida**. Eso dispara lo
importante: el valor entra automáticamente a la contabilidad como ingreso, con
su trabajador y su método de pago. Si el cliente no llegó, la marca como
**no asistió**, que no genera ingreso pero sí queda en el historial del cliente.

**Al cerrar.** Ve el corte de caja: cuánto entró hoy, cuánto en efectivo, cuánto
por transferencia. Registra gastos del día (tintes, servicios públicos,
almuerzo). Cuadra.

**Fin de mes.** Ingresos contra egresos, qué servicio dejó más, qué barbero
produjo más, qué horas están muertas. Liquida comisiones (v1.1).

## Flujo 5 — El trabajador

Entra y ve **solo su agenda**. Ese es todo el producto para él, y está bien: si
se le muestra configuración y contabilidad se pierde y no lo usa.

Puede:

- Ver sus citas del día y de la semana.
- Marcar cumplida o no asistió.
- Bloquear un rato ("almuerzo", "cita médica") si el dueño le dio permiso.
- Ver el historial y las notas del cliente que sigue ("el 3 a los lados", "no le
  gusta la máquina en la nuca").

No puede: ver la contabilidad del negocio, ver la agenda de otros trabajadores
salvo que el dueño lo habilite, ni cambiar precios.

## Flujo 6 — Un negocio nuevo se registra

Este flujo decide si el negocio se queda o se pierde. **Un negocio que se
registra y no carga sus servicios está muerto**, aunque haya pagado.

1. Registro con email, contraseña, nombre del negocio y celular.
2. Escoge su tipo (barbería, peluquería, spa, tatuajes, cosmetología). Eso
   **precarga servicios típicos con duraciones y precios sugeridos**, que él
   ajusta. La diferencia es enorme: una pantalla en blanco que dice "cree su
   primer servicio" es exactamente donde la gente abandona.
3. Escoge su link público: `laplataforma.com/barberia-juan`.
4. Datos del negocio: dirección con ubicación en el mapa, teléfono, foto.
   *(La dirección y las fotos son los datos que después alimentan el
   directorio — ver `00-vision-y-negocio.md`.)*
5. Horario de atención del local.
6. Agrega trabajadores: nombre, foto, qué servicios hace, su horario.
7. **Listo.** Se le muestra su link público y un texto listo para copiar y pegar
   en Instagram y WhatsApp.
8. Arranca la prueba de 14 días.

Lo que hace que este flujo funcione: que se pueda **saltar pasos y volver
después**, y que exista un indicador visible de qué le falta para estar
completo. Obligar a llenar todo de una sola vez espanta.

## Flujo 7 — El cobro mensual

Detalle completo en `08-pagos-y-suscripciones.md`. En resumen:

1. Día 11 de la prueba: aviso por WhatsApp y email de que se acaba.
2. Día 14: escoge plan y registra medio de pago. También puede pagar por
   transferencia o Nequi y que nosotros lo activemos a mano.
3. Cobro automático cada mes.
4. Si falla: se reintenta y se avisa. Hay un período de gracia antes de
   suspender.
5. Suspendido, **la página pública de reservas se apaga pero los datos se
   conservan** y el dueño sigue viendo su agenda. Borrarle o bloquearle el
   acceso a su propia información es la forma más rápida de que hable mal de
   nosotros.

## Qué pasa cuando algo sale mal

| Situación | Qué debe pasar |
|---|---|
| Dos clientes toman el mismo cupo a la vez | La base de datos rechaza el segundo. Se le muestran cupos frescos, no un error genérico |
| No llega el código de WhatsApp | Reenviar a los 60 s; tras dos intentos, ofrecer SMS |
| El trabajador se enferma | El dueño bloquea su día, ve la lista de afectados y les avisa con un toque |
| El cliente llega tarde | El dueño decide: atender, mover o marcar no asistió. El sistema no decide por él |
| El negocio se pasa de trabajadores del plan | Se avisa y se ofrece subir de plan. **Nunca se bloquea la agenda del día** |
