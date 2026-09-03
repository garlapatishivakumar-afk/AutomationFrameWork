import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function stageUploadFile(sourcePathOrName: string): string {
  const projectRoot = process.cwd();
  const uploadsDir = path.join(projectRoot, 'Uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const destinationPath = path.join(uploadsDir, path.basename(sourcePathOrName));
  const candidatePaths: string[] = [];

  if (path.isAbsolute(sourcePathOrName)) {
    candidatePaths.push(sourcePathOrName);
  } else {
    candidatePaths.push(
      path.join(projectRoot, sourcePathOrName),
      path.join(projectRoot, 'AIRecorder', sourcePathOrName),
      path.join(projectRoot, 'DataFiles', sourcePathOrName),
      path.join(os.homedir(), 'Downloads', sourcePathOrName)
    );
  }

  const sourcePath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (sourcePath) {
    if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
    return destinationPath;
  }

  if (fs.existsSync(destinationPath)) {
    return destinationPath;
  }

  throw new Error(
    `Upload source file not found for "${sourcePathOrName}". Place the file in Uploads or Downloads.`
  );
}

test('test', async ({ page }) => {
  await page.goto('https://documentmanagement-sit.trimont.com/default.aspx');
  await page.getByRole('link', { name: 'User Profile' }).click();
  await page.locator('[id="_ctl0_ContentPlaceHolder1_PrimaryTab"]').selectOption('4');
  await page.goto('https://documentmanagement-sit.trimont.com/UserProfile.aspx');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('User T11550 has been').click();
  await page.getByRole('link', { name: 'Search' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[id="_ctl0_ContentPlaceHolder1_SearchFormControl_SearchRow1_GroupTypeList"]').selectOption('22');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[id="_ctl0_ContentPlaceHolder1_SearchFormControl_SearchRow1_SearchFieldList"]').selectOption('60');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[id="_ctl0_ContentPlaceHolder1_SearchFormControl_SearchRow1_OperatorList"]').selectOption('!=');
  await page.locator('[id="_ctl0_ContentPlaceHolder1_SearchFormControl_SearchRow1_SearchValue_TextValue"]').click();
  await page.locator('[id="_ctl0_ContentPlaceHolder1_SearchFormControl_SearchRow1_SearchValue_TextValue"]').fill('89968');
  await page.locator('[id="_ctl0_ContentPlaceHolder1_MaxSearchResults"]').click();
  await page.locator('[id="_ctl0_ContentPlaceHolder1_MaxSearchResults"]').fill('50');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('tr:nth-child(6) > td:nth-child(5) > a').click();
  await page.getByRole('button', { name: 'Replace' }).click();
  await page.getByRole('button', { name: 'Choose File' }).click();
  const uploadFilePath = stageUploadFile('20260828_CSH_ExternalWires.xlsx');
  await page.getByRole('button', { name: 'Choose File' }).setInputFiles(uploadFilePath);
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await page.getByText('Document has been commited').click();
});