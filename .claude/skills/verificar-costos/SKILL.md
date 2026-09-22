---
name: verificar-costos
description: Verifica en fuentes oficiales las tarifas actuales de los proveedores de Bookia (Supabase, Vercel, WhatsApp Cloud API para Colombia, Mercado Pago, Resend) y actualiza docs/10-costos-de-infraestructura.md con fecha y fuente. Úsala antes de fijar precios, al revisar márgenes o cuando una cifra tenga más de tres meses.
argument-hint: <opcional - proveedor>
---

# Verificar costos

CLAUDE.md: **no se inventan precios ni tarifas de proveedores.** Cada cifra
lleva fecha de verificación y fuente.

1. Lee `docs/10-costos-de-infraestructura.md` y `docs/01-modelo-de-negocio-y-precios.md`:
   anota cada cifra, su fecha y qué supuesto depende de ella.
2. Para cada proveedor pedido (**$ARGUMENTS**, o todos), busca la página
   oficial de precios con WebSearch/WebFetch. Solo fuentes oficiales o la
   documentación del proveedor; si solo hay fuentes de terceros, dilo.
   - WhatsApp: tarifa por mensaje/conversación de **Colombia** por categoría
     (autenticación, utilidad, marketing) y el modelo de cobro vigente.
   - Mercado Pago: comisión de suscripciones en Colombia.
   - Supabase y Vercel: plan que corresponde al uso proyectado.
3. Presenta una tabla: cifra anterior → cifra actual, fuente (URL), fecha de hoy.
4. Si cambia un margen de `docs/01`, recalcúlalo y muestra el efecto por plan.
5. Actualiza los documentos solo con aprobación del usuario.
