import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://cashadministration-sit.trimont.com/Whoiam.aspx');
  await page.locator('#ctl00_ContentPlaceHolder1_cboEmployee').selectOption('T11530');
  await page.getByRole('button', { name: 'Run As User' }).click();
  await page.goto('https://cashadministration-sit.trimont.com/WebForms/DashBoard.aspx');
  await page.getByRole('link', { name: 'External Wires' }).click();
  await page.getByRole('link', { name: 'Create External Wire' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').fill('17');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').fill('32');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('cell', { name: '-TDCPERSHINGLLC' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountAddress').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountAddress').fill('USA');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').fill('SY');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_Arrow').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_DropDown').getByText('CO').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtToAccountZipCode').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtToAccountZipCode').fill('12345');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('link', { name: 'Save' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByText('Transaction ID 5856737 has').click();
});