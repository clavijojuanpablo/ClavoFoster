// PreToolUse (Bash | PowerShell): comandos que tocan la base compartida,
// main o el historial. docs/12 y docs/14.

import { git, leerEntrada, negar, preguntar, raizDelProyecto } from './comun.mjs';

const EVENTO = 'PreToolUse';
const entrada = await leerEntrada();
const raiz = raizDelProyecto(entrada);
const cmd = String(entrada.tool_input?.command ?? '');

// La base de desarrollo está en la nube y es compartida: no hay reset seguro.
if (/supabase(\.cmd)?\s+db\s+reset\b/.test(cmd) && /--linked|--db-url/.test(cmd)) {
  negar(EVENTO, 'db reset contra el proyecto enlazado BORRA la base de desarrollo compartida. docs/12: si hace falta, el usuario lo hace a conciencia desde el dashboard.');
}
if (/supabase(\.cmd)?\s+(db\s+push|migration\s+repair|db\s+remote)|npm\s+run\s+db:push/.test(cmd)) {
  preguntar(EVENTO, 'Esto aplica cambios de esquema a la base de desarrollo en la nube (compartida). Revisa la migración antes: RLS, business_id, timestamptz, bigint.');
}
if (/\b(drop\s+table|truncate|delete\s+from)\b/i.test(cmd) && /(psql|supabase|sql)/i.test(cmd)) {
  preguntar(EVENTO, 'SQL destructivo directo contra una base. Todo cambio de esquema va por migración; los datos con historia no se borran (regla 5).');
}

// Git.
if (/git\s+add\s+.*(-f|--force).*\.env|git\s+add\s+.*\.env\.local/.test(cmd)) {
  negar(EVENTO, '.env.local no entra nunca al repositorio.');
}
if (/git\s+push\b.*(--force(?!-with-lease)|\s-f\b)/.test(cmd)) {
  negar(EVENTO, 'push --force reescribe historia compartida. Si es imprescindible en una rama propia, usa --force-with-lease y pídeselo al usuario.');
}
if (/git\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s|restore\s+\.)/.test(cmd)) {
  preguntar(EVENTO, 'Esto descarta cambios sin commit. Revisa git status antes: puede haber trabajo del usuario en curso.');
}

const rama = git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD']);
if (/git\s+commit\b/.test(cmd) && !/--amend/.test(cmd)) {
  if (rama === 'main' || rama === 'master') {
    preguntar(EVENTO, `Estás en ${rama}. docs/12: nunca se hace commit directo a main; cada tarea va en su rama (feat/<ID>-descripcion). ¿Es un merge a propósito?`);
  }
  const mensaje = extraerMensaje(cmd);
  if (mensaje !== null) {
    const primera = mensaje.split(/\r?\n/)[0].trim();
    const valido = /^(feat|fix|docs|refactor|test|chore|perf|style|build|ci|revert)(\([\w\-./áéíóúñ ]+\))?!?: .+/.test(primera) || /^Merge\b/.test(primera);
    if (!valido) {
      negar(EVENTO, `Mensaje "${primera}" no sigue Conventional Commits. Formato: tipo(ámbito): descripción en español. Ej. "feat(agenda): crear cita manual". Cierra con "Closes <ID>" si termina una tarea.`);
    }
  }
}
if (/git\s+push\b/.test(cmd) && (/\b(main|master)\b/.test(cmd) || rama === 'main')) {
  preguntar(EVENTO, 'Push a main despliega a producción en Vercel. ¿Pasaron test, typecheck, lint y build, y se probó en la vista previa?');
}

process.exit(0);

/** Primer mensaje de `git commit -m`, incluido heredoc de bash o here-string de PowerShell. */
function extraerMensaje(comando) {
  const heredoc = comando.match(/<<-?\s*['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\s*\1/);
  if (heredoc) return heredoc[2];
  const hereString = comando.match(/@'\s*\n([\s\S]*?)\n'@/);
  if (hereString) return hereString[1];
  const simple = comando.match(/-m\s+(["'])([\s\S]*?)\1/);
  if (simple && !simple[2].includes('$(')) return simple[2];
  return null;
}
