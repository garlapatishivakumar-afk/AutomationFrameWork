import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'Deals', exact: true }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__8']//td[2]/a").click();
  await page.locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_lnkView']").click();
  const page1Promise = page.waitForEvent('popup');
  await page.locator("//a[@id='g_ctl02_hE_4']").click();
  const page1 = await page1Promise;
  await page1.getByText('Field Value:').click();
  await page1.locator('#txtOverrideValue').click();
  await page1.locator('#txtOverrideValue').fill('1324');
  await page1.locator('#txtOverrideRule').click();
  await page1.locator('#txtOverrideRule').click();
  await page1.locator('#txtOverrideRule').click();
  await page1.locator('#txtOverrideExplan').click();
  await page1.locator('#txtOverrideExplan').fill('test');
  await page1.getByRole('button', { name: 'OK' }).click();
});