import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'Deals', exact: true }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__5']//td[8]").click();
  await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__5']//td[6]").click();
  await page.locator("//input[@id='ctl00_cp1_gd_ctl00_ctl18_chRoll']").check();
  await page.getByRole('button', { name: 'Next Page' }).click();
  await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__9']//td[2]/a").click();
  await page.locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl07_lnkView']").click();
  await page.locator("//a[@id='g_ctl08_hE_4']").click();
  await page.locator("//a[@id='g_ctl08_hE_5']").click();
  const page1Promise = page.waitForEvent('popup');
  await page.locator("//a[@id='g_ctl08_hE_6']").click();
  const page1 = await page1Promise;
  await page.locator("//a[@id='g_ctl08_hE_31']").click();
  await page.locator("//a[@id='g_ctl08_hE_42']").click();
  const page2Promise = page.waitForEvent('popup');
  await page.locator("//a[@id='g_ctl08_hE_58']").click();
  const page2 = await page2Promise;
});