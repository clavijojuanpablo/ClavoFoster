// PostToolUse (Write | Edit | MultiEdit): revisa el archivo completo ya
// guardado contra las reglas del proyecto.
//
//   - "Graves" violan CLAUDE.md o docs/12: se le devuelven a Claude para que
//     las corrija antes de seguir.
//   - "Avisos" son patrones que en este repo ya causaron bugs: van como
//     contexto, sin frenar.
//
// Son heurísticas con expresiones regulares, no un analizador. Si una regla
// marca algo legítimo, la excepción se documenta acá, no se ignora.

import {
  avisar,
  bloquear,
  leerArchivo,
  leerEntrada,
  raizDelProyecto,
  rutaRelativa,
  sinComentariosSql,
  sinComentariosTs,
  textoNuevo,
} from './comun.mjs';

const EVENTO = 'PostToolUse';
const entrada = await leerEntrada();
const raiz = raizDelProyecto(entrada);
const relativa = rutaRelativa(raiz, entrada.tool_input?.file_path);
const contenido = leerArchivo(raiz, relativa);
if (contenido === null) process.exit(0);

const graves = [];
const avisos = [];

// Tablas globales, sin negocio dueño. Una tabla nueva sin business_id va acá
// solo si de verdad no pertenece a ningún negocio.
const TABLAS_GLOBALES = new Set(['businesses', 'service_templates']);

// Rule 5: lo que tiene historia no se borra.
const TABLAS_CON_HISTORIA = ['staff', 'services', 'customers', 'appointments', 'ledger_entries', 'subscriptions', 'businesses'];

// Únicos lugares donde puede vivir el cliente privilegiado (docs/12, "La llave secreta").
const ADMIN_PERMITIDO = [/^lib\/supabase\/admin\.ts$/, /^lib\/booking\//, /^lib\/notifications\//, /^lib\/billing\//, /^app\/api\//];

const esTs = /\.(ts|tsx|mts)$/.test(relativa);
const esPrueba = /^tests\//.test(relativa) || /\.test\.tsx?$/.test(relativa);
const esCodigoDeApp = esTs && !esPrueba && /^(app|lib|components)\//.test(relativa) || relativa === 'proxy.ts';

// --- Migraciones ---------------------------------------------------------------
if (/^supabase\/migrations\/.+\.sql$/.test(relativa)) {
  const sql = sinComentariosSql(contenido);

  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(relativa.split('/').pop())) {
    graves.push('El nombre de la migración debe ser AAAAMMDDHHMMSS_descripcion_en_snake_case.sql, como las demás.');
  }

  for (const m of sql.matchAll(/\btimestamp\b(?!\s+with\s+time\s+zone)/gi)) {
    graves.push(`Regla 3: "${m[0]}" sin zona. Todo instante va en timestamptz (UTC). La hora local solo existe al mostrar.`);
    break;
  }

  for (const m of sql.matchAll(/\b(\w+_cop)\s+(numeric|decimal|real|float\d?|double\s+precision|money|integer|int\b|int4|smallint)/gi)) {
    graves.push(`Dinero: "${m[1]}" debe ser bigint (pesos enteros), no ${m[2]}.`);
  }
  if (/\bmoney\b/i.test(sql)) graves.push('Dinero: no se usa el tipo money. bigint en pesos, columna *_cop.');

  const tablas = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)];
  for (const [, tabla, cuerpo] of tablas) {
    const rls = new RegExp(`alter\\s+table\\s+(?:public\\.)?${tabla}\\s+enable\\s+row\\s+level\\s+security`, 'i');
    if (!rls.test(sql)) {
      graves.push(`Regla 1: la tabla ${tabla} no tiene "alter table ${tabla} enable row level security" en esta migración.`);
    }
    if (!TABLAS_GLOBALES.has(tabla) && !/\bbusiness_id\b/.test(cuerpo)) {
      graves.push(
        `Regla 1: la tabla ${tabla} no tiene business_id. Si de verdad es global, agrégala a TABLAS_GLOBALES en .claude/hooks/revisar-archivo.mjs y justifícalo.`,
      );
    }
    const politica = new RegExp(`create\\s+policy[\\s\\S]*?\\bon\\s+(?:public\\.)?${tabla}\\b`, 'i');
    if (!politica.test(sql)) {
      avisos.push(`La tabla ${tabla} no tiene políticas en esta migración: con RLS y sin políticas, nadie con sesión la lee. ¿Es solo para el cliente privilegiado?`);
    }
    if (/\bbusiness_id\b/.test(cuerpo) && !new RegExp(`create\\s+(unique\\s+)?index[\\s\\S]*?on\\s+(?:public\\.)?${tabla}\\s*\\(\\s*business_id`, 'i').test(sql)) {
      avisos.push(`Falta un índice que empiece por business_id en ${tabla} (docs/05: "siempre en primer lugar de los índices compuestos").`);
    }
    if (/\bfloat|\breal\b|double\s+precision/i.test(cuerpo)) {
      avisos.push(`${tabla} tiene una columna de punto flotante. Si es dinero, bigint; si son coordenadas, está bien.`);
    }
  }

  for (const t of TABLAS_CON_HISTORIA) {
    if (new RegExp(`delete\\s+from\\s+(?:public\\.)?${t}\\b`, 'i').test(sql)) {
      graves.push(`Regla 5: "delete from ${t}". Lo que tiene historia se desactiva (is_active = false) o se archiva, no se borra.`);
    }
  }

  if (/security\s+definer/i.test(sql) && !/set\s+search_path/i.test(sql)) {
    graves.push('Una función security definer sin "set search_path" es inyectable. Agrega set search_path = public (o \'\').');
  }
  if (/\bdrop\s+(table|column)\b/i.test(sql)) {
    avisos.push('La migración borra una tabla o columna. Confirma con el usuario: si tiene datos con historia, se pierden.');
  }
  if (/add\s+column/i.test(sql) && /\bbusinesses\b/i.test(sql) && !/grant\s+update/i.test(sql)) {
    avisos.push('Columna nueva en businesses: si el dueño debe poder editarla, falta "grant update (columna) on businesses to authenticated" (trampa conocida en docs/14).');
  }

  avisos.push(
    'Migración tocada. Antes de cerrar: (1) pedirle al usuario permiso para "npm run db:push" (base compartida en la nube), ' +
      '(2) "npm run db:types", (3) actualizar docs/07-modelo-de-datos.md, (4) si hay tabla nueva, sumarla a tests/aislamiento.test.ts. ' +
      'Para una revisión a fondo: agente revisor-migraciones.',
  );
}

// --- Lógica pura -----------------------------------------------------------------
if (/^lib\/(scheduling|agenda)\/.+\.ts$/.test(relativa) && !esPrueba) {
  const ts = sinComentariosTs(contenido);
  const prohibidos = ts.match(/from\s+['"](@supabase\/[^'"]*|next(\/[^'"]*)?|react(-dom)?|server-only|@\/lib\/supabase[^'"]*|@\/lib\/tenant|@\/lib\/env|node:fs|fs)['"]/g);
  if (prohibidos) {
    graves.push(`lib/scheduling y lib/agenda son lógica pura: no pueden importar ${[...new Set(prohibidos)].join(', ')}. Los datos se traen afuera y se pasan por parámetro.`);
  }
  if (/Date\.now\(\)|new\s+Date\(\s*\)/.test(ts)) {
    graves.push('La lógica pura no lee la hora del sistema: "ahora" se recibe como parámetro (docs/12, "La regla de lib/scheduling").');
  }
  if (/^lib\/scheduling\//.test(relativa)) {
    avisos.push('Tocaste el motor de cupos. Corre "npx vitest run tests/motor-de-cupos.test.ts" y verifica los casos de docs/06, incluidos los bordes. Para una revisión experta: agente revisor-motor.');
  }
}

// --- Código de la aplicación ------------------------------------------------------
// Se revisa solo el texto que trae esta edición (en un Write, el archivo entero):
// así una edición pequeña no obliga a arreglar código viejo que no se tocó.
if (esCodigoDeApp) {
  const completo = sinComentariosTs(contenido);
  const ts = sinComentariosTs(textoNuevo(entrada.tool_input) || contenido);
  const sinTextos = ts.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''");
  const esCliente = /^\s*['"]use client['"]/m.test(contenido);
  const esBorde = /^app\//.test(relativa) || relativa === 'proxy.ts';

  if (/from\s+['"]@\/lib\/supabase\/admin['"]/.test(ts) && !ADMIN_PERMITIDO.some((r) => r.test(relativa))) {
    graves.push(
      `${relativa} importa el cliente privilegiado (salta toda RLS). Solo se permite en la reserva pública (lib/booking), webhooks y trabajos programados (app/api), notificaciones y cobros. ` +
        'Usa lib/supabase/server.ts. Si es un caso nuevo legítimo, se justifica en el comentario de lib/supabase/admin.ts y en docs/12 antes de agregarlo acá.',
    );
  }

  if (esCliente && /from\s+['"](@\/lib\/supabase\/(server|admin)|server-only|@\/lib\/tenant)['"]/.test(completo)) {
    graves.push(`${relativa} es 'use client' e importa código de servidor. Eso o revienta el build o filtra secretos al navegador.`);
  }
  if (esCliente && /serverEnv\s*\(/.test(completo)) {
    graves.push(`${relativa} es 'use client' y llama serverEnv(): los secretos no pueden viajar al navegador.`);
  }

  // En lib/ un businessId por parámetro es normal: ya lo resolvió el servidor.
  // El peligro está en el borde (app/), donde entra lo que manda el navegador.
  const idDeNegocio = ts.match(
    /(formData|searchParams|params|body|datos|input|req\.query)\s*(\.get\(\s*|\??\.|\[\s*)['"]?(business_?id|tenant_?id|businessId|tenantId|negocio_?id|negocioId)\b/i,
  );
  if (idDeNegocio && esBorde) {
    graves.push(`Regla 2: "${idDeNegocio[0]}". El negocio jamás viene del navegador: sale de requireDueno()/getContexto de lib/tenant.ts o del slug verificado.`);
  }

  for (const t of TABLAS_CON_HISTORIA) {
    const borrado = ts.match(new RegExp(`from\\(\\s*['"]${t}['"]\\s*\\)[\\s\\S]{0,200}?\\.delete\\([\\s\\S]{0,300}`));
    // Excepción: las retenciones vencidas (status 'pending' con expires_at) no son historia: cleanup-holds las borra.
    if (borrado && !/['"](pending|held)['"]|expires_at/.test(borrado[0])) {
      graves.push(`Regla 5: .delete() sobre ${t}. Se desactiva (is_active = false) o se archiva; no se borra.`);
    }
  }

  if (/\b(price_cop|duration_minutes)\s*:\s*(formData|datos|input|body)\b/.test(ts) && esBorde) {
    graves.push('Regla 4 / docs/13: precio y duración de la cita se re-resuelven desde el servicio en la base, no desde lo que mandó el navegador.');
  }

  if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(ts)) {
    avisos.push('Hay un catch vacío. docs/12: "nunca se traga un error en silencio". Si es a propósito (cookies de Supabase SSR, localStorage), un comentario que lo diga.');
  }
  if (/console\.(log|info|warn|error)\([^)]*\b(telefono|phone|celular|nombre|customer_?name|full_?name)\b/i.test(sinTextos)) {
    avisos.push('Un console.* parece registrar datos del cliente final. Nunca teléfonos ni nombres en bitácoras (docs/12, "Datos personales").');
  }
  if (/\.tsx$/.test(relativa)) {
    if (/<form[^>]*\saction=\{/.test(ts) && /type=["'](radio|checkbox)["']|<select/.test(contenido)) {
      avisos.push('<form action={...}> con radios/checkboxes: React 19 reinicia el formulario al terminar la acción. Usa onSubmit={enviarSinReiniciar(...)} de lib/formularios.ts (docs/14).');
    }
    const horaConIntl =
      /toLocale(Time)?String\(/.test(ts) || (/Intl\.DateTimeFormat/.test(ts) && /\bhour\s*:/.test(ts) && !/hour12\s*:\s*false|hourCycle/.test(ts));
    if (horaConIntl && esCliente) {
      avisos.push('Hora formateada con Intl en un componente de cliente: el espacio antes de "a. m." cambia entre Node y el navegador y rompe la hidratación (docs/14). Usa lib/formato.ts.');
    }
    if (/['"`>]\s*Bookia\b/.test(ts)) {
      avisos.push('El nombre del producto va desde NOMBRE_PRODUCTO de lib/marca.ts, no escrito suelto.');
    }
    if (/#[0-9a-fA-F]{6}\b/.test(ts)) {
      avisos.push('Color hex suelto. docs/15: se usan los tokens (bg-tinta, text-lima, bg-papel...). Única excepción: grises de superficies oscuras (menú lateral, barra inferior, marco de acceso).');
    }
  }
  if (/auth\.getUser\(\)/.test(ts) && /^(app\/\(admin\)\/panel|lib\/panel)\//.test(relativa)) {
    avisos.push('En el panel la sesión se verifica con getClaims() (lib/tenant.ts), no getUser(): cada getUser es ~200 ms más (docs/14).');
  }
  if (/^app\/.*\/actions\.ts$/.test(relativa) && !/from\s+['"]zod['"]|\.safeParse\(|\.parse\(/.test(completo)) {
    avisos.push('Server Action sin validación Zod visible. docs/13: toda entrada se valida con Zod antes de tocar nada.');
  }
}

// --- Rutas nuevas de primer nivel ------------------------------------------------------
const rutaPrimerNivel = relativa.match(/^app\/\([^)]+\)\/([^/[(]+)\/page\.tsx$/);
if (rutaPrimerNivel && entrada.tool_name === 'Write') {
  avisos.push(`Ruta de primer nivel /${rutaPrimerNivel[1]}: si no está en slug_es_reservado() (base) y en lib/validation/negocio.ts, un negocio podría quedarse con ese slug.`);
}

if (graves.length) {
  bloquear(
    `Revisión automática de ${relativa} — hay que corregir antes de seguir:\n- ${graves.join('\n- ')}` +
      (avisos.length ? `\n\nAdemás:\n- ${avisos.join('\n- ')}` : ''),
  );
}
if (avisos.length) avisar(EVENTO, `Revisión automática de ${relativa}:\n- ${avisos.join('\n- ')}`);
process.exit(0);
