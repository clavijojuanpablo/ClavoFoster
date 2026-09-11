# 10 — Costos de infraestructura

> **Precios verificados en septiembre de 2026.** Cambian. Reverificar antes de
> comprometer márgenes o publicar precios.
>
> **Tasa usada: 1 USD = 4.000 COP.** Los costos se pagan en dólares y los
> ingresos entran en pesos: una devaluación fuerte comprime el margen sin que
> nadie lo note hasta que ya pasó.

## La conclusión, primero

| Etapa | USD/mes | COP/mes |
|---|---|---|
| **Desarrollo** (0 negocios) | **$0 – 25** | $0 – 100.000 |
| **Piloto** (1 – 10 negocios) | **$50 – 75** | $200.000 – 300.000 |
| **Producción** (100 negocios) | **$150 – 300** | $600.000 – 1.200.000 |

**Costo marginal por negocio: entre $1,50 y $3 USD al mes** (~$6.000 – $12.000
COP).

Contra un plan de $129.000 COP, el margen bruto queda por encima del 90%.

**La infraestructura no es el problema de este negocio.** Con 100 negocios
pagando, el ingreso mensual ronda los $12.900.000 COP y la infraestructura cuesta
alrededor de $1.200.000. El costo real del producto va a ser tu tiempo de soporte
y de venta, no los servidores. Eso es bueno saberlo antes de optimizar lo que no
importa.

---

## Etapa 1 — Desarrollo

Mientras se construye, antes de tener negocios.

| Servicio | Plan | USD/mes | Nota |
|---|---|---|---|
| Supabase | Free | $0 | 500 MB, 2 proyectos. Se pausa tras 1 semana inactivo |
| Vercel | Hobby | $0 | **No permite uso comercial.** Sirve para desarrollar |
| Resend | Free | $0 | 3.000 emails/mes |
| Sentry | Free | $0 | ~5.000 errores/mes |
| PostHog | Free | $0 | ~1M eventos/mes |
| GitHub | Free | $0 | Repositorios privados ilimitados |
| WhatsApp | — | ~$1 | Pruebas reales |
| Dominio `.com` | — | ~$1 | ~$12/año |
| **Total** | | **≈ $2** | |

**La capa gratuita alcanza de sobra para construir todo el MVP.** No hay que
pagar nada hasta tener el primer negocio real.

Dos advertencias:

- **Vercel Hobby prohíbe el uso comercial.** En el momento en que un negocio real
  use la plataforma, hay que pasar a Pro. No es negociable.
- **Supabase Free pausa el proyecto** tras una semana sin actividad. Molesto en
  desarrollo, inaceptable con clientes.

### Lo que sí cuesta en esta etapa

| Concepto | Costo | Nota |
|---|---|---|
| Dev contratado | Lo que se acuerde | **El costo dominante del proyecto** |
| Claude Code | Según plan | Herramienta de desarrollo |
| Dominio `.co` | ~$25–30/año | Más caro que `.com`, pero pesa en Colombia |

El dominio `.co` da confianza local y vale la pena; `.com` es más barato y
universal. Se pueden tener los dos y redirigir uno al otro.

---

## Etapa 2 — Piloto (1 a 10 negocios)

Primeros negocios reales. **Acá empieza a doler cualquier caída**, porque un
dueño que no puede ver su agenda un sábado llama molesto.

| Servicio | Plan | USD/mes |
|---|---|---|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Resend | Free | $0 |
| Sentry | Free | $0 |
| PostHog | Free | $0 |
| WhatsApp | ~10.000 msj | ~$10 |
| Dominios | | ~$3 |
| **Total** | | **≈ $58** |

≈ **$232.000 COP al mes.**

**Punto de equilibrio: 2 negocios en plan Profesional cubren toda la
infraestructura.** A partir del tercero, todo lo demás es margen.

Por qué se paga Supabase Pro con un solo negocio real:

- No se pausa el proyecto.
- Copias de seguridad diarias con 7 días de retención. **Esto es lo que
  realmente se está pagando**: perder la agenda de un negocio es perder el
  negocio.
- Incluye $10 de crédito de cómputo, suficiente para una instancia Micro.

---

## Etapa 3 — Producción (100 negocios)

Supuestos: 100 negocios, 200 citas al mes cada uno = **20.000 citas al mes**.
Unas 150.000 visitas mensuales a páginas de reserva.

| Servicio | Plan | USD/mes | Por qué |
|---|---|---|---|
| Supabase Pro | Base | $25 | |
| Supabase cómputo | Small | ~$15 | Micro se queda corta; **verificar tarifa** |
| Vercel Pro | 1 usuario | $20 | Incluye $20 de crédito + 1 TB de transferencia |
| Vercel exceso | | $0 – 30 | Depende del tráfico real |
| WhatsApp | ~107.000 msj | ~$107 | ≈ $1,07 por negocio |
| Resend | Pro | $20 | Al pasar de 3.000 emails |
| Sentry | Team | $26 | Al pasar la capa gratuita |
| PostHog | Free | $0 | 1M eventos alcanza |
| Dominios | | ~$3 | |
| **Total** | | **≈ $216 – 246** | **≈ $900.000 COP** |

### De dónde sale cada número

**WhatsApp** es el único costo que crece linealmente con los negocios, y por eso
es el que hay que vigilar. El desglose por negocio está en `09-notificaciones.md`:
≈ 1.070 mensajes al mes, ≈ $1,03 USD.

**La base de datos es pequeña.** 20.000 citas al mes son unos 240.000 registros
al año. Con clientes, movimientos contables y bitácora de mensajes, la base no
llega a 2 GB en el primer año. Postgres ni se despeina.

**El tráfico es bajo para lo que incluye Vercel Pro.** 150.000 visitas al mes
están muy por debajo de los 10 millones de peticiones incluidas. El riesgo de
exceso está en la transferencia de imágenes: fotos de local y de trabajadores
sin optimizar pueden salir caras. Se mitiga sirviéndolas desde Supabase Storage
con transformación de tamaño.

---

## Costo marginal por negocio

Lo que de verdad importa para fijar el precio.

| Concepto | USD/mes | COP/mes |
|---|---|---|
| WhatsApp | $1,07 | $4.280 |
| Cómputo y base de datos | ~$0,25 | $1.000 |
| Tráfico y ancho de banda | ~$0,20 | $800 |
| Email | ~$0,20 | $800 |
| Monitoreo | ~$0,26 | $1.040 |
| **Total** | **≈ $2,00** | **≈ $8.000** |

Sumando la comisión de pasarela (≈ $4.900 COP sobre $129.000), el costo variable
por negocio ronda los **$12.900 COP**.

| Plan | Precio | Costo variable | Margen bruto |
|---|---|---|---|
| Esencial | $69.000 | ~$11.400 | **83%** |
| Profesional | $129.000 | ~$12.900 | **90%** |
| Estudio | $229.000 | ~$16.000 | **93%** |

---

## Cuándo se rompe esto

Los umbrales que hay que vigilar, para no enterarse por la factura:

| Umbral | Qué pasa | Qué hacer |
|---|---|---|
| **~150 negocios** | El cómputo Small de Supabase se queda corto | Subir a Medium (~$60, verificar). Sigue siendo trivial frente al ingreso |
| **~300 negocios** | Vercel empieza a facturar exceso de verdad | Medir. Si duele, evaluar Cloudflare o Railway |
| **Base > 8 GB** | Almacenamiento con cargo | Archivar citas de más de 2 años a almacenamiento frío |
| **Campañas de marketing masivas** | WhatsApp se dispara: marketing cuesta ~10× utilidad | Cupo por negocio y cobro aparte de las campañas |
| **Fotos sin optimizar** | La transferencia se vuelve el mayor costo | Transformación de imágenes obligatoria desde el día 1 |

**El que de verdad puede sorprender es WhatsApp con campañas de marketing.** Un
negocio que mande 3.000 mensajes promocionales en un mes cuesta más él solo que
diez negocios normales. Por eso las campañas de v2 nacen con cupo, y por eso la
tarea I5 (registro de costo por mensaje) es importante y no decorativa.

---

## Comparación con las alternativas que se descartaron

Para dimensionar si el stack elegido es caro o barato, a 100 negocios:

| Opción | USD/mes aprox. | Comentario |
|---|---|---|
| **Supabase + Vercel** ✅ | $216 – 246 | Cero operación |
| VPS propio (Hetzner/DO) + Postgres propio | $40 – 80 | Más barato en dinero, **mucho más caro en tiempo**: copias de seguridad, parches, monitoreo, disponibilidad |
| AWS administrado (RDS + ECS) | $300 – 600 | Más caro y bastante más complejo a esta escala |
| Firebase | $150 – 400 | Difícil de predecir; y el modelo no relacional no sirve acá (`04-stack-tecnologico.md`) |

Un VPS ahorra unos $150 USD al mes. Ese ahorro no compensa una noche arreglando
una base caída cuando 100 barberías no pueden abrir su agenda un sábado.

**Esa ecuación cambia alrededor de los 500 negocios**, cuando el ahorro se vuelve
significativo y ya hay ingresos para pagarle a alguien que lo opere. No antes.

---

## Qué vigilar desde el primer día

1. **Alertas de gasto en Vercel y Supabase**, configuradas antes del primer
   negocio real. Un pico inesperado hay que verlo el día que pasa.
2. **Costo de WhatsApp por negocio**, desde `notification_log`. Es el único que
   crece con el uso y el único que un negocio puede disparar solo.
3. **Tamaño de la base y de los archivos**, mensualmente.
4. **Margen real por negocio**, no el estimado de este documento. Con 20 negocios
   ya hay datos suficientes para reemplazar los supuestos por hechos.

> Este documento está lleno de estimaciones razonadas. **A los 20 negocios, hay
> que volver acá y reemplazarlas con lo que realmente se facturó.** Un supuesto
> que se quedó tres años sin revisar es la forma más común de descubrir tarde
> que el producto no tenía el margen que se creía.
