import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'Deals', exact: true }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.goto('https://investorreporting-mb-sit.trimont.com/IRDeals/DealsCompletionStatus.aspx');
  await page.locator('input[name="ctl00$cp1$txtTID"]').click();
  await page.locator('input[name="ctl00$cp1$txtTID"]').fill('1155aofa');
  await page.locator('input[name="ctl00$cp1$txtTID"]').press('Enter');
  await page.getByRole('link', { name: '1155AOFA' }).click();
  await page.locator('#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl05_chAction').check();
  await page.locator('#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl07_chAction').check();
  await page.locator('#ctl00_ContentPlaceHolder1_rgrdReports_ctl00_ctl05_lnkView').click();
  await page.goto('https://investorreporting-mb-sit.trimont.com/IRDeals/DealReportDetailNew.aspx?rpt=NTORCashActionForm');
  await page.getByRole('link', { name: 'complete', exact: true }).click();
  await page.getByRole('button', { name: 'close screen' }).click();
});