// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Browser Chess
 * - Chromium only (per requirements)
 * - Desktop + Mobile viewport testing
 * - Uses the local Node static server on port 3000
 */
export default defineConfig({
  testDir: './tests',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Reporter to use */
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  
  /* Shared settings for all projects */
  use: {
    /* Base URL for tests */
    baseURL: 'http://localhost:3000',
    
    /* Collect trace when retrying */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for Chromium only (desktop + mobile) */
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],

  /* Run local server before tests */
  webServer: {
    command: 'node tests/server/static-server.mjs 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
