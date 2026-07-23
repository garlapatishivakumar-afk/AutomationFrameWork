import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://cashadministration-sit.trimont.com/Whoiam.aspx');
  await page.locator('#ctl00_ContentPlaceHolder1_cboEmployee').selectOption('T11550');
  await page.getByRole('button', { name: 'Run As User' }).click();
  await page.goto('https://cashadministration-sit.trimont.com/WebForms/DashBoard.aspx');
  await page.getByRole('link', { name: 'External Wires' }).click();
  await page.goto('https://cashadministration-sit.trimont.com/WebForms_ExternalWire/ExternalWireQueue.aspx');
  await page.getByRole('link', { name: 'Create External Wire' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').fill((Math.floor(Math.random() * 90) + 10).toString());
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').fill((Math.floor(Math.random() * 90) + 10).toString()); // Add wait after this line to wait for the dropdown to populate
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator("//div[@id='ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_DropDown']//td[1]").click(); // Click on any random value from the dropdown and wait for the next dropdown to populate
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountAddress').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountAddress').fill('USA'); // Fill the address with any random value
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').fill('NY'); // Fill the city with any random value
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_Arrow').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator("//div[@id='ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_DropDown']//li").click(); // Skip the first value and click on any random value from the dropdown
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtToAccountZipCode').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtToAccountZipCode').fill((Math.floor(10000 + Math.random() * 90000)).toString());
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('link', { name: 'Save' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByText('Transaction ID 5856731 has').click(); // Save the transaction ID in a variable and use it for the next steps
});