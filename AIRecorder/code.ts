import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://documentadministration-uat.trimont.com/');
  await page.getByRole('link', { name: 'Administration' }).click();
  await page.getByRole('link', { name: 'Reassign Packages' }).click();
  await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');
  await page.getByRole('button', { name: 'Search Queue' }).click();
  await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();
  await page.locator('#ctl00_ContentPlaceHolder1_ddlUsers').selectOption('T11542');
  await page.getByRole('button', { name: 'Assign to Selected User' }).click();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.goto('https://documentadministration-uat.trimont.com/Default.aspx');
  await page.locator('#ctl00_ContentPlaceHolder1_ddlPackageSource').selectOption('569');
  await page.goto('https://documentadministration-uat.trimont.com/Default.aspx');
});