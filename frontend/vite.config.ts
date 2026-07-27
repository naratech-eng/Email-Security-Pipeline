/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Cognito callback expects http://localhost:3000/callback (see README).
    port: 3000,
    strictPort: true,
  },
  // Vitest reads this config, so the `@` alias above resolves in tests too —
  // no second copy to drift. `node` because everything under test is pure
  // derivation; component tests will opt into jsdom per-file when they land.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
