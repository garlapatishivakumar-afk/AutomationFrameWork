import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login');
  await page.getByRole('link', { name: 'I can\'t use my Microsoft' }).click();
  await page.getByRole('button', { name: 'Use a verification code' }).click();
  await page.getByRole('textbox', { name: 'Enter code' }).fill('038098');
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.getByRole('link', { name: 'Deals' }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.goto('https://investorreporting-mb-sit.trimont.com/IRDeals/DealsCompletionStatus.aspx');
  await page.locator('input[name="ctl00$cp1$txtTID"]').click();
  await page.locator('input[name="ctl00$cp1$txtTID"]').fill('1Lin04c3');
  await page.locator('input[name="ctl00$cp1$txtTID"]').press('Enter');
  await page.getByText('No records to display.').click();
  await page.locator('input[name="ctl00$cp1$txtTID"]').click();
  await page.locator('input[name="ctl00$cp1$txtTID"]').fill('');
  await page.locator('input[name="ctl00$cp1$txtTID"]').press('Enter');
  await page.locator('input[name="ctl00$cp1$txtTID"]').click();
  await page.locator('input[name="ctl00$cp1$txtTID"]').fill('01cmlb1');
  await page.locator('input[name="ctl00$cp1$txtTID"]').press('Enter');
  await page.getByRole('link', { name: '01CMLB1' }).click();
  await page.goto('https://investorreporting-mb-sit.trimont.com/IRDeals/DealReportsList.aspx');
  await page.getByText('Transaction: 01CMLB1 (').click();
});