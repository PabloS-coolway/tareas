/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Tests del front (Vitest). El motor de la tabla (filtros, orden, facetas) tiene lógica real:
  // sus dos primeros bugs los cazó el usuario a mano, no un test. Aquí se cierra ese hueco.
  test: {
    environment: 'jsdom',
    include: ['test/**/*.spec.{ts,tsx}'],
    // Necesario para que Testing Library limpie el DOM entre tests: sin esto se acumulan los
    // renders y aparecen "elementos duplicados" que no existen en la app.
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      /**
       * Se mide la LÓGICA, no la presentación: el motor de la tabla, el dominio y los casos de uso.
       * Las páginas y los gateways HTTP quedan fuera a propósito — no es una trampa para inflar el
       * número: es que un test de jsdom sobre una página da una falsa sensación de seguridad, y los
       * fallos que ahí importan (el sticky roto, el "seleccionar todo") sólo se ven en un navegador
       * de verdad. Eso se cubre probando la app, no subiendo este porcentaje.
       */
      include: ['src/ui/components/table/**', 'src/domain/**', 'src/application/**'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/*.port.ts', '**/types.ts'],
      thresholds: { statements: 75, branches: 70, functions: 75, lines: 75 },
    },
  },
  resolve: {
    alias: {
      '@yorga/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // Configurables por entorno: en esta máquina conviven varios proyectos (WEB_PORT / API_URL).
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      // El front llama a /api y Vite lo redirige a la API NestJS en desarrollo.
      '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
});
