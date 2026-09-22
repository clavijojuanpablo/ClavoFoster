import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd()),
      // `server-only` existe para que el empaquetador reviente si un módulo de
      // servidor se cuela en el navegador, y revienta también acá. En vitest
      // todo corre en Node, así que se cambia por un módulo vacío y así se
      // puede probar `lib/booking` y lo que venga después.
      'server-only': path.resolve(process.cwd(), 'tests/server-only.ts'),
    },
  },
});
