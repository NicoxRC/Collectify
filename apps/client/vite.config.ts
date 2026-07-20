import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Tests shouldn't depend on a developer having created .env.local —
    // inject a fixed value so `import.meta.env.VITE_API_URL` is always set.
    env: {
      VITE_API_URL: 'http://localhost:3000/api/v1',
    },
  },
});
