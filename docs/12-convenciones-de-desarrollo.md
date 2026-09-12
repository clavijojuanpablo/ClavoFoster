# 12 — Convenciones de desarrollo

> Escrito para que alguien que nunca ha visto este proyecto pueda tomar una tarea
> del backlog y entregarla bien, sin preguntar.

## Arranque

```bash
git clone <repo> && cd app
npm install
cp .env.example .env.local        # pedir los valores del proyecto de desarrollo
npm run db:login                  # autenticarse con Supabase (abre el navegador)
npm run db:link                   # enlazar con el proyecto de DESARROLLO
npm run db:push                   # aplicar las migraciones
npm run db:types                  # regenerar lib/types/database.ts
npm run dev
```

### Contra qué base se desarrolla

**Hay dos proyectos de Supabase, siempre separados:**

| Proyecto | Para qué | Quién lo toca |
|---|---|---|
| `plataforma-citas-dev` | Desarrollo diario | Cualquiera del equipo |
| `plataforma-citas-prod` | Negocios reales pagando | Solo despliegues, nunca a mano |

**Nunca se desarrolla contra el proyecto de producción.** No es una preferencia:
en producción viven las agendas y los teléfonos de clientes de negocios reales.

> **Se eligió un proyecto en la nube para desarrollo, en vez de Supabase local
> con Docker.** La razón fue práctica: Docker Desktop no arrancaba en la máquina
> de desarrollo. El proyecto de desarrollo en la nube es gratis y desbloquea el
> trabajo.
>
> **Lo que se pierde, y hay que tener presente:**
>
> - **No hay `db reset` seguro.** Contra un proyecto remoto, `reset` borra la
>   base de verdad. Por eso **no existe** un script `db:reset` apuntando al
>   proyecto enlazado: solo `db:reset:local`, que exige Docker. Si alguien
>   necesita reiniciar el proyecto de desarrollo, lo hace a conciencia desde el
>   dashboard.
> - **El estado es compartido.** Si dos personas trabajan al tiempo, se pisan los
>   datos.
> - **Las pruebas pueden fallar por límite de peticiones.** Crean usuarios reales
>   contra Supabase Auth, que tiene un tope de intentos por hora. Si varias
>   corridas seguidas —o muchos ingresos manuales en el navegador— lo agotan, el
>   montaje falla y las pruebas quedan saltadas. **No es un bug del código:**
>   esperar unos minutos y volver a correr. Contra Supabase local no pasa.
> - **No se puede trabajar sin conexión.**
> - **Cada cambio de esquema es un `db:push`**, no un reset instantáneo.
>
> Cuando Docker funcione, volver a local para el día a día es mejor y no exige
> cambiar nada del código — solo `npm run db:start` y apuntar `.env.local` a la
> base local.

### Migraciones, no cambios por el dashboard

Con una base en la nube aparece una tentación nueva y peligrosa: **crear tablas y
columnas a mano desde el editor del dashboard**. No se hace, nunca.

Todo cambio de esquema nace como archivo en `supabase/migrations/` y se aplica
con `db:push`. Un cambio hecho a mano existe solo en esa base: no queda en el
repositorio, no llega a producción y nadie más lo tiene. Es la forma más rápida
de que el esquema de desarrollo y el de producción dejen de parecerse.

### Datos de prueba

`supabase/seed.sql` crea **dos negocios** con trabajadores y citas. Dos, no uno:
es la única forma de notar una fuga entre negocios mientras se desarrolla.

Contra la base en la nube el seed se aplica a mano cuando haga falta, porque no
hay reset automático que lo dispare.

## Variables de entorno

| Variable | Dónde vive | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador y servidor | Pública, protegida por RLS |
| `SUPABASE_SECRET_KEY` | **Solo servidor** | **Salta toda RLS.** Ver abajo |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Solo servidor | |
| `MERCADOPAGO_ACCESS_TOKEN` | Solo servidor | |
| `MERCADOPAGO_WEBHOOK_SECRET` | Solo servidor | |
| `RESEND_API_KEY` | Solo servidor | |
| `CRON_SECRET` | Solo servidor | Protege los endpoints programados |

**`NEXT_PUBLIC_` significa que termina en el navegador, visible para cualquiera.**
Poner ese prefijo en un secreto lo publica. Es el error más común y más grave.

### Sobre las llaves de Supabase

Supabase reemplazó las llaves JWT antiguas (`anon` y `service_role`) por un
esquema nuevo. **Este proyecto usa el nuevo desde el día 1**, porque las
antiguas quedan descontinuadas a finales de 2026 y migrar después sería trabajo
regalado.

| Nueva | Reemplaza a | Forma | Dónde vive |
|---|---|---|---|
| Publishable | `anon` | `sb_publishable_...` | Navegador y servidor |
| Secret | `service_role` | `sb_secret_...` | **Solo servidor** |

Los permisos son los mismos que tenían las viejas. La ventaja real es que las
llaves secretas se pueden **revocar y rotar una por una** sin invalidar todas
las sesiones, cosa que con `service_role` era imposible.

> **Ojo con una confusión fácil:** la llave publicable sigue actuando con el rol
> de Postgres llamado `anon`. Las políticas de RLS escritas `for select to anon`
> en `05-arquitectura-multitenant.md` **siguen siendo correctas tal como
> están** — lo que cambió es el nombre de la llave, no el del rol de la base de
> datos.

### La llave secreta

`SUPABASE_SECRET_KEY` **salta todas las políticas de RLS**. Es la llave
maestra.

Se usa solo en tres lugares, y en ninguno más:

1. Crear una cita desde la página pública (el cliente no tiene sesión).
2. Procesar webhooks de la pasarela.
3. Trabajos programados (recordatorios, limpieza de retenciones vencidas).

En cualquier otro lugar se usa el cliente con la sesión del usuario, para que RLS
proteja. **Un pull request que use la llave secreta fuera de esos tres casos
se devuelve** y hay que justificar por qué.

## Estructura

```
/app
  /(public)/[slug]/...     Página de reserva. Sin sesión
  /(admin)/...             Panel. Con sesión
  /api/webhooks/...        Webhooks entrantes
  /api/cron/...            Trabajos programados
/components
  /ui                      shadcn/ui. Sin lógica de negocio
  /booking                 Componentes de la reserva pública
  /admin                   Componentes del panel
/lib
  /supabase                createServerClient, createBrowserClient, createAdminClient
  /scheduling              Motor de cupos. LÓGICA PURA
  /billing                 Interfaz de pagos + adaptadores
  /notifications           Interfaz de mensajería + canales
  /validation              Esquemas de Zod
/supabase/migrations
/tests
```

### La regla de `lib/scheduling`

**Lógica pura. No importa Supabase, no importa Next.js, y no lee la hora del
sistema** — el "ahora" se recibe como parámetro.

No es purismo: es lo que permite probar el caso de las 13:30 con una prueba de
tres líneas y sin montar una base de datos. Es la parte más delicada del
producto y la que más barato sale proteger. Ver `06-motor-de-agendamiento.md`.

Si una función de ahí necesita consultar la base, la firma está mal: los datos se
traen afuera y se le pasan.

## Nombres

| Qué | Convención | Ejemplo |
|---|---|---|
| Tablas y columnas | `snake_case`, inglés, plural en tablas | `appointments`, `start_at` |
| Archivos de componente | `kebab-case` | `appointment-card.tsx` |
| Componentes | `PascalCase` | `AppointmentCard` |
| Funciones y variables | `camelCase` | `getAvailableSlots` |
| Constantes | `SCREAMING_SNAKE` | `DEFAULT_SLOT_MINUTES` |
| Dinero | sufijo `_cop` | `price_cop` |
| Instantes | sufijo `_at` | `start_at`, `created_at` |
| Fechas sin hora | sufijo `_on` | `occurred_on` |
| Booleanos | prefijo `is_` / `can_` | `is_active` |

**El código en inglés. El texto que ve el usuario, en español.** Mezclar idiomas
dentro del código (`obtenerAppointments`) es peor que cualquiera de los dos.

## Git

**Ramas:** `<tipo>/<ID-tarea>-<descripción>`

```
feat/E2-generacion-de-cupos
fix/G4-reprogramar-pierde-buffer
docs/10-actualizar-costos
```

**Commits:** [Conventional Commits](https://www.conventionalcommits.org).

```
feat(scheduling): generar cupos desde intervalos libres

Implementa los pasos 1 a 4 de docs/06. Los cupos se anclan al inicio
del hueco libre, no a la grilla del reloj.

Closes E2
```

**Nunca se hace commit directo a `main`.** Todo pasa por pull request, incluso
trabajando solo: el entorno de vista previa de Vercel permite revisar el cambio
funcionando, no solo leyendo el código.

## Definición de terminado

Una tarea pasa a `Hecho` en `03-backlog.md` solo cuando cumple **todo** esto:

**Funciona**
- [ ] Cumple los criterios de aceptación escritos en el backlog
- [ ] Probado a mano en el entorno de vista previa, no solo en local
- [ ] Se ve bien en celular (ancho de 375 px)
- [ ] Los estados de carga y de error están resueltos, no solo el camino feliz

**Es seguro**
- [ ] Si agrega una tabla: tiene `business_id`, RLS activa, políticas de lectura
      y escritura, e índice
- [ ] Ningún `tenant_id` o `business_id` llega desde el navegador
- [ ] Toda entrada externa validada con Zod
- [ ] La llave secreta no se usa fuera de los tres casos permitidos

**Está probado**
- [ ] Lógica de `lib/scheduling`: pruebas unitarias, incluidos los bordes
- [ ] Si toca cobros o notificaciones: probado el camino de fallo, no solo el
      exitoso
- [ ] `npm run test` y `npm run build` pasan
- [ ] La prueba de aislamiento entre negocios sigue pasando

**Está documentado**
- [ ] Si cambia el comportamiento descrito en `docs/`, el documento se actualizó
      **en el mismo pull request**
- [ ] Si es una decisión de arquitectura, hay un ADR nuevo
- [ ] El backlog quedó actualizado

> La casilla de documentación no es burocracia. Estos documentos son el contrato
> entre quien encarga y quien construye. Documentación que miente es peor que no
> tener documentación, porque se le cree.

## Pruebas

**No se busca cobertura alta. Se busca cubrir lo que, si se rompe, mata el
producto.**

| Qué | Cómo | Prioridad |
|---|---|---|
| Motor de cupos | Vitest, los 15 casos de `docs/06` | **Máxima** |
| Aislamiento entre negocios | Prueba de integración contra Postgres real | **Máxima** |
| Reserva completa de punta a punta | Playwright | Alta |
| Contabilidad: ingreso y reverso | Vitest + integración | Alta |
| Webhooks: firma e idempotencia | Vitest | Alta |
| Componentes de interfaz | — | Baja. Cambian mucho y aportan poco |

Las dos de máxima prioridad **corren en cada despliegue**. Si fallan, no se
despliega.

## Revisión de pull request

Qué se mira, en orden:

1. **¿Filtra datos entre negocios?** Lo primero, siempre.
2. **¿Confía en algo que mandó el navegador?** Precio, duración, identificadores
   de negocio: todo se re-resuelve en el servidor.
3. **¿Qué pasa cuando falla?** Sin red, con datos vacíos, con el proveedor caído.
4. **¿Rompe algo que ya funcionaba?**
5. Recién después: legibilidad y estilo.

Los primeros cuatro puntos bloquean. El quinto es sugerencia.

## Errores

- **Nunca se traga un error en silencio.** Un `catch` vacío es un bug que nadie
  va a encontrar.
- Todo error inesperado va a Sentry con contexto: `business_id`, ruta y acción.
  **Nunca con datos personales** del cliente final.
- El usuario ve un mensaje en español que le dice qué pasó y qué puede hacer.
  "Error 500" no es un mensaje.
- Errores esperados (cupo tomado, OTP vencido) se manejan como resultados
  normales, no como excepciones, y llevan un código que la interfaz entiende.

## Datos personales

La plataforma guarda teléfonos y nombres de miles de clientes finales que no son
nuestros usuarios, sino los de cada negocio.

- Nunca registrar teléfonos ni nombres en bitácoras ni en Sentry.
- Un negocio tiene que poder exportar **sus** datos. Es suyo, no nuestro.
- El super-admin ve métricas agregadas, jamás datos de clientes finales
  (`02-usuarios-y-flujos.md`).
- Antes de la primera venta hay que redactar política de tratamiento de datos y
  términos de servicio, conforme a la Ley 1581 de 2012. **Consultar con un
  abogado**; esto no es opinión técnica.
