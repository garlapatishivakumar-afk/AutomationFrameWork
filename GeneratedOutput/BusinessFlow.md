# Business Flow

## View Loan Reconciliation
- Navigate: https://cashmanagement-sit.trimont.com/Whoiam.aspx
- Select: await page.locator('#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee').selectOption('T10748');
- Click: await page.getByRole('button', { name: 'Run As User' }).click();
- Navigate: https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx
- Click: await page.getByRole('link', { name: 'Loan Mgmt.' }).click();
- Click: await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).click();
- Fill: await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).fill('4113002786');
- Click: await page.getByRole('button', { name: 'Search [Alt-S]' }).click();
- Popup: const page1Promise = page.waitForEvent('popup');
- Click: await page.getByRole('link', { name: 'View Recon' }).click();
- Click: await page1.getByRole('button', { name: 'Get Recon' }).click();

