# Automation Generation Prompt

## Objective
Generate feature, page objects, methods, and step definitions for the following recorded Playwright flow.

## Business Flow
[
  {
    "Name": "View Dashboard",
    "Verb": "View",
    "Noun": "Dashboard",
    "Confidence": 0.94,
    "Evidence": [
      "Top verb \u0027View\u0027 scored 9.28.",
      "Top noun \u0027Dashboard\u0027 scored 6.57.",
      "LocatorValue: \u0027dashboard\u0027 -\u003E noun \u0027Dashboard\u0027.",
      "Target: \u0027dashboard\u0027 -\u003E noun \u0027Dashboard\u0027.",
      "RawCode: \u0027dashboard\u0027 -\u003E noun \u0027Dashboard\u0027.",
      "URL token \u0027Default\u0027 interpreted as \u0027default\u0027.",
      "Verb \u0027Search\u0027 matched keyword \u0027search\u0027.",
      "Navigation followed by Search contributed to exploration flow intent."
    ],
    "Actions": [
      {
        "ActionType": "Navigate",
        "Target": "https://documentadministration-uat.trimont.com/",
        "Sequence": 1,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "https://documentadministration-uat.trimont.com/",
        "Assertion": "",
        "RawCode": "  await page.goto(\u0027https://documentadministration-uat.trimont.com/\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "https://documentadministration-uat.trimont.com/",
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
        "Target": "await page.getByRole(\u0027link\u0027, { name: \u0027Administration\u0027 }).click();",
        "Sequence": 2,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027link\u0027, { name: \u0027Administration\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027link\u0027, { name: \u0027Administration\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027link\u0027, { name: \u0027Administration\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "link",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027link\u0027, { name: \u0027Reassign Packages\u0027 }).click();",
        "Sequence": 3,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027link\u0027, { name: \u0027Reassign Packages\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027link\u0027, { name: \u0027Reassign Packages\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027link\u0027, { name: \u0027Reassign Packages\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "link",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Select",
        "Target": "await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlSearchUser\u0027).selectOption(\u0027T11542\u0027);",
        "Sequence": 4,
        "LocatorType": "Id",
        "LocatorValue": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlSearchUser\u0027)",
        "InputValue": "T11542",
        "Assertion": "",
        "RawCode": "  await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlSearchUser\u0027).selectOption(\u0027T11542\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlSearchUser\u0027).selectOption(\u0027T11542\u0027)",
        "LocatorExpression": "locator()",
        "LocatorArgument": "#ctl00_ContentPlaceHolder1_ddlSearchUser",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027button\u0027, { name: \u0027Search Queue\u0027 }).click();",
        "Sequence": 5,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027button\u0027, { name: \u0027Search Queue\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027button\u0027, { name: \u0027Search Queue\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027button\u0027, { name: \u0027Search Queue\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "button",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Check",
        "Target": "await page.locator(\u0027#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox\u0027).check();",
        "Sequence": 6,
        "LocatorType": "Id",
        "LocatorValue": "locator(\u0027#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox\u0027)",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.locator(\u0027#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox\u0027).check();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "locator(\u0027#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox\u0027).check()",
        "LocatorExpression": "locator()",
        "LocatorArgument": "#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Select",
        "Target": "await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlUsers\u0027).selectOption(\u0027T11542\u0027);",
        "Sequence": 7,
        "LocatorType": "Id",
        "LocatorValue": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlUsers\u0027)",
        "InputValue": "T11542",
        "Assertion": "",
        "RawCode": "  await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlUsers\u0027).selectOption(\u0027T11542\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlUsers\u0027).selectOption(\u0027T11542\u0027)",
        "LocatorExpression": "locator()",
        "LocatorArgument": "#ctl00_ContentPlaceHolder1_ddlUsers",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027button\u0027, { name: \u0027Assign to Selected User\u0027 }).click();",
        "Sequence": 8,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027button\u0027, { name: \u0027Assign to Selected User\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027button\u0027, { name: \u0027Assign to Selected User\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027button\u0027, { name: \u0027Assign to Selected User\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "button",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Click",
        "Target": "await page.getByRole(\u0027link\u0027, { name: \u0027Dashboard\u0027 }).click();",
        "Sequence": 9,
        "LocatorType": "Role",
        "LocatorValue": "getByRole(\u0027link\u0027, { name: \u0027Dashboard\u0027 })",
        "InputValue": "",
        "Assertion": "",
        "RawCode": "  await page.getByRole(\u0027link\u0027, { name: \u0027Dashboard\u0027 }).click();",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "getByRole(\u0027link\u0027, { name: \u0027Dashboard\u0027 }).click()",
        "LocatorExpression": "getByRole()",
        "LocatorArgument": "link",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Navigate",
        "Target": "https://documentadministration-uat.trimont.com/Default.aspx",
        "Sequence": 10,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "https://documentadministration-uat.trimont.com/Default.aspx",
        "Assertion": "",
        "RawCode": "  await page.goto(\u0027https://documentadministration-uat.trimont.com/Default.aspx\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "https://documentadministration-uat.trimont.com/Default.aspx",
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
        "Target": "await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlPackageSource\u0027).selectOption(\u0027569\u0027);",
        "Sequence": 11,
        "LocatorType": "Id",
        "LocatorValue": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlPackageSource\u0027)",
        "InputValue": "569",
        "Assertion": "",
        "RawCode": "  await page.locator(\u0027#ctl00_ContentPlaceHolder1_ddlPackageSource\u0027).selectOption(\u0027569\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "locator(\u0027#ctl00_ContentPlaceHolder1_ddlPackageSource\u0027).selectOption(\u0027569\u0027)",
        "LocatorExpression": "locator()",
        "LocatorArgument": "#ctl00_ContentPlaceHolder1_ddlPackageSource",
        "IsPopupAction": false,
        "IsFrameAction": false
      },
      {
        "ActionType": "Navigate",
        "Target": "https://documentadministration-uat.trimont.com/Default.aspx",
        "Sequence": 12,
        "LocatorType": "",
        "LocatorValue": "",
        "InputValue": "https://documentadministration-uat.trimont.com/Default.aspx",
        "Assertion": "",
        "RawCode": "  await page.goto(\u0027https://documentadministration-uat.trimont.com/Default.aspx\u0027);",
        "PageName": "page",
        "WindowName": "",
        "Url": "https://documentadministration-uat.trimont.com/Default.aspx",
        "FrameName": "",
        "VariableName": "",
        "ContextType": "MainWindow",
        "LocatorChain": "",
        "LocatorExpression": "",
        "LocatorArgument": "",
        "IsPopupAction": false,
        "IsFrameAction": false
      }
    ]
  }
]

## Prompt
You are an expert Playwright C# Automation Engineer.

Generate production-ready automation code.

Generate exactly these files:

Feature File: ViewDashboard.feature
Objects File: ViewDashboardObjects.cs
Methods File: ViewDashboardMethods.cs
Steps File: ViewDashboardSteps.cs

### Feature

View Dashboard

### Business Purpose

View Dashboard

### Detected Flow

- Flow Name: View Dashboard
- Verb: View
- Business Object: Dashboard
- Confidence: 94%
- Evidence:
  - Top verb 'View' scored 9.28.
  - Top noun 'Dashboard' scored 6.57.
  - LocatorValue: 'dashboard' -> noun 'Dashboard'.
  - Target: 'dashboard' -> noun 'Dashboard'.
  - RawCode: 'dashboard' -> noun 'Dashboard'.
  - URL token 'Default' interpreted as 'default'.
  - Verb 'Search' matched keyword 'search'.
  - Navigation followed by Search contributed to exploration flow intent.

### Business Flows

- View Dashboard
  1. Navigate : https://documentadministration-uat.trimont.com/
  2. Click : await page.getByRole('link', { name: 'Administration' }).click();
  3. Click : await page.getByRole('link', { name: 'Reassign Packages' }).click();
  4. Select : await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');
  5. Click : await page.getByRole('button', { name: 'Search Queue' }).click();
  6. Check : await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();
  7. Select : await page.locator('#ctl00_ContentPlaceHolder1_ddlUsers').selectOption('T11542');
  8. Click : await page.getByRole('button', { name: 'Assign to Selected User' }).click();
  9. Click : await page.getByRole('link', { name: 'Dashboard' }).click();
  10. Navigate : https://documentadministration-uat.trimont.com/Default.aspx
  11. Select : await page.locator('#ctl00_ContentPlaceHolder1_ddlPackageSource').selectOption('569');
  12. Navigate : https://documentadministration-uat.trimont.com/Default.aspx

### Generated Artifacts

Feature File: ViewDashboard.feature
Objects File: ViewDashboardObjects.cs
Methods File: ViewDashboardMethods.cs
Steps File: ViewDashboardSteps.cs

### Existing Methods

- RunAsync
- Main
- ResolvePath
- AddAutomationGenerator
- GetConfiguration
- SendAsync
- RecordMetrics
- AppendGeminiApiKey
- Create
- Create

### Existing Locators

- RepositoryPath
- RecordingPath
- OutputPath
- Candidates
- Content
- Parts
- Text
- Model
- Messages
- Temperature

### Existing Step Definitions

- user logs in
- user navigates to deals page
- user clicks on Deals Completion Status
- user enters deal TID {string}
- user presses Enter to search

### Utilities

- RecordedFlow
- Program
- RunnerOptions
- DependencyInjection
- AIConfigurationProvider

### Coding Rules

- Use Page Object Model.
- Reuse existing methods whenever possible.
- Reuse existing locators whenever possible.
- Do not duplicate code.
- Follow Reqnroll syntax.
- Generate exactly these files:
  - ViewDashboard.feature
  - ViewDashboardObjects.cs
  - ViewDashboardMethods.cs
  - ViewDashboardSteps.cs
- Ensure actions are generated in recorded sequence:
  - 1. Navigate on https://documentadministration-uat.trimont.com/
  - 2. Click on await page.getByRole('link', { name: 'Administration' }).click();
  - 3. Click on await page.getByRole('link', { name: 'Reassign Packages' }).click();
  - 4. Select on await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T11542');
  - 5. Click on await page.getByRole('button', { name: 'Search Queue' }).click();
  - 6. Check on await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();
  - 7. Select on await page.locator('#ctl00_ContentPlaceHolder1_ddlUsers').selectOption('T11542');
  - 8. Click on await page.getByRole('button', { name: 'Assign to Selected User' }).click();
  - 9. Click on await page.getByRole('link', { name: 'Dashboard' }).click();
  - 10. Navigate on https://documentadministration-uat.trimont.com/Default.aspx
  - 11. Select on await page.locator('#ctl00_ContentPlaceHolder1_ddlPackageSource').selectOption('569');
  - 12. Navigate on https://documentadministration-uat.trimont.com/Default.aspx
- Questions to consider:
  - Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Administration' }))
  - Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Reassign Packages' }))
  - Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Search Queue' }))
  - Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Assign to Selected User' }))
  - Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Dashboard' }))


## Optimized Context
- Features: 3
- Methods: 10
- Locators: 10
- Steps: 5
- Utilities: 5
- Relationships: 10

## Questions
- Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Administration' }))
- Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Reassign Packages' }))
- Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Search Queue' }))
- Should a success message or navigation be verified after this action? (getByRole('button', { name: 'Assign to Selected User' }))
- Should a success message or navigation be verified after this action? (getByRole('link', { name: 'Dashboard' }))