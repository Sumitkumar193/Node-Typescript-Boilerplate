import { defineConfig } from 'vitest/config';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default defineConfig({
  resolve: {
    alias: {
      '@controllers': join(process.cwd(), 'src/controllers'),
      '@database': join(process.cwd(), 'src/database'),
      '@errors': join(process.cwd(), 'src/errors'),
      '@interfaces': join(process.cwd(), 'src/interfaces'),
      '@middlewares': join(process.cwd(), 'src/middlewares'),
      '@routes': join(process.cwd(), 'src/routes'),
      '@services': join(process.cwd(), 'src/services'),
      '@templates': join(process.cwd(), 'src/templates'),
      '@customTypes': join(process.cwd(), 'types'),
      '@validations': join(process.cwd(), 'src/validations'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
