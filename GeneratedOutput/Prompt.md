# Automation Generation Prompt

## Objective
Generate feature, page objects, methods, and step definitions for the following recorded Playwright flow.

## Business Flow
[
  {
    "Name": "View Loan Reconciliation",
    "Verb": "View",
    "Noun": "Loan Reconciliation",
    "Confidence": 0.86,
    "Evidence": [
      "Top verb \u0027View\u0027 scored 18.7.",
      "Top noun \u0027Loan Reconciliation\u0027 scored 35.38.",
      "Target: \u0027whoiam\u0027 -\u003E noun \u0027Run As User\u0027.",
      "InputValue: \u0027whoiam\u0027 -\u003E noun \u0027Run As User\u0027.",
      "RawCode: \u0027whoiam\u0027 -\u003E noun \u0027Run As User\u0027.",
      "URL token \u0027Whoiam\u0027 interpreted as \u0027whoiam\u0027.",
      "URL: \u0027whoiam\u0027 -\u003E noun \u0027Run As User\u0027.",
      "LocatorValue: \u0027run as user\u0027 -\u003E noun \u0027Run As User\u0027.",
      "Target: \u0027run as user\u0027 -\u003E noun \u0027Run As User\u0027.",
      "RawCode: \u0027run as user\u0027 -\u003E noun \u0027Run As User\u0027.",
      "Target: \u0027dgworkqueue\u0027 -\u003E noun \u0027Work Queue\u0027.",
      "InputValue: \u0027dgworkqueue\u0027 -\u003E noun \u0027Work Queue\u0027."
    ],
    "Actions": [
      {
        "ActionType": "Navigate",
        "Target": "https://cashmanagement-sit.trimont.com/Whoiam.aspx",
        "Sequence": 1,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "https://cashmanagement-sit.trimont.com/Whoiam.aspx",
        "Assertion": "",
        "RawCode": "  await page.goto(\u0027https://cashmanagement-sit.trimont.com/Whoiam.aspx\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "https://cashmanagement-sit.trimont.com/Whoiam.aspx",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "",
        "LocatorExpression": "",
        "LocatorArgument": "",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Select",
        "Target": "await page.locator(\u0027#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee\u0027).selectOption(\u0027T10748\u0027);",
        "Sequence": 2,
        "LocatorType": "Id",
        "LocatorValue": "locator(\u0027#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee\u0027)",
        "InputValue": "T10748",
        "Assertion": "",
        "RawCode": "  await page.locator(\u0027#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee\u0027).selectOption(\u0027T10748\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "locator(\u0027#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee\u0027).selectOption(\u0027T10748\u0027)",
        "LocatorExpression": "locator()",
        "LocatorArgument": "#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027button\u0027, { name: \u0027Run As User\u0027 }).click();",
        "Sequence": 3,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027button\u0027, { name: \u0027Run As User\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027button\u0027, { name: \u0027Run As User\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027button\u0027, { name: \u0027Run As User\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "button",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Navigate",
        "Target": "https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx",
        "Sequence": 4,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx",
        "Assertion": "",
        "RawCode": "  await page.goto(\u0027https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "",
        "LocatorExpression": "",
        "LocatorArgument": "",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027link\u0027, { name: \u0027Loan Mgmt.\u0027 }).click();",
        "Sequence": 5,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027link\u0027, { name: \u0027Loan Mgmt.\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027link\u0027, { name: \u0027Loan Mgmt.\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027link\u0027, { name: \u0027Loan Mgmt.\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "link",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).click();",
        "Sequence": 6,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "textbox",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Fill",
        "Target": "await page.getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).fill(\u00274113002786\u0027);",
        "Sequence": 7,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 })",
        "InputValue": "4113002786",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).fill(\u00274113002786\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027textbox\u0027, { name: \u0027Cash Mgmt. Acct.:\u0027 }).fill(\u00274113002786\u0027)",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "textbox",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027button\u0027, { name: \u0027Search [Alt-S]\u0027 }).click();",
        "Sequence": 8,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027button\u0027, { name: \u0027Search [Alt-S]\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027button\u0027, { name: \u0027Search [Alt-S]\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027button\u0027, { name: \u0027Search [Alt-S]\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "button",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Popup",
        "Target": "const page1Promise = page.waitForEvent(\u0027popup\u0027);",
        "Sequence": 9,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  const page1Promise = page.waitForEvent(\u0027popup\u0027);",
        "PageName": "page",
        "WindowName": "page1",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "Popup",
        "LocatorChain": "",
        "LocatorExpression": "",
        "LocatorArgument": "",
        "IsPopupAction": true,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027link\u0027, { name: \u0027View Recon\u0027 }).click();",
        "Sequence": 10,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027link\u0027, { name: \u0027View Recon\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027link\u0027, { name: \u0027View Recon\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027link\u0027, { name: \u0027View Recon\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "link",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page1.getByRole(\u0027button\u0027, { name: \u0027Get Recon\u0027 }).click();",
        "Sequence": 11,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027button\u0027, { name: \u0027Get Recon\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page1.getByRole(\u0027button\u0027, { name: \u0027Get Recon\u0027 }).click();",
        "PageName": "page1",
        "WindowName": "page1",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "Popup",
        "LocatorChain": "getByRole(\u0027button\u0027, { name: \u0027Get Recon\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "button",
        "IsPopupAction": true,
        "IsFrameAction": false
      }
    ]
  }
]

## Prompt
You are an expert Playwright C# Automation Engineer.

Generate production-ready automation code.

Generate exactly these files:

Feature File: ViewLoanReconciliation.feature
Objects File: ViewLoanReconciliationObjects.cs
Methods File: ViewLoanReconciliationMethods.cs
Steps File: ViewLoanReconciliationSteps.cs

### Feature

View Loan Reconciliation

### Business Purpose

View Loan Reconciliation

### Detected Flow

- Flow Name: View Loan Reconciliation
- Verb: View
- Business Object: Loan Reconciliation
- Confidence: 86%
- Evidence:
  - Top verb 'View' scored 18.7.
  - Top noun 'Loan Reconciliation' scored 35.38.
  - Target: 'whoiam' -> noun 'Run As User'.
  - InputValue: 'whoiam' -> noun 'Run As User'.
  - RawCode: 'whoiam' -> noun 'Run As User'.
  - URL token 'Whoiam' interpreted as 'whoiam'.
  - URL: 'whoiam' -> noun 'Run As User'.
  - LocatorValue: 'run as user' -> noun 'Run As User'.
  - Target: 'run as user' -> noun 'Run As User'.
  - RawCode: 'run as user' -> noun 'Run As User'.
  - Target: 'dgworkqueue' -> noun 'Work Queue'.
  - InputValue: 'dgworkqueue' -> noun 'Work Queue'.

### Business Flows

- View Loan Reconciliation
  1. Navigate : https://cashmanagement-sit.trimont.com/Whoiam.aspx
  2. Select : await page.locator('#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee').selectOption('T10748');
  3. Click : await page.getByRole('button', { name: 'Run As User' }).click();
  4. Navigate : https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx
  5. Click : await page.getByRole('link', { name: 'Loan Mgmt.' }).click();
  6. Click : await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).click();
  7. Fill : await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).fill('4113002786');
  8. Click : await page.getByRole('button', { name: 'Search [Alt-S]' }).click();
  9. Popup : const page1Promise = page.waitForEvent('popup');
  10. Click : await page.getByRole('link', { name: 'View Recon' }).click();
  11. Click : await page1.getByRole('button', { name: 'Get Recon' }).click();

### Generated Artifacts

Feature File: ViewLoanReconciliation.feature
Objects File: ViewLoanReconciliationObjects.cs
Methods File: ViewLoanReconciliationMethods.cs
Steps File: ViewLoanReconciliationSteps.cs

### Existing Methods

- RunAsync
- AddAutomationGenerator
- GetConfiguration
- SendAsync
- RecordMetrics
- AppendGeminiApiKey
- Create
- Create
- Create
- Process

### Existing Locators

- Candidates
- Content
- Parts
- Text
- Model
- Messages
- Temperature
- MaxTokens
- Choices
- Message

### Existing Step Definitions

- user logs in
- user logs in

### Utilities

- RecordedFlow
- DependencyInjection
- AIConfigurationProvider
- AIHttpClient
- AIProviderFactory

### Coding Rules

- Use Page Object Model.
- Reuse existing methods whenever possible.
- Reuse existing locators whenever possible.
- Do not duplicate code.
- Follow Reqnroll syntax.
- Generate exactly these files:
  - ViewLoanReconciliation.feature
  - ViewLoanReconciliationObjects.cs
  - ViewLoanReconciliationMethods.cs
  - ViewLoanReconciliationSteps.cs
- Ensure actions are generated in recorded sequence:
  - 1. Navigate on https://cashmanagement-sit.trimont.com/Whoiam.aspx
  - 2. Select on await page.locator('#ctl00_WFC_ContentContainerCtrl_Main_ctl06_ContentPlaceHolder1_cboEmployee').selectOption('T10748');
  - 3. Click on await page.getByRole('button', { name: 'Run As User' }).click();
  - 4. Navigate on https://cashmanagement-sit.trimont.com/WebForms_MyWork/dgWorkQueue.aspx
  - 5. Click on await page.getByRole('link', { name: 'Loan Mgmt.' }).click();
  - 6. Click on await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).click();
  - 7. Fill on await page.getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }).fill('4113002786');
  - 8. Click on await page.getByRole('button', { name: 'Search [Alt-S]' }).click();
  - 9. Popup on const page1Promise = page.waitForEvent('popup');
  - 10. Click on await page.getByRole('link', { name: 'View Recon' }).click();
  - 11. Click on await page1.getByRole('button', { name: 'Get Recon' }).click();
- Questions to consider:
  - Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Run As User' }))
  - Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Loan Mgmt.' }))
  - Should a success message or navigation be verified after this action? (getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }))
  - Should this field use Excel data, Random data or Fixed data? (getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }))
  - Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Search [Alt-S]' }))
  - Should a success message or navigation be verified after this action? (getByRole('link', { name: 'View Recon' }))
  - Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Get Recon' }))


## Optimized Context
- Features: 2
- Methods: 10
- Locators: 10
- Steps: 2
- Utilities: 5
- Relationships: 10

## Questions
- Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Run As User' }))
- Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Loan Mgmt.' }))
- Should a success message or navigation be verified after this action? (getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }))
- Should this field use Excel data, Random data or Fixed data? (getByRole('textbox', { name: 'Cash Mgmt. Acct.:' }))
- Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Search [Alt-S]' }))
- Should a success message or navigation be verified after this action? (getByRole('link', { name: 'View Recon' }))
- Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Get Recon' }))