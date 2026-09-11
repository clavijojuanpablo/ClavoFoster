// Carga .env.local para las pruebas que tocan la base real.
// process.loadEnvFile existe desde Node 20.12.
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}
