// Utilidades compartidas por los hooks de Claude Code de este proyecto.
// Sin dependencias: corre con el Node del sistema, en Git Bash o PowerShell.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export async function leerEntrada() {
  let texto = '';
  for await (const trozo of process.stdin) texto += trozo;
  try {
    return JSON.parse(texto || '{}');
  } catch {
    return {};
  }
}

export function raizDelProyecto(entrada = {}) {
  return aWindows(process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd());
}

/** Git Bash escribe /c/Proyectos; Node en Windows espera C:/Proyectos. */
function aWindows(ruta) {
  return process.platform === 'win32' ? ruta.replace(/^\/([a-zA-Z])\//, '$1:/') : ruta;
}

/** Ruta relativa a la raíz, siempre con `/`, para comparar sin pensar en Windows. */
export function rutaRelativa(raiz, archivo) {
  if (!archivo) return '';
  const normal = aWindows(archivo);
  const absoluta = path.isAbsolute(normal) ? normal : path.join(raiz, normal);
  return path.relative(raiz, absoluta).split(path.sep).join('/');
}

export function leerArchivo(raiz, relativa) {
  const absoluta = path.join(raiz, relativa);
  return existsSync(absoluta) ? readFileSync(absoluta, 'utf8') : null;
}

export function git(raiz, args) {
  try {
    return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** Texto nuevo que trae una edición, sea Write, Edit o MultiEdit. */
export function textoNuevo(toolInput = {}) {
  if (typeof toolInput.content === 'string') return toolInput.content;
  if (typeof toolInput.new_string === 'string') return toolInput.new_string;
  if (Array.isArray(toolInput.edits)) return toolInput.edits.map((e) => e.new_string ?? '').join('\n');
  return '';
}

/** Quita comentarios de SQL para no marcar reglas por lo que dice un comentario. */
export function sinComentariosSql(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

/** Quita comentarios de TS/JS (aproximado: suficiente para heurísticas). */
export function sinComentariosTs(ts) {
  return ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

// --- Salidas -----------------------------------------------------------------

export function negar(evento, motivo) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: evento, permissionDecision: 'deny', permissionDecisionReason: motivo },
    }),
  );
  process.exit(0);
}

export function preguntar(evento, motivo) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: evento, permissionDecision: 'ask', permissionDecisionReason: motivo },
    }),
  );
  process.exit(0);
}

/** PostToolUse: le devuelve a Claude un problema que tiene que corregir ya. */
export function bloquear(motivo) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: motivo }));
  process.exit(0);
}

/** Contexto adicional que Claude lee, sin frenar nada. */
export function avisar(evento, texto) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: evento, additionalContext: texto } }));
  process.exit(0);
}
