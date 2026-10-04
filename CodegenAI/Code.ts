import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'Deals', exact: true }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.locator("//input[@id='ctl00_cp1_gd_ctl00_ctl18_chRoll']").check();
  await page.locator("//table[@id='maingrid']//tr[.//span[@class='rbText']]//span[@class='rbText']").click();
  await page.getByRole('link', { name: 'OK' }).click();
  await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__8']//td[2]/a").click();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_chAction']").check();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl16_chAction']").check();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl18_chAction']").check();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl20_chAction']").check();
  await page.locator("//a[@id='ctl00_ContentPlaceHolder1_2_generating']").click();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_btnOk']").click();
  await page.locator("//a[@id='ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl14_lnkView']").click();
  const page1Promise = page.waitForEvent('popup');
  await page.locator("//a[@id='g_ctl03_hE_4']").click();
  const page1 = await page1Promise;
  await page1.getByText('Effective From:').click();
  await page1.getByText('Effective To:').click();
  await page1.getByText('Field Name:').click();
  await page1.getByText('Field Value:').click();
  await page1.getByText('Override Value:').click();
});