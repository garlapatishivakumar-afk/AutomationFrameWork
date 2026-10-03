import fs from 'fs';
import path from 'path';
import { defineConfig } from '@playwright/test';

const sessionPath = path.resolve(__dirname, 'auth', 'session.json');

function isSessionValid(sessionFile: string, maxAgeDays = 4): boolean {
  if (!fs.existsSync(sessionFile)) {
    return false;
  }

  const fileInfo = fs.statSync(sessionFile);
  if (fileInfo.size <= 0) {
    return false;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return Date.now() - fileInfo.mtimeMs <= maxAgeMs;
}

export default defineConfig({
  testDir: '..',
  testMatch: ['Code.ts'],
  timeout: 120000,
  use: {
    headless: false,
    ...(isSessionValid(sessionPath) ? { storageState: sessionPath } : {}),
  },
});
