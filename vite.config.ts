import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative so the build works on any static host,
// including GitHub Pages project sites served from a sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
