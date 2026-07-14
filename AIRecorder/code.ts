import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login');
});