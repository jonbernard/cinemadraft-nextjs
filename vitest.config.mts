import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds Playwright specs, which Playwright runs. Without this
    // exclusion Vitest picks them up and fails on Playwright's globals.
    exclude: ['node_modules', '.next', 'e2e'],
  },
  resolve: {
    alias: { '@': import.meta.dirname },
  },
});
