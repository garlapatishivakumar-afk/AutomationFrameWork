import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://inspections-dev.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'CMBS' }).click();
  await page.getByRole('link', { name: 'Exceptions' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.locator("//a[@id='ctl00_ContentPlaceHolder1_RadGridInspectionExceptions_ctl00_ctl02_ctl00_lnkExceptionsReport']").click();
  const page1 = await page1Promise;
  await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByRole('button', { name: 'Refresh' }).click();
  await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByRole('button', { name: 'Refresh' }).click();
  await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByTestId('toolbar-export-dropdown').click();
  const downloadPromise = page1.waitForEvent('download');
  await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByTestId('export-xlsx-btn').click();
  const download = await downloadPromise;
});