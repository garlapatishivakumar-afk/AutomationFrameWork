import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://inspections-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'Search' }).nth(1).click();
  await page.locator('#ctl00_ContentPlaceHolder1_NewSearchControl1_txtSearchValue').click();
  await page.locator('#ctl00_ContentPlaceHolder1_NewSearchControl1_txtSearchValue').fill('6678');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('cell', { name: '310929478', exact: true }).click();
});