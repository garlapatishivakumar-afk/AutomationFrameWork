import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://cashmanagement-sit.trimont.com/Whoiam.aspx');
  await page.locator('#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee').selectOption('T10748');
  await page.getByRole('button', { name: 'Run As User' }).click();
  await page.goto('https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx');
  await page.getByRole('link', { name: 'Loan Mgmt.' }).click();
  await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).click();
  await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).fill('4113002786');
  await page.getByRole('button', { name: 'Search [Alt-S]' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'View Recon' }).click();
  const page1 = await page1Promise;
  await page1.getByRole('button', { name: 'Get Recon' }).click();
});