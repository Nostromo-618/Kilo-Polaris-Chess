// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'unit/engine/AuroraBaseline.spec.js',
  fullyParallel: true,
  reporter: [['list']],
});
