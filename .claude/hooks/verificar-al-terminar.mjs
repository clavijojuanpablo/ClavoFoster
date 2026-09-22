// Stop: antes de que Claude diga "listo", corre typecheck y las pruebas que no
// tocan la base. Solo si el árbol cambió desde la última verificación, para no
// repetir 20 segundos en cada respuesta.
//
// Las pruebas que crean usuarios contra Supabase NO corren acá: agotan el límite
// de Auth (docs/14, "Trampas conocidas"). Esas se corren a mano con npm run test.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { git, leerEntrada, raizDelProyecto } from './comun.mjs';

const entrada = await leerEntrada();
if (entrada.stop_hook_active) process.exit(0);

const raiz = raizDelProyecto(entrada);
const estado = git(raiz, ['status', '--porcelain']) ?? '';
const cambiados = estado
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
const codigo = cambiados.filter((f) => /\.(ts|tsx|mts)$/.test(f));
if (!codigo.length) process.exit(0);

// Huella del estado actual: si no cambió desde la última vez, no se repite.
const huella = createHash('sha1')
  .update(estado)
  .update(git(raiz, ['diff']) ?? '')
  .update(codigo.filter((f) => existsSync(path.join(raiz, f))).map((f) => readFileSync(path.join(raiz, f), 'utf8')).join('\0'))
  .digest('hex');
const carpetaCache = path.join(raiz, '.claude', '.cache');
const archivoHuella = path.join(carpetaCache, 'ultima-verificacion');
if (existsSync(archivoHuella) && readFileSync(archivoHuella, 'utf8') === huella) process.exit(0);
mkdirSync(carpetaCache, { recursive: true });
writeFileSync(archivoHuella, huella);

const fallas = [];

const tsc = correr('npx tsc --noEmit --pretty false', 120_000);
if (!tsc.ok) {
  const errores = tsc.salida.split('\n').filter((l) => /error TS\d+/.test(l));
  let texto = `typecheck falló (${errores.length} error(es)):\n${errores.slice(0, 15).join('\n')}`;
  if (/does not satisfy the constraint/.test(tsc.salida)) {
    texto += '\nPista: tipos de rutas viejos tras agregar una página o layout → "npx next typegen" (docs/14).';
  }
  fallas.push(texto);
}

if (cambiados.some((f) => /^(lib|tests)\//.test(f))) {
  const puras = pruebasPuras();
  if (puras.length) {
    const vitest = correr(`npx vitest run ${puras.join(' ')}`, 150_000);
    if (!vitest.ok) {
      const resumen = vitest.salida
        .split('\n')
        .filter((l) => /FAIL|✗|×|AssertionError|Expected|Received|Tests\s+\d/.test(l))
        .slice(0, 25);
      fallas.push(`Pruebas unitarias (sin base) fallaron:\n${resumen.join('\n')}`);
    }
  }
}

if (fallas.length) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `Verificación automática antes de terminar:\n\n${fallas.join('\n\n')}\n\nCorrígelo, o si no es de este cambio, dile al usuario qué falla y por qué.`,
    }),
  );
}
process.exit(0);

function correr(comando, timeout) {
  try {
    const salida = execSync(comando, { cwd: raiz, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, salida };
  } catch (e) {
    return { ok: false, salida: `${e.stdout ?? ''}\n${e.stderr ?? ''}` };
  }
}

/** Pruebas que no tocan Supabase: se detectan solas, así una prueba nueva entra sin tocar este archivo. */
function pruebasPuras() {
  const carpeta = path.join(raiz, 'tests');
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta)
    .filter((f) => f.endsWith('.test.ts'))
    .filter((f) => !/createClient\(|SUPABASE_SECRET_KEY|createAdminClient|@\/lib\/supabase/.test(readFileSync(path.join(carpeta, f), 'utf8')))
    .map((f) => `tests/${f}`);
}
