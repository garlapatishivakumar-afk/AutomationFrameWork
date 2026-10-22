const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  generateCSharpCode: generateWithPolicy,
  parseRecordedActions,
  validateGeneratedCSharp
} = require("./CSharpCodeGenerator.cjs");
// Preserve all pre-tiered assertions as strict-policy regression coverage.
const generateCSharpCode = (options) => generateWithPolicy({ ...options, strictLocators: true });
const { runAllTests: runLocatorValidatorTests } = require("../Intelligence/LocatorValidator.test.cjs");
const { runAllTests: runLocatorRepairTests } = require("../Intelligence/LocatorRepair.test.cjs");
const { runAllTests: runFailureTriageTests } = require("../Intelligence/FailureTriage.test.cjs");
const { runAllTests: runTestDataContractTests } = require("../Intelligence/TestDataContract.test.cjs");

function withTempFiles(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "csharp-codegen-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeAppSettings(tempDir) {
  fs.writeFileSync(path.join(tempDir, "appsettings.json"), JSON.stringify({
    Urls: {
      DocAdmin: "https://documentadministration-sit.trimont.com/adminReassign.aspx"
    }
  }, null, 2), "utf8");
}

  function writeFrameworkFiles(tempDir) {
    const pageElementsDir = path.join(tempDir, "PageElements");
    const helpersDir = path.join(tempDir, "Helpers");
    fs.mkdirSync(pageElementsDir, { recursive: true });
    fs.mkdirSync(helpersDir, { recursive: true });

    fs.writeFileSync(path.join(pageElementsDir, "GeneratedObjects.cs"), `
  using Microsoft.Playwright;

  namespace AutomationFrameWork.PageElements
  {
    public class GeneratedObjects
    {
      private readonly IPage _page;

      public GeneratedObjects(IPage page)
      {
        _page = page;
      }

      public ILocator AdministrationMenu =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Administration", Exact = true });

      public ILocator ReassignPackagesLink =>
        _page.GetByRole(AriaRole.Link, new() { Name = "Reassign Packages" });

      public ILocator PopupSaveButton =>
        _page.GetByRole(AriaRole.Button, new() { Name = "Popup Save" });
    }
  }
  `, "utf8");

    fs.writeFileSync(path.join(helpersDir, "CommonActionsPage.cs"), `
  using Microsoft.Playwright;

  namespace AutomationFrameWork.Pages
  {
    public class CommonActionsPage
    {
      public CommonActionsPage(IPage page) { }
      public async System.Threading.Tasks.Task NavigateToURLAsync(string url) { await System.Threading.Tasks.Task.CompletedTask; }
    }
  }
  `, "utf8");
  }

function testClickMapping() {
  const code = "await page.getByRole('button', { name: 'Login' }).click();";
  const actions = parseRecordedActions(code);
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(actions[0].actionType, "click");
  assert.strictEqual(actions[0].locatorStrategy, "ROLE");
}

function testFillAndSelectOptionMapping() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByLabel('Username').fill('admin');
await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T10964');
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Username => Page.GetByLabel("Username");'));
    assert.ok(result.code.includes('await Username.FillAsync("admin");'));
    assert.ok(result.code.includes('public ILocator SearchUser => Page.Locator("#ctl00_ContentPlaceHolder1_ddlSearchUser");'));
    assert.ok(result.code.includes('await SearchUser.SelectOptionAsync(new[] { "T10964" });'));
    assert.strictEqual(result.validation.success, true);
  });
}

function testNamedLocatorGeneration() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('link', { name: 'Deals' }).click();
await page.getByRole('link', { name: 'Documents' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Deals => Page.GetByRole(AriaRole.Link, new() { Name = "Deals" });'));
    assert.ok(result.code.includes('public ILocator Documents => Page.GetByRole(AriaRole.Link, new() { Name = "Documents" });'));
    assert.ok(!result.code.includes('public ILocator Deals => Page.GetByRole(AriaRole.Link, new() { Name = "Deals" }).ClickAsync();'));
    assert.ok(result.code.includes('await Deals.ClickAsync();'));
    assert.ok(result.code.includes('await Documents.ClickAsync();'));
  });
}

function testGotoUsesConfiguredUrl() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.goto('https://documentadministration-sit.trimont.com/adminReassign.aspx');", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes("await Page.GotoAsync(Config.Urls.DocAdmin);"));
    assert.ok(!result.code.includes("public ILocator DocAdmin =>"));
  });
}

function testGotoUsesConfiguredApplicationUrl() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    fs.writeFileSync(path.join(tempDir, "appsettings.json"), JSON.stringify({
      Urls: {
        Applications: {
          InvestorReporting: "https://investorreporting-mb-sit.trimont.com/default.aspx"
        }
      }
    }, null, 2), "utf8");
    fs.writeFileSync(codeFile, "await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('await Page.GotoAsync(Config.Urls.TryGetApplication("InvestorReporting"));'));
  });
}

function testTableLocatorConversion() {
  const code = "await page.locator(\"//tr[@id='ctl00_cp1_gd_ctl00__0']/td[2]/a\").click();";
  const result = generateCSharpCode({ codeFilePath: "", outputFilePath: "", appSettingsPath: "" });
  void result;
  const actions = parseRecordedActions(code);
  assert.strictEqual(actions[0].locatorStrategy, "TABLE_LOCATOR");
}

function testFrameConversion() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.locator('iframe[name=\"UpdateTransactionDetails\"]').contentFrame().getByText('891224', { exact: true }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Locator891224 => Page.FrameLocator("iframe[name=\\"UpdateTransactionDetails\\"]").GetByText("891224", new() { Exact = true });'));
    assert.ok(result.code.includes('await Locator891224.ClickAsync();'));
  });
}

function testAssertionConversion() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await expect(page.getByText('Saved')).toBeVisible();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Saved => Page.GetByText("Saved");'));
    assert.ok(result.code.includes('await Assertions.Expect(Saved).ToBeVisibleAsync();'));
  });
}

function testPositionedRoleConversion() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('cell', { name: 'generated' }).first().click();
await page.getByRole('cell', { name: 'generated' }).nth(1).click();
await page.getByRole('cell', { name: 'generated' }).last().click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator FirstGenerated => Page.GetByRole(AriaRole.Cell, new() { Name = "generated" }).First;'));
    assert.ok(result.code.includes('public ILocator Generated2 => Page.GetByRole(AriaRole.Cell, new() { Name = "generated" }).Nth(1);'));
    assert.ok(result.code.includes('public ILocator LastGenerated => Page.GetByRole(AriaRole.Cell, new() { Name = "generated" }).Last;'));
    assert.ok(result.code.includes('await FirstGenerated.ClickAsync();'));
    assert.ok(result.code.includes('await Generated2.ClickAsync();'));
    assert.ok(result.code.includes('await LastGenerated.ClickAsync();'));
  });
}

function testAdditionalCodegenSelectors() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByPlaceholder('Search').fill('loan');
await page.getByTitle('Open').click();
await page.getByTestId('save-button').click();
await page.locator('tr').filter({ hasText: 'Alpha' }).nth(1).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Search => Page.GetByPlaceholder("Search");'));
    assert.ok(result.code.includes('await Search.FillAsync("loan");'));
    assert.ok(result.code.includes('public ILocator Open => Page.GetByTitle("Open");'));
    assert.ok(result.code.includes('await Open.ClickAsync();'));
    assert.ok(result.code.includes('public ILocator SaveButton => Page.GetByTestId("save-button");'));
    assert.ok(result.code.includes('await SaveButton.ClickAsync();'));
    assert.ok(result.code.includes('public ILocator Alpha2 => Page.Locator("tr").Filter(new() { HasText = "Alpha" }).Nth(1);'));
    assert.ok(result.code.includes('await Alpha2.ClickAsync();'));
  });
}

function testDuplicateLocatorReuse() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('link', { name: 'Documents' }).click();
await page.getByRole('link', { name: 'Documents' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    const propertyMatches = result.code.match(/public ILocator Documents =>/g) || [];
    const actionMatches = result.code.match(/await Documents\.ClickAsync\(\);/g) || [];
    assert.strictEqual(propertyMatches.length, 1);
    assert.strictEqual(actionMatches.length, 2);
  });
}

function testDuplicateNamesDisambiguated() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('link', { name: 'Documents' }).click();
await page.getByText('Documents').click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Documents => Page.GetByRole(AriaRole.Link, new() { Name = "Documents" });'));
    assert.ok(result.code.includes('public ILocator Documents2 => Page.GetByText("Documents");'));
    assert.ok(result.code.includes('await Documents.ClickAsync();'));
    assert.ok(result.code.includes('await Documents2.ClickAsync();'));
  });
}

function testSelectorBasedNaming() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator('#ctl00_ContentPlaceHolder1_rcboTransactionID_Arrow').click();
await page.locator('#ctl00_ContentPlaceHolder1_rcboInvestorNumber_Arrow').click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator TransactionIDArrow => Page.Locator("#ctl00_ContentPlaceHolder1_rcboTransactionID_Arrow");'));
    assert.ok(result.code.includes('public ILocator InvestorNumberArrow => Page.Locator("#ctl00_ContentPlaceHolder1_rcboInvestorNumber_Arrow");'));
    assert.ok(result.code.includes('await TransactionIDArrow.ClickAsync();'));
    assert.ok(result.code.includes('await InvestorNumberArrow.ClickAsync();'));
  });
}

function testUnsupportedActionIsReported() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.route('**/*', () => {});", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.strictEqual(result.unsupportedActions.length, 1);
    assert.ok(result.code.includes("// Unsupported:"));
  });
}

function testGeneratedCodeValidation() {
  const validation = validateGeneratedCSharp(`
using Microsoft.Playwright;
public class Sample {
    public IPage Page { get; }
    public async Task ReplayAsync() {
        await Page.ClickAsync();
    }
}
`, []);

  assert.strictEqual(validation.success, true);
}

function testGeneratedCodeValidationDoesNotFlagPropertyNames() {
  const validation = validateGeneratedCSharp(`
using Microsoft.Playwright;
public class Sample {
    public IPage Page { get; }
    public ILocator BackToHomepage => Page.GetByRole(AriaRole.Button, new() { Name = "Back to Homepage" });
    public async Task ReplayAsync() {
        await BackToHomepage.ClickAsync();
    }
}
`, []);

  assert.strictEqual(validation.success, true);
}

function testGeneratedCodeValidationIgnoresUnsupportedComments() {
  const validation = validateGeneratedCSharp(`
using Microsoft.Playwright;
public class Sample {
    public IPage Page { get; }
    public async Task ReplayAsync() {
        // Unsupported: await page.getByRole('group', { name: 'Address' });
        await Page.ClickAsync();
    }
}
`, []);

  assert.strictEqual(validation.success, true);
}

function testCompactFormattingRemovesSourceComments() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    fs.writeFileSync(codeFile, `
await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');
await page.getByRole('link', { name: 'Documents' }).click();
await page.getByRole('link', { name: 'Append Total Loans' }).click();
await page.goto('https://investorreporting-mb-sit.trimont.com/IRRelatedFiles/RelatedTotalLoans.aspx');
await page.getByRole('link', { name: 'Deals', exact: true }).click();
await page.getByRole('link', { name: 'Deals Completion Status' }).click();
await page.goto('https://investorreporting-mb-sit.trimont.com/IRDeals/DealsCompletionStatus.aspx');
await page.getByText('Internal Server Error. Please').click();
await page.getByRole('cell', { name: 'An error has occurred in the' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(!result.code.includes("// Source: Code.ts line"));
    assert.ok(result.code.includes("// Review: URL at source line uses literal value because no matching appsettings Urls entry was found:"));
    assert.ok(!/ClickAsync\(\);\r?\n\r?\n\s*await/.test(result.code));
    assert.ok(!/ClickAsync\(\);\r?\n\r?\n\s*\}/.test(result.code));
    assert.ok(result.code.includes('await _commonActions.NavigateToURLAsync("https://investorreporting-mb-sit.trimont.com/default.aspx");'));
    assert.ok(result.code.includes('public ILocator Documents => Page.GetByRole(AriaRole.Link, new() { Name = "Documents" });'));
    assert.ok(result.code.includes('await Documents.ClickAsync();'));
    assert.ok(result.code.includes('public ILocator AnErrorHasOccurredInThe => Page.GetByRole(AriaRole.Cell, new() { Name = "An error has occurred in the" });'));
    assert.ok(result.code.includes('await AnErrorHasOccurredInThe.ClickAsync();'));
    assert.ok(Array.isArray(result.sourceMap) && result.sourceMap.length === 9);
  });
}

function testFrameworkAwareNavigationAndLocators() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    fs.writeFileSync(codeFile, `
await page.goto('https://documentadministration-sit.trimont.com/adminReassign.aspx');
await page.getByRole('link', { name: 'Administration', exact: true }).click();
await page.getByRole('link', { name: 'Reassign Packages' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes("using AutomationFrameWork.PageElements;"));
    assert.ok(result.code.includes("using AutomationFrameWork.Pages;"));
    assert.ok(result.code.includes("private readonly CommonActionsPage _commonActions;"));
    assert.ok(result.code.includes("private readonly GeneratedObjects _generatedObjects;"));
    assert.ok(result.code.includes("await _commonActions.NavigateToURLAsync(Config.Urls.DocAdmin);"));
    assert.ok(result.code.includes("await _generatedObjects.AdministrationMenu.ClickAsync();"));
    assert.ok(result.code.includes("await _generatedObjects.ReassignPackagesLink.ClickAsync();"));
    assert.ok(!result.code.includes("public ILocator Administration =>"));
    assert.ok(result.frameworkMatches.length >= 3);
  });
}

function testFrameworkAwareSourceMappingPreserved() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    fs.writeFileSync(codeFile, `
await page.goto('https://documentadministration-sit.trimont.com/adminReassign.aspx');
await page.getByRole('link', { name: 'Administration', exact: true }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(Array.isArray(result.sourceMap));
    assert.deepStrictEqual(
      result.sourceMap.map((entry) => entry.sourceLine),
      [2, 3]
    );
  });
}

function testFrameworkAwareFallbackForFramesAndTables() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator('iframe[name="UpdateTransactionDetails"]').contentFrame().getByText('891224', { exact: true }).click();
await page.locator("//tr[@id='ctl00_cp1_gd_ctl00__0']/td[2]/a").click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator Locator891224 => Page.FrameLocator("iframe[name=\\"UpdateTransactionDetails\\"]").GetByText("891224", new() { Exact = true });'));
    assert.ok(result.code.includes('await Locator891224.ClickAsync();'));
    const locatorPropertyMatch = result.code.match(/public ILocator (\w+) => Page\.Locator\("\/\/tr\[@id='ctl00_cp1_gd_ctl00__0'\]\/td\[2\]\/a"\);/);
    assert.ok(locatorPropertyMatch, "Expected generated locator property for xpath table locator");
    assert.ok(result.code.includes(`await ${locatorPropertyMatch[1]}.ClickAsync();`));
  });
}

function testFrameworkLocatorReuseRequiresExactExpressionMatch() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('link', { name: 'Administration', exact: true }).first().click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes('public ILocator FirstAdministration => Page.GetByRole(AriaRole.Link, new() { Name = "Administration", Exact = true }).First;'));
    assert.ok(result.code.includes('await FirstAdministration.ClickAsync();'));
    assert.ok(!result.code.includes('await _generatedObjects.AdministrationMenu.First.ClickAsync();'));
  });
}

function testRecorderAnnotationLinesAreParsedAsActions() {
  const code = `
await page.locator("//button[contains(@id, 'btn_loanNumber')]/span[@class='wf-button__label']").click(); -> click on random element in this locator.
await page.getByRole('group', { name: 'Email and Phone' }) will have below details:
`;

  const actions = parseRecordedActions(code);
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(actions[0].supported, true);
  assert.strictEqual(actions[0].actionType, "click");
  assert.strictEqual(actions[0].locatorStrategy, "LOCATOR");
}

function testPopupActorActionsAreSupported() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('link', { name: 'Open Popup' }).click();
const page1Promise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Trigger Popup' }).click();
const page1 = await page1Promise;
await page1.getByText('Field Value:').click();
await page1.locator('#txtOverrideValue').fill('1324');
await page1.getByRole('button', { name: 'OK' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.ok(result.code.includes("private IPage _page1 = default!;"));
    assert.ok(result.code.includes("public ILocator FieldValue => _page1.GetByText(\"Field Value:\");"));
    assert.ok(result.code.includes("public ILocator OverrideValue => _page1.Locator(\"#txtOverrideValue\");"));
    assert.ok(result.code.includes("public ILocator Ok => _page1.GetByRole(AriaRole.Button, new() { Name = \"OK\" });"));
    assert.ok(result.code.includes("var page1Promise = Page.WaitForPopupAsync();"));
    assert.ok(result.code.includes("_page1 = await page1Promise;"));
    assert.ok(result.code.includes("await FieldValue.ClickAsync();"));
    assert.ok(result.code.includes("await OverrideValue.FillAsync(\"1324\");"));
    assert.ok(result.code.includes("await Ok.ClickAsync();"));
    assert.strictEqual(result.unsupportedActions.length, 0);
  });
}

function testEnterpriseModeSplitsNonPopupFlowIntoMethodsWithWaits() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    fs.writeFileSync(path.join(tempDir, "appsettings.json"), JSON.stringify({
      Urls: {
        Applications: {
          DocAdmin: "https://documentadministration-sit.trimont.com/default.aspx"
        }
      }
    }, null, 2), "utf8");

    fs.writeFileSync(codeFile, `
await page.goto('https://documentadministration-sit.trimont.com/default.aspx');
await page.getByRole('link', { name: 'Administration' }).click();
await page.getByRole('link', { name: 'Reassign Packages' }).click();
await page.locator('#ctl00_ContentPlaceHolder1_ddlSearchUser').selectOption('T10964');
await page.locator("//input[@id='ctl00_ContentPlaceHolder1_btnSearch']").click();
await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_ReassignCheckSelectCheckBox').check();
await page.locator('#ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl06_ReassignCheckSelectCheckBox').check();
await page.getByText('Garlapati, Shivakumar', { exact: true }).click();
await page.locator('#ctl00_ContentPlaceHolder1_ddlUsers').selectOption('T11550');
await page.locator("//input[@id='ctl00_ContentPlaceHolder1_btnReassign']").click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      enterpriseMode: true
    });

    assert.ok(result.code.includes("public async Task OpenTargetModuleAsync()"));
    assert.ok(result.code.includes("public async Task ApplySearchCriteriaAsync()"));
    assert.ok(result.code.includes("public async Task SelectResultRowsAsync()"));
    assert.ok(result.code.includes("public async Task CompleteBusinessActionAsync()"));
    assert.ok(result.code.includes("await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);"));
    assert.ok(result.code.includes("await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);"));
    assert.ok(result.code.includes("await Administration.WaitForAsync(new() { State = WaitForSelectorState.Visible });"));
    assert.ok(!result.code.includes("await Assertions.Expect(Administration).ToBeVisibleAsync();"));
  });
}

function testEnterpriseModeSplitsLongLinearFlowIntoPartMethods() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    fs.writeFileSync(path.join(tempDir, "appsettings.json"), JSON.stringify({
      Urls: {
        Applications: {
          Inspections: "https://inspections-sit.trimont.com/default.aspx"
        }
      }
    }, null, 2), "utf8");

    fs.writeFileSync(codeFile, `
await page.goto('https://inspections-sit.trimont.com/default.aspx');
await page.getByRole('link', { name: 'CMBS' }).click();
await page.getByRole('link', { name: 'Create Order' }).click();
await page.locator('#ctl00_ContentPlaceHolder1_txtOrderName').click();
await page.locator('#ctl00_ContentPlaceHolder1_txtOrderName').fill('give random');
await page.locator("//a[@id='ctl00_ContentPlaceHolder1_ddlLoanType_Arrow']").click();
await page.locator('#ctl00_ContentPlaceHolder1_ddlLoanType_DropDown').getByText('CMBS').click();
await page.getByText('Type your comments here').click();
await page.getByText('Type your comments here').fill('Give random comments every time');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Search' }).click();
await page.locator('#ctl00_ContentPlaceHolder1_gvProperties_ctl00_ctl08_btnAdd').click();
await page.getByRole('button', { name: 'Yes' }).click();
await page.getByRole('button', { name: 'Save & Submit' }).click();
await page.getByRole('heading', { name: 'Confirmation:' }).click();
await page.getByRole('link', { name: 'CMBS' }).click();
await page.getByRole('link', { name: 'Create Order' }).click();
await page.locator('#ctl00_ContentPlaceHolder1_txtOrderName').click();
await page.locator('#ctl00_ContentPlaceHolder1_txtOrderName').fill('give random 2');
await page.locator("//a[@id='ctl00_ContentPlaceHolder1_ddlLoanType_Arrow']").click();
await page.locator('#ctl00_ContentPlaceHolder1_ddlLoanType_DropDown').getByText('CMBS').click();
await page.getByText('Type your comments here').click();
await page.getByText('Type your comments here').fill('Give random comments every time');
await page.getByRole('button', { name: 'Next' }).click();
await page.getByRole('button', { name: 'Search' }).click();
await page.locator('#ctl00_ContentPlaceHolder1_gvProperties_ctl00_ctl08_btnAdd').click();
await page.getByRole('button', { name: 'Yes' }).click();
await page.getByRole('button', { name: 'Save & Submit' }).click();
await page.getByRole('heading', { name: 'Confirmation:' }).click();
`, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      enterpriseMode: true
    });

    assert.ok(result.code.includes("public async Task ApplySearchCriteriaAsync()"));
    assert.ok(result.code.includes("public async Task ApplySearchCriteriaAsyncPart1Async()"));
    assert.ok(result.code.includes("await ApplySearchCriteriaAsyncPart1Async();"));
  });
}

function testLocatorValidationFailureBlocksOutputWrite() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Submit' }).click();", "utf8");
    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 1,
          matchCount: 0,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: {
              id: "btnSubmit"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile,
      enableRepair: false
    });

    assert.strictEqual(result.locatorValidation.hasFailures, true);
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testTextVsAttributeEndToEndValidation() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator("//button[text()='Submit']").click();
await page.locator("//input[contains(text(),'account')]").click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 1,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: {
              id: "btnSubmit"
            }
          }
        },
        {
          line: 3,
          matchCount: 1,
          target: {
            tagName: "input",
            id: "accountNumber",
            attributes: {
              id: "accountNumber"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile,
      enableRepair: false
    });

    assert.strictEqual(result.locatorValidation.hasFailures, true);
    assert.strictEqual(fs.existsSync(outputFile), false);

    const submitValidation = result.locatorValidation.results.find((x) => x.sourceLine === 2);
    const accountValidation = result.locatorValidation.results.find((x) => x.sourceLine === 3);

    assert.ok(submitValidation, "Expected validator output for submit locator");
    assert.ok(accountValidation, "Expected validator output for account locator");

    const submitLv004 = submitValidation.rules.find((x) => x.ruleId === "LV004");
    const accountLv004 = accountValidation.rules.find((x) => x.ruleId === "LV004");

    assert.ok(submitLv004, "Expected LV004 for submit locator");
    assert.ok(accountLv004, "Expected LV004 for account locator");

    assert.strictEqual(submitLv004.status, "FAIL");
    assert.strictEqual(accountLv004.status, "FAIL");
    assert.strictEqual(submitValidation.suggestedLocator, "//button[@id='btnSubmit']");
    assert.strictEqual(accountValidation.suggestedLocator, "//input[@id='accountNumber']");
  });
}

function testLocatorRepairSingleAttemptPassesAndWritesCode() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
  await page.locator("/html/body/div[2]/button").click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 1,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: {
              id: "btnSubmit"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile
    });

    assert.strictEqual(result.initialLocatorValidation.hasFailures, true);
    assert.strictEqual(result.locatorRepair.attempts, 1);
    assert.strictEqual(result.locatorRepair.repairStatus, "PASS");
    assert.strictEqual(result.locatorRepair.codeGenerationBlocked, false);
    assert.strictEqual(result.locatorValidation.hasFailures, false);
    assert.strictEqual(fs.existsSync(outputFile), true);
    assert.ok(result.code.includes("//button[@id='btnSubmit']"));
  });
}

function testLocatorRepairSingleAttemptFailureKeepsCodeBlocked() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.getByRole('button', { name: 'Submit' }).click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 0,
          target: {
            tagName: "button",
            attributes: {}
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile
    });

    assert.strictEqual(result.initialLocatorValidation.hasFailures, true);
    assert.strictEqual(result.locatorRepair.attempts, 1);
    assert.strictEqual(result.locatorRepair.repairStatus, "FAILED");
    assert.strictEqual(result.locatorValidation.hasFailures, true);
    assert.strictEqual(result.failureTriage.status, "BLOCKED");
    assert.strictEqual(result.failureTriage.category, "LOCATOR_REPAIR_FAILED");
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testLocatorRepairConvertsTestDataRowLocatorToStableDataAttribute() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator("//tr[td[normalize-space()='20386']]").click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 1,
          target: {
            tagName: "tr",
            attributes: {
              "data-rowid": "TX-20386"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile
    });

    assert.strictEqual(result.initialLocatorValidation.hasFailures, true);
    assert.strictEqual(result.locatorRepair.attempts, 1);
    assert.strictEqual(result.locatorRepair.repairStatus, "PASS");
    assert.strictEqual(result.locatorValidation.hasFailures, false);
    assert.ok(result.code.includes("//tr[@data-rowid='TX-20386']"));
    assert.strictEqual(fs.existsSync(outputFile), true);
  });
}

function testLocatorRepairDoesNotApproveInventedAttributes() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator("//button[text()='Submit']").click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 1,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: {
              id: "btnSubmit"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile,
      repairProvider: () => "//button[@data-testid='submit']"
    });

    assert.strictEqual(result.locatorRepair.attempts, 1);
    assert.strictEqual(result.locatorRepair.repairStatus, "FAILED");
    assert.strictEqual(result.locatorValidation.hasFailures, true);
    const rule = result.locatorValidation.results[0].rules.find((x) => x.ruleId === "LV007");
    assert.ok(rule);
    assert.strictEqual(rule.status, "FAIL");
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testLocatorRepairFailsWhenRepairedLocatorIsNonUnique() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, `
await page.locator("//button[text()='Submit']").click();
`, "utf8");

    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 2,
          matchCount: 7,
          target: {
            tagName: "button",
            attributes: {
              type: "button"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile,
      repairProvider: () => "//button[@type='button']"
    });

    assert.strictEqual(result.locatorRepair.attempts, 1);
    assert.strictEqual(result.locatorRepair.repairStatus, "FAILED");
    assert.strictEqual(result.locatorValidation.hasFailures, true);
    const lv012 = result.locatorValidation.results[0].rules.find((x) => x.ruleId === "LV012");
    assert.ok(lv012);
    assert.strictEqual(lv012.status, "FAIL");
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testDataContractPassAllowsGeneration() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      dataContractDefinition: {
        scenario: "Login",
        inputs: [
          { name: "Username", required: true, type: "string" },
          { name: "Password", required: true, type: "string" }
        ]
      },
      testData: {
        Username: "testuser",
        Password: "Password123"
      }
    });

    assert.strictEqual(result.dataContract.status, "PASS");
    assert.strictEqual(result.dataContract.blocking, false);
    assert.strictEqual(fs.existsSync(outputFile), true);
  });
}

function testDataContractWarningAllowsGenerationWithWarnings() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      dataContractDefinition: {
        scenario: "Login",
        inputs: [
          { name: "Username", required: true, type: "string" },
          { name: "Password", required: true, type: "string" }
        ]
      },
      testData: {
        Username: "testuser",
        Password: "Password123",
        Region: "US"
      }
    });

    assert.strictEqual(result.dataContract.status, "WARNING");
    assert.strictEqual(result.dataContract.blocking, false);
    assert.ok(Array.isArray(result.validation.warnings));
    assert.ok(result.validation.warnings.some((x) => x.includes("Extra/unmapped key 'Region'")));
    assert.strictEqual(fs.existsSync(outputFile), true);
  });
}

function testDataContractBlockedStopsGenerationBeforeLocatorFlow() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      dataContractDefinition: {
        scenario: "Login",
        inputs: [
          { name: "Username", required: true, type: "string" },
          { name: "Password", required: true, type: "string" }
        ]
      },
      testData: {
        Username: "testuser"
      }
    });

    assert.strictEqual(result.dataContract.status, "BLOCKED");
    assert.strictEqual(result.dataContract.blocking, true);
    assert.deepStrictEqual(result.dataContract.missingKeys, ["Password"]);
    assert.strictEqual(result.actions.length, 0);
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testMethodQualityGatePassAcceptsGeneration() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.strictEqual(result.methodQualityGate.status, "PASS");
    assert.strictEqual(result.methodQualityGate.blocking, false);
    assert.strictEqual(result.validation.success, true);
    assert.strictEqual(fs.existsSync(outputFile), true);
  });
}

function testMethodQualityGateWarningAllowsGenerationAndAddsWarnings() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const reportFile = path.join(tempDir, "CSharpGenerationReport.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      reportFilePath: reportFile,
      appSettingsPath: path.join(tempDir, "appsettings.json")
    });

    assert.strictEqual(result.methodQualityGate.status, "WARNING");
    assert.strictEqual(result.methodQualityGate.blocking, false);
    assert.strictEqual(result.validation.success, true);
    assert.ok(result.validation.warnings.some((x) => x.includes("MethodQualityGate MQG011")));
    assert.strictEqual(fs.existsSync(outputFile), true);

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.ok(report.methodQualityGate);
    assert.strictEqual(report.methodQualityGate.status, "WARNING");
  });
}

function testMethodQualityGateBlockedPreventsOverwrite() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const existingContent = "// existing generated content\npublic class Existing {}\n";

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.goto('https://investorreporting-mb-sit.trimont.com/default.aspx');", "utf8");
    fs.writeFileSync(outputFile, existingContent, "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      methodQualityGateOptions: {
        blockHardcodedUrl: true
      }
    });

    assert.strictEqual(result.methodQualityGate.status, "BLOCKED");
    assert.strictEqual(result.methodQualityGate.blocking, true);
    assert.strictEqual(result.validation.success, false);
    assert.ok(result.validation.errors.some((x) => x.includes("MethodQualityGate MQG011")));
    assert.strictEqual(fs.readFileSync(outputFile, "utf8"), existingContent);
  });
}

function testDataContractAndLocatorGatesRemainAuthoritativeWithMethodQualityGateIntegrated() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const domFile = path.join(tempDir, "LiveObservations.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const dataBlocked = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      dataContractDefinition: {
        scenario: "Login",
        inputs: [
          { name: "Username", required: true, type: "string" },
          { name: "Password", required: true, type: "string" }
        ]
      },
      testData: {
        Username: "testuser"
      },
      methodQualityGateOptions: {
        blockHardcodedUrl: true
      }
    });

    assert.strictEqual(dataBlocked.dataContract.status, "BLOCKED");
    assert.strictEqual(dataBlocked.methodQualityGate.status, "PASS");
    assert.strictEqual(dataBlocked.actions.length, 0);

    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Submit' }).click();", "utf8");
    fs.writeFileSync(domFile, JSON.stringify({
      actions: [
        {
          line: 1,
          matchCount: 0,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: {
              id: "btnSubmit"
            }
          }
        }
      ]
    }, null, 2), "utf8");

    const locatorBlocked = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      domObservationPath: domFile,
      enableRepair: false,
      methodQualityGateOptions: {
        blockHardcodedUrl: true
      }
    });

    assert.strictEqual(locatorBlocked.locatorValidation.hasFailures, true);
    assert.strictEqual(locatorBlocked.methodQualityGate.status, "PASS");
    assert.strictEqual(fs.existsSync(outputFile), false);
  });
}

function testExecutionReliabilityPassIsReported() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      runtimeEvidence: {
        failed: false,
        stdout: "run completed"
      }
    });

    assert.strictEqual(result.executionReliability.status, "PASS");
    assert.strictEqual(result.executionReliability.category, "NONE");
    assert.strictEqual(result.executionReliability.blocking, false);
  });
}

function testExecutionReliabilityWarningIncludesEvidenceAndRecommendation() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const reportFile = path.join(tempDir, "CSharpGenerationReport.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      reportFilePath: reportFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      runtimeEvidence: {
        failed: true,
        errorMessage: "expect(locator).toHaveText: expected string but received string",
        locator: "#status"
      }
    });

    assert.strictEqual(result.executionReliability.status, "WARNING");
    assert.strictEqual(result.executionReliability.category, "ASSERTION_TIMING_MISMATCH");
    assert.strictEqual(result.executionReliability.severity, "MEDIUM");
    assert.ok(result.executionReliability.confidence > 0.8);
    assert.ok(Array.isArray(result.executionReliability.evidence));
    assert.ok(result.executionReliability.evidence.some((x) => x.includes("Error:")));
    assert.ok(result.executionReliability.recommendation.includes("assertion timing"));

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.ok(report.executionReliability);
    assert.strictEqual(report.executionReliability.category, "ASSERTION_TIMING_MISMATCH");
  });
}

function testExecutionReliabilityBlockedIncludesCategorySeverityConfidence() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      runtimeEvidence: {
        failed: true,
        errorMessage: "Timeout 30000ms exceeded while waiting for selector #Submit to be visible",
        locator: "#Submit",
        timeoutMs: 30000
      }
    });

    assert.strictEqual(result.executionReliability.status, "BLOCKED");
    assert.strictEqual(result.executionReliability.blocking, true);
    assert.strictEqual(result.executionReliability.category, "TIMEOUT_VISIBILITY_RACE");
    assert.strictEqual(result.executionReliability.severity, "HIGH");
    assert.ok(result.executionReliability.confidence >= 0.9);
    assert.ok(result.executionReliability.recommendation.includes("wait strategy"));
    assert.ok(result.executionReliability.rules.some((x) => x.ruleId === "ERI001"));
  });
}

function testMaintainabilityDriftSectionReportedWithInsufficientHistory() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const reportFile = path.join(tempDir, "CSharpGenerationReport.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      reportFilePath: reportFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      includeCurrentRunInDriftHistory: false,
      maintainabilityHistory: {
        runs: [
          { failed: false },
          { failed: true }
        ]
      }
    });

    assert.ok(result.maintainabilityDrift);
    assert.strictEqual(result.maintainabilityDrift.status, "WARNING");
    assert.strictEqual(result.maintainabilityDrift.driftDetected, false);
    assert.ok(result.maintainabilityDrift.rules.some((x) => x.ruleId === "MDI000"));
    assert.strictEqual(fs.existsSync(outputFile), true);

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.ok(report.maintainabilityDrift);
    assert.strictEqual(report.maintainabilityDrift.driftDetected, false);
  });
}

function testMaintainabilityDriftHighSeverityFromHistoryHotspot() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const history = {
      runs: [
        {
          timestampUtc: "2026-10-01T10:00:00Z",
          failed: false,
          executionReliability: { category: "NONE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        },
        {
          timestampUtc: "2026-10-02T10:00:00Z",
          failed: true,
          executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        },
        {
          timestampUtc: "2026-10-03T10:00:00Z",
          failed: true,
          executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        },
        {
          timestampUtc: "2026-10-04T10:00:00Z",
          failed: true,
          executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        },
        {
          timestampUtc: "2026-10-05T10:00:00Z",
          failed: true,
          executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        },
        {
          timestampUtc: "2026-10-06T10:00:00Z",
          failed: true,
          executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" },
          locatorChanges: [{ key: "BeneficiaryAddress" }]
        }
      ]
    };

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      includeCurrentRunInDriftHistory: false,
      maintainabilityHistory: history
    });

    assert.strictEqual(result.maintainabilityDrift.status, "WARNING");
    assert.strictEqual(result.maintainabilityDrift.severity, "HIGH");
    assert.strictEqual(result.maintainabilityDrift.driftDetected, true);
    assert.ok(result.maintainabilityDrift.driftScore >= 75);
    assert.ok(result.maintainabilityDrift.hotspots.some((x) => x.key === "BeneficiaryAddress"));
    assert.ok(result.maintainabilityDrift.recommendations.length > 0);
    assert.strictEqual(fs.existsSync(outputFile), true);
  });
}

function testMaintainabilityDriftIsReportOnlyAndDoesNotBlockOutput() {
  withTempFiles((tempDir) => {
    const codeFile = path.join(tempDir, "Code.ts");
    const outputFile = path.join(tempDir, "Code.cs");
    const reportFile = path.join(tempDir, "CSharpGenerationReport.json");

    writeAppSettings(tempDir);
    fs.writeFileSync(codeFile, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");

    const history = {
      runs: [
        { failed: true, executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" }, locatorChanges: [{ key: "KeyA" }] },
        { failed: true, executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" }, locatorChanges: [{ key: "KeyA" }] },
        { failed: true, executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" }, locatorChanges: [{ key: "KeyA" }] },
        { failed: true, executionReliability: { category: "TIMEOUT_VISIBILITY_RACE" }, locatorChanges: [{ key: "KeyA" }] }
      ]
    };

    const result = generateCSharpCode({
      codeFilePath: codeFile,
      outputFilePath: outputFile,
      reportFilePath: reportFile,
      appSettingsPath: path.join(tempDir, "appsettings.json"),
      maintainabilityHistory: history
    });

    assert.strictEqual(result.maintainabilityDrift.blocking, false);
    assert.strictEqual(fs.existsSync(outputFile), true);

    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    assert.ok(report.maintainabilityDrift);
    assert.strictEqual(report.maintainabilityDrift.blocking, false);
  });
}

function testBatchIdentityAndSanitization() {
  withTempFiles((tempDir) => {
    writeAppSettings(tempDir);
    const codeFilePath = path.join(tempDir, "Code.ts");
    const outputFilePath = path.join(tempDir, "Code.cs");
    const reportFilePath = path.join(tempDir, "report.json");
    fs.writeFileSync(codeFilePath, "await page.getByRole('button', { name: 'Login' }).click();", "utf8");
    const options = { codeFilePath, outputFilePath, reportFilePath, appSettingsPath: path.join(tempDir, "appsettings.json") };
    const legacy = generateCSharpCode(options);
    assert.ok(legacy.code.includes("public sealed class CodegenRecordedFlow"));
    assert.ok(legacy.code.includes("public CodegenRecordedFlow(IPage page, ConfigReader config)"));
    assert.ok(!legacy.code.includes("// Test case:"));
    assert.ok(!legacy.code.includes("// Source: Code.ts"));
    assert.ok(!Object.hasOwn(JSON.parse(fs.readFileSync(reportFilePath, "utf8")), "caseId"));
    assert.strictEqual(generateCSharpCode({ ...options, className: "CodegenRecordedFlow" }).code, legacy.code);
    for (const [input, expected] of [["CodegenFlowTC01", "CodegenFlowTC01"], ["12 bad-name!", "_12_bad_name_"], ["class", "_class"], ["void", "_void"]]) {
      const result = generateCSharpCode({ ...options, className: input, caseId: "TC01", caseTitle: "Create order" });
      assert.ok(result.code.startsWith("// Test case: TC01 - Create order\n// Source: Code.ts\n"));
      assert.ok(result.code.includes(`public sealed class ${expected}`));
      assert.ok(result.code.includes(`public ${expected}(IPage page, ConfigReader config)`));
      const report = JSON.parse(fs.readFileSync(reportFilePath, "utf8"));
      assert.strictEqual(report.caseId, "TC01");
      assert.strictEqual(report.caseTitle, "Create order");
      assert.strictEqual(report.className, expected);
      assert.strictEqual(report.unsupportedActionCount, 0);
    }
    const escaped = generateCSharpCode({ ...options, caseId: "TC01\nmalicious", caseTitle: "Title\r\nnext" });
    assert.ok(escaped.code.startsWith("// Test case: TC01 malicious - Title  next\n// Source: Code.ts\n"));
    assert.strictEqual(generateCSharpCode({ ...options, caseTitle: "Missing closing {" }).validation.success, true);
  });
}

function testNestedBatchCliProjectInference() {
  withTempFiles((tempDir) => {
    writeAppSettings(tempDir);
    writeFrameworkFiles(tempDir);
    const caseDir = path.join(tempDir, "CodegenAI", "Recordings", "Demo", "TC01");
    fs.mkdirSync(caseDir, { recursive: true });
    const codeFilePath = path.join(caseDir, "Code.ts");
    const outputFilePath = path.join(caseDir, "Code.cs");
    const reportFilePath = path.join(caseDir, "report.json");
    fs.writeFileSync(codeFilePath, "await page.goto('https://documentadministration-sit.trimont.com/adminReassign.aspx');", "utf8");
    for (const rootArgs of [["--project-root", tempDir], ["--appsettings-file", path.join(tempDir, "appsettings.json")]]) {
      require("child_process").execFileSync(process.execPath, [
        path.join(__dirname, "CSharpCodeGenerator.cjs"),
        "--code-file", codeFilePath, "--output-file", outputFilePath,
        "--report-file", reportFilePath, "--class-name", "CodegenFlowTC01",
        "--case-id", "TC01", "--case-title=--Create order=value", ...rootArgs
      ]);
      const code = fs.readFileSync(outputFilePath, "utf8");
      assert.ok(code.includes("public sealed class CodegenFlowTC01"));
      assert.ok(code.includes("public CodegenFlowTC01(IPage page, ConfigReader config)"));
      assert.ok(code.includes("_commonActions.NavigateToURLAsync(Config.Urls.DocAdmin)"));
      assert.strictEqual(JSON.parse(fs.readFileSync(reportFilePath, "utf8")).caseTitle, "--Create order=value");
    }
  });
}

function testBatchPowerShellOrchestration() {
  if (process.platform !== "win32") {
    console.log("Batch PowerShell 5.1 integration checks skipped on non-Windows host");
    return;
  }
  withTempFiles((tempDir) => {
    const recorderRoot = path.join(tempDir, "CodegenAI");
    fs.mkdirSync(recorderRoot, { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), path.join(recorderRoot, "StartCodegen.ps1"));
    const copyTooling = (source, target) => {
      fs.mkdirSync(target, { recursive: true });
      for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        if (entry.isDirectory() && !["node_modules", "auth"].includes(entry.name)) copyTooling(path.join(source, entry.name), path.join(target, entry.name));
        else if (entry.isFile() && entry.name.endsWith(".cjs")) fs.copyFileSync(path.join(source, entry.name), path.join(target, entry.name));
      }
    };
    copyTooling(path.resolve(__dirname, ".."), path.join(recorderRoot, "AIRecorder"));
    const batchName = `phase1-test-${process.pid}-${Date.now()}`;
    const recordingsRoot = path.join(recorderRoot, "Recordings");
    const batchFolder = path.join(recordingsRoot, batchName);
    const workFolder = path.join(batchFolder, ".work");
    const latestPath = path.join(recordingsRoot, "latest-batch.txt");
    const oldLatest = fs.existsSync(latestPath) ? fs.readFileSync(latestPath) : null;
    const sessionPath = path.join(recorderRoot, "AIRecorder", "auth", "session.json");
    const oldSession = fs.existsSync(sessionPath) ? fs.readFileSync(sessionPath) : null;
    const csvPath = path.join(tempDir, "testcases.csv");
    const headers = "TestCaseId,Title,StartUrl,Preconditions,ExpectedResult,Priority,DataHint\n";
    const validRows = "TC01,First case,,Ready,Done,High,\nTC02,Second case,,Ready,Validated,Medium,\n";
    const manifest = () => JSON.parse(fs.readFileSync(path.join(batchFolder, "manifest.json"), "utf8"));
    function run(args, expectedStatus = 0) {
      const result = require("child_process").spawnSync("powershell.exe", [
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(recorderRoot, "StartCodegen.ps1"),
        "-BatchFile", csvPath, "-BatchName", batchName, "-StrictLocators", ...args
      ], { encoding: "utf8", timeout: 60000, env: { ...process.env, NODE_PATH: path.dirname(path.dirname(require.resolve("typescript/package.json"))) } });
      assert.strictEqual(result.status, expectedStatus, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
      return `${result.stdout}\n${result.stderr}`;
    }
    try {
      fs.writeFileSync(csvPath, headers + validRows);
      run(["-DryRun"]);
      assert.deepStrictEqual(manifest().testCases.map((entry) => entry.status), ["planned", "planned"]);
      assert.deepStrictEqual(fs.readdirSync(batchFolder), ["manifest.json"]);
      assert.ok(!fs.existsSync(workFolder));
      assert.strictEqual(manifest().testCases[0].workFolder, ".work/TC01");
      assert.strictEqual(manifest().testCases[0].codeTs, "Code.ts");
      for (const id of ["TC01", "TC02"]) {
        fs.mkdirSync(path.join(workFolder, id), { recursive: true });
        fs.writeFileSync(path.join(workFolder, id, "Code.ts"), "import { test, expect } from '@playwright/test';\n\ntest('test', async ({ page }) => {\n  await page.getByRole('button', { name: 'Login' }).click();\n});\n");
      }
      run(["-GenerateOnly", "-SkipLiveObservation"]);
      assert.strictEqual(fs.readFileSync(latestPath, "utf8"), `Recordings/${batchName}`);
      assert.deepStrictEqual(manifest().testCases.map((entry) => entry.status), ["generated", "generated"]);
      for (const id of ["TC01", "TC02"]) {
        const code = fs.readFileSync(path.join(workFolder, id, "Code.cs"), "utf8");
        assert.ok(code.includes(`public sealed class CodegenFlow${id}`));
        assert.ok(fs.existsSync(path.join(workFolder, id, "CSharpGenerationReport.json")));
        assert.ok(fs.existsSync(path.join(workFolder, id, "TableLocatorMetadata.json")));
        assert.ok(!fs.existsSync(path.join(workFolder, id, "LiveObservations.json")));
        assert.ok(!fs.existsSync(path.join(workFolder, id, ".csharp-live-sync.stop")));
      }
      const sharedTs = fs.readFileSync(path.join(batchFolder, "Code.ts"), "utf8");
      assert.strictEqual((sharedTs.match(/^import /gm) || []).length, 1);
      assert.ok(sharedTs.includes("test('TC01 - First case'"));
      assert.ok(sharedTs.includes("test('TC02 - Second case'"));
      assert.strictEqual(JSON.parse(fs.readFileSync(path.join(batchFolder, "CSharpGenerationReport.json"), "utf8")).cases.length, 2);
      const untouchedEntry = manifest().testCases[1];
      const untouchedFiles = fs.readdirSync(path.join(workFolder, "TC02")).map((name) => {
        const file = path.join(workFolder, "TC02", name);
        return { file, bytes: fs.readFileSync(file), mtime: fs.statSync(file).mtimeMs };
      });
      const selectedSource = path.join(workFolder, "TC01", "Code.ts");
      fs.writeFileSync(selectedSource, fs.readFileSync(selectedSource, "utf8").replace("name: 'Login'", "name: 'Save'"));
      // Omitting SkipLiveObservation still must never open a browser.
      run(["-GenerateOnly", "-Only", "TC01"]);
      const replacedTs = fs.readFileSync(path.join(batchFolder, "Code.ts"), "utf8");
      assert.strictEqual(replacedTs, sharedTs.replace("name: 'Login'", "name: 'Save'"));
      assert.deepStrictEqual(manifest().testCases.map((entry) => entry.id), ["TC01", "TC02"]);
      assert.deepStrictEqual(manifest().testCases[1], untouchedEntry);
      for (const item of untouchedFiles) {
        assert.deepStrictEqual(fs.readFileSync(item.file), item.bytes);
        assert.strictEqual(fs.statSync(item.file).mtimeMs, item.mtime);
      }
      // A new CSV order controls shared output, even for a partial regeneration.
      fs.writeFileSync(csvPath, headers + validRows.trim().split("\n").reverse().join("\n") + "\n");
      run(["-GenerateOnly", "-Only", "TC01"]);
      assert.deepStrictEqual(manifest().testCases.map((entry) => entry.id), ["TC02", "TC01"]);
      const reorderedTs = fs.readFileSync(path.join(batchFolder, "Code.ts"), "utf8");
      assert.ok(reorderedTs.indexOf("test('TC02") < reorderedTs.indexOf("test('TC01"));
      fs.writeFileSync(csvPath, headers + validRows);
      // Two recorded test blocks must never become a falsely successful case.
      fs.appendFileSync(selectedSource, "\ntest('extra', async ({ page }) => {\nawait page.getByRole('button', { name: 'Other' }).click();\n});\n");
      run(["-GenerateOnly", "-Only", "TC01"], 1);
      const mergeFailure = JSON.parse(fs.readFileSync(path.join(batchFolder, "CSharpGenerationReport.json"), "utf8"));
      assert.strictEqual(manifest().testCases[0].status, "failed: sprint merge error");
      assert.strictEqual(mergeFailure.codeGenerationBlocked, true);
      assert.match(mergeFailure.cases[0].mergeError, /exactly one test/);
      assert.ok(fs.readFileSync(path.join(batchFolder, "Code.ts"), "utf8").includes("test('TC02"));
      fs.writeFileSync(path.join(workFolder, "TC01", "Code.ts"), "// empty recording\n");
      run(["-GenerateOnly"], 1);
      assert.deepStrictEqual(manifest().testCases.map((entry) => entry.status), ["failed: empty recording", "generated"]);
      const afterFailure = fs.readFileSync(path.join(batchFolder, "Code.ts"), "utf8");
      assert.ok(!afterFailure.includes("test('TC01"));
      assert.ok(afterFailure.includes("test('TC02"));
      fs.unlinkSync(path.join(workFolder, "TC01", "Code.ts"));
      run(["-GenerateOnly", "-Only", "TC01"]);
      assert.strictEqual(manifest().testCases[0].status, "skipped");
      // Reject incompatible manifests before touching any files, including when
      // working inputs exist, the invalid entry is selected/skipped, or no Only
      // filter is supplied. Never silently normalize invalid path fields.
      const validManifestBytes = fs.readFileSync(path.join(batchFolder, "manifest.json"));
      const snapshot = () => {
        const files = [];
        const visit = (folder) => {
          for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const file = path.join(folder, entry.name);
            if (entry.isDirectory()) visit(file);
            else files.push({ file, bytes: fs.readFileSync(file), mtime: fs.statSync(file).mtimeMs });
          }
        };
        visit(batchFolder);
        files.push({ file: latestPath, bytes: fs.readFileSync(latestPath), mtime: fs.statSync(latestPath).mtimeMs });
        return files;
      };
      const malformedCases = [
        { change: (m) => { m.batchId = "WrongBatch"; } },
        { change: (m) => { m.testCases = {}; }, mergerRejects: true },
        { change: (m) => { m.testCases[0] = null; }, mergerRejects: true },
        { change: (m) => { m.testCases[1].id = "tc01"; }, mergerRejects: true },
        { change: (m) => { m.testCases[1].id = "../escape"; }, mergerRejects: true },
        { change: (m) => { m.testCases[1].id = "CON"; }, mergerRejects: true },
        { change: (m) => { m.testCases[1].status = null; }, mergerRejects: true },
        { change: (m) => { m.testCases[1].title = " "; }, mergerRejects: true },
        { change: (m) => { delete m.testCases[1].workFolder; }, mergerRejects: true },
        { change: (m) => { m.testCases[0].workFolder = "../escape"; }, mergerRejects: true },
        ...["folder", "codeTs", "codeCs", "report", "tableMetadata"].map((field) => ({
          change: (m) => { m.testCases[1][field] = "invalid/path"; }
        }))
      ];
      try {
        for (const invalid of malformedCases) {
          const malformed = JSON.parse(validManifestBytes.toString("utf8"));
          invalid.change(malformed);
          fs.writeFileSync(path.join(batchFolder, "manifest.json"), JSON.stringify(malformed));
          const beforeRejection = snapshot();
          for (const args of [["-GenerateOnly", "-Only", "TC01"], ["-GenerateOnly"], ["-DryRun"]]) {
            assert.ok(run(args, 1).includes("Invalid batch manifest"));
            assert.deepStrictEqual(snapshot(), beforeRejection, "Rejection must not write or normalize any files");
          }
          if (invalid.mergerRejects) {
            assert.throws(() => require("./SprintMerger.cjs").rebuildSprint(path.join(batchFolder, "manifest.json")), /Invalid|expected workFolder/);
            assert.deepStrictEqual(snapshot(), beforeRejection, "Merger rejection must not write output");
          }
        }
        fs.writeFileSync(path.join(batchFolder, "manifest.json"), "{ invalid JSON");
        const beforeBadJson = snapshot();
        assert.ok(run(["-GenerateOnly"], 1).includes("cannot parse JSON"));
        assert.deepStrictEqual(snapshot(), beforeBadJson);
      } finally {
        fs.writeFileSync(path.join(batchFolder, "manifest.json"), validManifestBytes);
      }
      const beforeInvalid = fs.readFileSync(path.join(batchFolder, "manifest.json"));
      assert.ok(run(["-DryRun", "-Only", "UNKNOWN"], 1).includes("Unknown -Only TestCaseId"));
      for (const [rows, message] of [
        ["TC01,One,,,,,\ntc01,Two,,,,,\n", "Duplicate TestCaseId"],
        ["../escape,One,,,,,\n", "Invalid TestCaseId"],
        ["TC01,   ,,,,,\n", "Title is required"],
        ["TC-01,One,,,,,\nTC_01,Two,,,,,\n", "same C# class"],
        ["CON,One,,,,,\n", "Reserved Windows folder name"]
      ]) {
        fs.writeFileSync(csvPath, headers + rows);
        assert.ok(run(["-DryRun"], 1).includes(message));
        assert.deepStrictEqual(fs.readFileSync(path.join(batchFolder, "manifest.json")), beforeInvalid);
      }
      assert.deepStrictEqual(fs.existsSync(sessionPath) ? fs.readFileSync(sessionPath) : null, oldSession);
    } finally {
      fs.rmSync(batchFolder, { recursive: true, force: true });
      if (oldLatest) fs.writeFileSync(latestPath, oldLatest);
      else fs.rmSync(latestPath, { force: true });
    }
  });
  console.log("Batch PowerShell integration tests passed (dry-run, generate-only, merge, failures, validation, session isolation)");
}

function testDownloadAndUnknownPromiseGeneration() {
  withTempFiles((tempDir) => {
    writeAppSettings(tempDir);
    const options = {
      codeFilePath: path.join(tempDir, "Code.ts"), outputFilePath: path.join(tempDir, "Code.cs"),
      reportFilePath: path.join(tempDir, "report.json"), appSettingsPath: path.join(tempDir, "appsettings.json")
    };
    // Sanitized reproduction of the popup / nested-frame export in the real recording.
    const recorded = [
      "const page1Promise = page.waitForEvent('popup');",
      "await page.getByRole('link', { name: 'Open report' }).click();",
      "const page1 = await page1Promise;",
      "const downloadPromise = page1.waitForEvent('download');",
      "await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByTestId('export-xlsx-btn').click();",
      "const download = await downloadPromise;"
    ].join("\n");
    for (const enterpriseMode of [false, true]) {
      fs.writeFileSync(options.codeFilePath, recorded);
      const result = generateCSharpCode({ ...options, enterpriseMode });
      assert.strictEqual(result.validation.success, true, result.validation.errors.join(" | "));
      assert.strictEqual(result.unsupportedActions.length, 0);
      assert.ok(result.code.includes("var download = await _page1.RunAndWaitForDownloadAsync(async () =>"));
      assert.ok(!result.code.includes("await downloadPromise"));
      assert.ok(!result.code.includes("IPage _download"));
      assert.ok(result.code.includes('_page1.FrameLocator("iframe").FrameLocator("iframe").GetByTestId("export-xlsx-btn")'));
      assert.strictEqual(result.actionFidelity.success, true);
      assert.ok(/RunAndWaitForDownloadAsync\(async \(\) =>\s*\{[\s\S]*?\.ClickAsync\(\);\s*\}\);/.test(result.code));
    }
    // A long linear flow must not split subscription and trigger across methods.
    fs.writeFileSync(options.codeFilePath, [
      ...Array.from({ length: 10 }, (_, i) => `await page.getByRole('button', { name: 'Step ${i}' }).click();`),
      "const downloadPromise = page.waitForEvent('download');",
      "await page.getByRole('button', { name: 'Export' }).click();",
      "const download = await downloadPromise;"
    ].join("\n"));
    const linear = generateCSharpCode({ ...options, enterpriseMode: true });
    assert.strictEqual(linear.validation.success, true);
    assert.ok(linear.code.includes("Page.RunAndWaitForDownloadAsync(async () =>"));
    assert.ok(!linear.code.includes("await downloadPromise"));

    fs.writeFileSync(options.codeFilePath, [
      "const responsePromise = page.waitForEvent('response');",
      "await page.getByRole('button', { name: 'Go' }).click();",
      "const response = await responsePromise;",
      "const mystery = await unknownPromise;",
      "await anotherPromise;",
      "const unfinished = page.waitForEvent('download');"
    ].join("\n"));
    const unknown = generateCSharpCode(options);
    assert.strictEqual(unknown.unsupportedActions.length, 5);
    assert.ok(unknown.actions.every((action) => action.actionType !== "popupResolve"));
    assert.strictEqual(JSON.parse(fs.readFileSync(options.reportFilePath, "utf8")).unsupportedActions.length, 5);
    const executable = unknown.code.replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!executable.includes("await responsePromise"));
    assert.ok(!executable.includes("await unknownPromise"));
    assert.strictEqual(unknown.validation.success, false);
    assert.strictEqual(unknown.codeGenerationBlocked, true);
    assert.ok(unknown.validation.errors.some((error) => error.includes("unsupported statements")));
  });
}

function testUndeclaredAwaitedVariableValidation() {
  const wrap = (body) => `using Microsoft.Playwright;\npublic class Flow { public async Task ReplayAsync() { ${body} } }`;
  assert.strictEqual(validateGeneratedCSharp(wrap("await missingPromise;"), []).success, false);
  assert.strictEqual(validateGeneratedCSharp(wrap("await missingPromise.ConfigureAwait(false);"), []).success, false);
  assert.strictEqual(validateGeneratedCSharp(wrap("var pending = Page.WaitForPopupAsync(); var popup = await pending;"), []).success, true);
  assert.strictEqual(validateGeneratedCSharp(wrap("Task<IPage> pending = Page.WaitForPopupAsync(); var popup = await pending;"), []).success, true);
  assert.strictEqual(validateGeneratedCSharp(wrap("{ var pending = Page.WaitForPopupAsync(); } await pending;"), []).success, false);
  assert.strictEqual(validateGeneratedCSharp(wrap('var text = "await missingPromise;"; // await ignored;\n'), []).success, true);
}

function testGenerationFailureExitCodes() {
  if (process.platform !== "win32") return;
  withTempFiles((tempDir) => {
    const recorder = path.join(tempDir, "CodegenAI");
    const generatorDir = path.join(recorder, "AIRecorder", "Generator");
    const authDir = path.join(recorder, "AIRecorder", "auth");
    fs.mkdirSync(generatorDir, { recursive: true });
    fs.mkdirSync(authDir, { recursive: true });
    fs.copyFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), path.join(recorder, "StartCodegen.ps1"));
    fs.copyFileSync(path.resolve(__dirname, "../auth/SessionManager.ps1"), path.join(authDir, "SessionManager.ps1"));
    fs.writeFileSync(path.join(generatorDir, "SprintMerger.cjs"), `if (process.argv.includes('--review-summary')) { console.log('review summary'); } else { const result = require(${JSON.stringify(path.join(__dirname, "SprintMerger.cjs"))}).rebuildSprint(process.argv[process.argv.indexOf('--manifest-file') + 1]); process.exitCode = result.errors.length ? 1 : 0; }`);
    writeAppSettings(tempDir);
    const shim = path.join(generatorDir, "CSharpCodeGenerator.cjs");
    const realGenerator = path.join(__dirname, "CSharpCodeGenerator.cjs");
    const delegate = `const r = require('child_process').spawnSync(process.execPath, [${JSON.stringify(realGenerator)}, ...process.argv.slice(2)], { stdio: 'inherit' }); process.exit(r.status === null ? 1 : r.status);`;
    fs.writeFileSync(shim, delegate);
    const csv = path.join(recorder, "cases.csv");
    fs.writeFileSync(csv, "TestCaseId,Title,StartUrl,Preconditions,ExpectedResult,Priority,DataHint\nTC01,Blocked case,,Ready,Blocked,High,\nTC02,Valid case,,Ready,Generated,High,\n");
    const quote = (value) => `'${value.replace(/'/g, "''")}'`;
    const run = (args, expectedCode) => {
      // Stub only browser recording. The real script, session helper and final
      // generator execute against disposable files; no application is opened.
      const command = `function npx { $global:LASTEXITCODE = 0 }; & ${quote(path.join(recorder, "StartCodegen.ps1"))} -StrictLocators ${args} ; exit $LASTEXITCODE`;
      const result = require("child_process").spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { encoding: "utf8", timeout: 60000 });
      assert.strictEqual(result.status, expectedCode, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
      return `${result.stdout}\n${result.stderr}`;
    };
    const code = "await page.getByRole('button', { name: 'Submit' }).click();";
    const blockedDom = JSON.stringify({ actions: [{ line: 1, matchCount: 1, target: { tagName: "div" } }] });
    fs.writeFileSync(path.join(recorder, "Code.ts"), code);
    fs.writeFileSync(path.join(recorder, "AIRecorder", "LiveObservations.json"), blockedDom);
    const legacyOutput = run("-SkipLiveObservation -SkipTableLocatorPostProcess", 1);
    assert.ok(legacyOutput.includes("generation blocked"));
    const legacyReport = JSON.parse(fs.readFileSync(path.join(recorder, "CSharpGenerationReport.json"), "utf8"));
    assert.strictEqual(legacyReport.locatorValidation.hasFailures, true);
    assert.strictEqual(legacyReport.validation.success, false);
    assert.ok(!fs.existsSync(path.join(recorder, "Code.cs")));
    const batchArgs = `-BatchFile ${quote(csv)} -BatchName FailureTest`;
    run(`${batchArgs} -DryRun`, 0);
    const batch = path.join(recorder, "Recordings", "FailureTest");
    for (const id of ["TC01", "TC02"]) {
      fs.mkdirSync(path.join(batch, ".work", id), { recursive: true });
      fs.writeFileSync(path.join(batch, ".work", id, "Code.ts"), `import { test, expect } from '@playwright/test';\ntest('test', async ({ page }) => {\n${code}\n});`);
    }
    fs.writeFileSync(path.join(batch, ".work", "TC01", "LiveObservations.json"), JSON.stringify({ actions: [{ line: 3, matchCount: 1, target: { tagName: "div" } }] }));
    run(`${batchArgs} -GenerateOnly -SkipTableLocatorPostProcess`, 1);
    let manifest = JSON.parse(fs.readFileSync(path.join(batch, "manifest.json"), "utf8"));
    assert.deepStrictEqual(manifest.testCases.map((entry) => entry.status), ["failed: generation blocked", "generated"]);
    // An ostensibly successful process must still fail if its report blocks generation.
    fs.writeFileSync(shim, `const fs = require('fs'); const args = process.argv; fs.writeFileSync(args[args.indexOf('--report-file') + 1], JSON.stringify({ validation: { success: true }, codeGenerationBlocked: true }));`);
    assert.ok(run("-SkipLiveObservation -SkipTableLocatorPostProcess", 1).includes("generation blocked"));
    // Native crash/no report must not reuse the previous blocked report.
    fs.writeFileSync(shim, "process.exit(7);");
    assert.ok(run("-SkipLiveObservation -SkipTableLocatorPostProcess", 1).includes("generation error"));
    run(`${batchArgs} -GenerateOnly -Only TC02 -SkipTableLocatorPostProcess`, 1);
    manifest = JSON.parse(fs.readFileSync(path.join(batch, "manifest.json"), "utf8"));
    assert.strictEqual(manifest.testCases[1].status, "failed: generation error");
    console.log("Failure visibility tests passed: legacy blocked exit=1; batch blocked exit=1 and continuation; blocked report with exit=0 rejected; generation error exit=1");
  });
}

function runAllTests() {
  testGenerationFailureExitCodes();
  testDownloadAndUnknownPromiseGeneration();
  testUndeclaredAwaitedVariableValidation();
  testBatchIdentityAndSanitization();
  testNestedBatchCliProjectInference();
  testBatchPowerShellOrchestration();
  testClickMapping();
  testFillAndSelectOptionMapping();
  testGotoUsesConfiguredUrl();
  testGotoUsesConfiguredApplicationUrl();
  testTableLocatorConversion();
  testFrameConversion();
  testAssertionConversion();
  testNamedLocatorGeneration();
  testPositionedRoleConversion();
  testAdditionalCodegenSelectors();
  testDuplicateLocatorReuse();
  testDuplicateNamesDisambiguated();
  testSelectorBasedNaming();
  testUnsupportedActionIsReported();
  testGeneratedCodeValidation();
  testGeneratedCodeValidationDoesNotFlagPropertyNames();
  testGeneratedCodeValidationIgnoresUnsupportedComments();
  testCompactFormattingRemovesSourceComments();
  testFrameworkAwareNavigationAndLocators();
  testFrameworkAwareSourceMappingPreserved();
  testFrameworkAwareFallbackForFramesAndTables();
  testFrameworkLocatorReuseRequiresExactExpressionMatch();
  testRecorderAnnotationLinesAreParsedAsActions();
  testPopupActorActionsAreSupported();
  testEnterpriseModeSplitsNonPopupFlowIntoMethodsWithWaits();
  testEnterpriseModeSplitsLongLinearFlowIntoPartMethods();
  testLocatorValidationFailureBlocksOutputWrite();
  testTextVsAttributeEndToEndValidation();
  testLocatorRepairSingleAttemptPassesAndWritesCode();
  testLocatorRepairSingleAttemptFailureKeepsCodeBlocked();
  testLocatorRepairConvertsTestDataRowLocatorToStableDataAttribute();
  testLocatorRepairDoesNotApproveInventedAttributes();
  testLocatorRepairFailsWhenRepairedLocatorIsNonUnique();
  testDataContractPassAllowsGeneration();
  testDataContractWarningAllowsGenerationWithWarnings();
  testDataContractBlockedStopsGenerationBeforeLocatorFlow();
  testMethodQualityGatePassAcceptsGeneration();
  testMethodQualityGateWarningAllowsGenerationAndAddsWarnings();
  testMethodQualityGateBlockedPreventsOverwrite();
  testDataContractAndLocatorGatesRemainAuthoritativeWithMethodQualityGateIntegrated();
  testExecutionReliabilityPassIsReported();
  testExecutionReliabilityWarningIncludesEvidenceAndRecommendation();
  testExecutionReliabilityBlockedIncludesCategorySeverityConfidence();
  testMaintainabilityDriftSectionReportedWithInsufficientHistory();
  testMaintainabilityDriftHighSeverityFromHistoryHotspot();
  testMaintainabilityDriftIsReportOnlyAndDoesNotBlockOutput();
  runLocatorValidatorTests();
  runLocatorRepairTests();
  runFailureTriageTests();
  runTestDataContractTests();
  console.log("CSharpCodeGenerator tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};