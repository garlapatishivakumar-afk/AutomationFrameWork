import { test, expect } from '@playwright/test';

test.use({
  storageState: 'C:\\Users\\shivakumar.garlapati\\source\\repos\\AutomationFrameWork\\CodegenAI\\AIRecorder\\auth\\session.json'
});

test('test', async ({ page }) => {
  await page.goto('https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/oauth2/v2.0/authorize?response_type=code&client_id=0c480180-fae1-45b2-b898-ac1967301038&scope=openid%20profile%20email&state=djhERkeqhsURh-b9yBoJ6BPDO40UMWQgncbBTcNjGmM%3D&redirect_uri=https://app-cvw-ui-sit-eus2.ase-cms-sit-eus2-01.appserviceenvironment.net/cmsview/login/oauth2/code/azure&nonce=xQ6oKp2OgCefbRHt3Elnw8c1r-_R20EFZwXYrFu1mTI#/Role/ss/EntryPoint/deals');
  await page.goto('https://login.microsoftonline.com/0b14651e-5110-47c7-b458-14565f1d46de/login');
});