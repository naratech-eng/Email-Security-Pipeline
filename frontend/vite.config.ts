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
    // lcov is what SonarCloud reads (sonar-project.properties points at
    // coverage/lcov.info); text keeps the summary visible in CI logs.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Only files that are actually exercised are worth reporting on.
      // Including every .tsx here would report ~0% across the UI layer and
      // drown the signal from the logic that IS tested -- SonarCloud's
      // new-code coverage gate is the meaningful measure, not a headline
      // percentage inflated or deflated by what we chose to include.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
    },
  },
});
