import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://cashadministration-mb-sit.trimont.com/WebForms/DashBoard.aspx');
  await page.getByRole('link', { name: 'External Wires' }).click();
  await page.getByRole('link', { name: 'Create External Wire' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail_ctl00_txtAmount').fill('12');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbRepetitiveCode_Input').fill('13');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('cell', { name: '-DOLP733PROPERTIE' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_txtAccountCity').fill('USA');
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_Arrow').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().locator('#ctl00_ContentPlaceHolder1_CMGTab1_Detail_0_TabPage_ctl00_wfwcInternalWireDetail2_ctl00_cmbToAccountState_DropDown').getByText('AR').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('link', { name: 'Save' }).click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByText('Transaction ID 5972746 has').click();
  await page.locator('iframe[name="rwExternalWire"]').contentFrame().getByRole('link', { name: 'Submit & New' }).click();
  await page.locator("//table//a[text()='Close']").click();
  await page.locator("//input[@id='ctl00_ContentPlaceHolder1_WFC_ContentContainerControl1_ctl00_rgExternalWireQueue_ctl00_ctl02_ctl02_RadComboBox1WFItemID_Input']").click();
  await page.locator('#ctl00_ContentPlaceHolder1_WFC_ContentContainerControl1_ctl00_rgExternalWireQueue_ctl00_ctl02_ctl02_RadComboBox1WFItemID_Input').fill('5972746');
  await page.locator('#ctl00_ContentPlaceHolder1_WFC_ContentContainerControl1_ctl00_rgExternalWireQueue_ctl00_ctl02_ctl02_RadComboBox1WFItemID_Input').press('Enter');
});