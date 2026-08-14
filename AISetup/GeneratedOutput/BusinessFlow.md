# Business Flow

## View Dashboard
- Navigate: https://documentadministration-uat.trimont.com/
- Click: await page.getByRole('link', { name: 'Administration' }).click();
- Click: await page.getByRole('link', { name: 'Reassign Packages' }).click();
- Select: await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');
- Click: await page.getByRole('button', { name: 'Search Queue' }).click();
- Check: await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();
- Select: await page.locator('#ctl00_ContentPlaceHolder1_ddlUsers').selectOption('T11542');
- Click: await page.getByRole('button', { name: 'Assign to Selected User' }).click();
- Click: await page.getByRole('link', { name: 'Dashboard' }).click();
- Navigate: https://documentadministration-uat.trimont.com/Default.aspx
- Select: await page.locator('#ctl00_ContentPlaceHolder1_ddlPackageSource').selectOption('569');
- Navigate: https://documentadministration-uat.trimont.com/Default.aspx

