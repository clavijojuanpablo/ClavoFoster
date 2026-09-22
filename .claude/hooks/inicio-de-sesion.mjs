// SessionStart: le da a Claude, en pocas líneas, dónde va el proyecto y en qué
// tarea está parada la rama actual. Lo largo sigue viviendo en docs/.

import { git, leerArchivo, leerEntrada, raizDelProyecto } from './comun.mjs';

const entrada = await leerEntrada();
const raiz = raizDelProyecto(entrada);
const lineas = [];

const rama = git(raiz, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? '(sin git)';
const cambios = (git(raiz, ['status', '--porcelain']) ?? '').split('\n').filter(Boolean);
lineas.push(`Rama: ${rama}${cambios.length ? ` · ${cambios.length} archivo(s) con cambios sin commit` : ' · árbol limpio'}`);
if (rama === 'main' || rama === 'master') {
  lineas.push('⚠ Estás en main: cada tarea va en su propia rama (feat/<ID>-descripcion). Nada de commits directos.');
}

const backlog = leerArchivo(raiz, 'docs/03-backlog.md') ?? '';
const total = backlog.match(/\*\*Total MVP\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*/);
if (total) lineas.push(`Avance del MVP: ${total[2]} de ${total[1]} tareas hechas (docs/03-backlog.md).`);

const id = rama.match(/^[a-z]+\/([A-K]\d+)\b/i)?.[1]?.toUpperCase();
if (id) {
  const fila = backlog.split('\n').find((l) => l.startsWith(`| ${id} |`));
  if (fila) {
    const [, , tarea, pri, estado] = fila.split('|').map((c) => c.trim());
    lineas.push(`Tarea de esta rama: ${id} — ${tarea} (prioridad ${pri}, estado ${estado}). Criterios en docs/03-backlog.md, sección de la épica.`);
  }
}

const pendientes = backlog
  .split('\n')
  .filter((l) => /^\| [A-K]\d+ \|/.test(l) && /\|\s*M\s*\|\s*Pendiente\s*\|/.test(l))
  .map((l) => l.split('|')[1].trim());
if (pendientes.length) lineas.push(`Pendientes de prioridad M: ${pendientes.join(', ')}.`);

lineas.push(
  'Flujo: /tarea <ID> para empezar una tarea, /revisar antes de commit, /cerrar-tarea para la definición de terminado, /estado para ubicarse. ' +
    'Hooks activos: revisan reglas de CLAUDE.md en cada archivo y corren typecheck + pruebas puras al terminar.',
);

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lineas.join('\n') } }),
);
