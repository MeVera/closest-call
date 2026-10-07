import { defineConfig, devices } from '@playwright/test';

// Screenshot run: `npm run screenshots`. Uses the dev server with ?demo (synthetic filler points)
// until every theme has enough real places. Output: screenshots/<project>/<screen>.png
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5179' },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'mobile-light', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: 'light', browserName: 'chromium' } },
    { name: 'mobile-dark', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: 'dark', browserName: 'chromium' } },
    { name: 'desktop-light', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'light' } },
    { name: 'desktop-dark', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' } },
  ],
});
