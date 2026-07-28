import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['code.ts'],
  timeout: 120000,
  use: {
    headless: false,
  },
});
