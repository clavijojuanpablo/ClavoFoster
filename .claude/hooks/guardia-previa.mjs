// PreToolUse (Write | Edit | MultiEdit): frena lo que no tiene vuelta atrás
// antes de que llegue al disco. Reglas de CLAUDE.md y docs/12.

import { git, leerEntrada, negar, preguntar, raizDelProyecto, rutaRelativa, textoNuevo } from './comun.mjs';

const EVENTO = 'PreToolUse';
const entrada = await leerEntrada();
const raiz = raizDelProyecto(entrada);
const relativa = rutaRelativa(raiz, entrada.tool_input?.file_path);
const nombre = relativa.split('/').pop() ?? '';
const texto = textoNuevo(entrada.tool_input);

// 1. Archivos de entorno: los secretos se editan a mano, no desde el agente.
if (/^\.env(\..+)?$/.test(nombre) && nombre !== '.env.example') {
  negar(
    EVENTO,
    `${relativa} guarda secretos y no se edita desde Claude. Si falta una variable, agrégala a .env.example ` +
      '(sin valor) y a lib/env.ts, y pídele al usuario que ponga el valor en .env.local y en Vercel ' +
      '(Production, Preview y Development).',
  );
}

// 2. Next.js 16 ignora middleware.ts en silencio.
if (/^(src\/)?middleware\.(ts|js)$/.test(relativa)) {
  negar(
    EVENTO,
    'Next.js 16 renombró middleware.ts a proxy.ts. Un middleware.ts se ignora sin error y el panel quedaría ' +
      'sin proteger. Edita proxy.ts (raíz) o lib/supabase/proxy.ts.',
  );
}

// 3. Un secreto con prefijo público termina en el navegador.
const secretoPublico = texto.match(/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|SERVICE_ROLE|WEBHOOK|ACCESS|PRIVATE|PASSWORD)[A-Z0-9_]*/);
if (secretoPublico) {
  negar(
    EVENTO,
    `"${secretoPublico[0]}": NEXT_PUBLIC_ publica la variable en el navegador. Un secreto nunca lleva ese prefijo ` +
      '(docs/12-convenciones-de-desarrollo.md, "Variables de entorno").',
  );
}

// 4. Llaves pegadas en el código.
if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(texto) || /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(texto)) {
  negar(EVENTO, 'El texto trae una llave o un JWT literal. Los secretos viven solo en variables de entorno del servidor.');
}

// 5. Esquema viejo de llaves de Supabase.
if (/SUPABASE_(SERVICE_ROLE|ANON)_KEY/.test(texto)) {
  negar(
    EVENTO,
    'El proyecto usa el esquema nuevo de llaves: SUPABASE_SECRET_KEY (sb_secret_...) y ' +
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...). No las antiguas anon/service_role. ' +
      'Ojo: el ROL de Postgres sigue llamándose anon y las políticas "to anon" están bien.',
  );
}

// 6. Una migración ya versionada probablemente ya está aplicada en la base de desarrollo.
if (/^supabase\/migrations\/.+\.sql$/.test(relativa)) {
  const versionada = git(raiz, ['ls-files', '--error-unmatch', relativa]) !== null;
  if (versionada) {
    preguntar(
      EVENTO,
      `${relativa} ya está en git y casi seguro ya se aplicó con db:push. Editarla no cambia la base: el ` +
        'cambio se pierde en silencio y el esquema de desarrollo deja de coincidir con el repositorio. ' +
        'Lo normal es una migración NUEVA. ¿Seguro que hay que editar esta?',
    );
  }
}

process.exit(0);
