const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  generateCSharpCode,
  parseRecordedActions,
  validateGeneratedCSharp
} = require("./CSharpCodeGenerator.cjs");

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

function runAllTests() {
  testClickMapping();
  testFillAndSelectOptionMapping();
  testGotoUsesConfiguredUrl();
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
  console.log("CSharpCodeGenerator tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};