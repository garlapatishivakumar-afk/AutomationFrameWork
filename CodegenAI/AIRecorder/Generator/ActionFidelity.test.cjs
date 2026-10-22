const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { generateCSharpCode, parseRecordedActions, validateActionFidelity } = require("./CSharpCodeGenerator.cjs");

function runAllTests() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "action-fidelity-"));
  try {
    const codeFilePath = path.join(root, "Code.ts");
    const outputFilePath = path.join(root, "Code.cs");
    const reportFilePath = path.join(root, "report.json");
    const appSettingsPath = path.join(root, "appsettings.json");
    fs.writeFileSync(appSettingsPath, JSON.stringify({ Urls: { Start: "https://example.test/start", Middle: "https://example.test/middle", End: "https://example.test/end" } }));
    const generate = (source, enterpriseMode = true, extra = {}) => {
      fs.writeFileSync(codeFilePath, source.join("\n"));
      return generateCSharpCode({ codeFilePath, outputFilePath, reportFilePath, appSettingsPath, projectRoot: root, enterpriseMode, ...extra });
    };
    const prefix = [
      "await page.goto('https://example.test/start');",
      "await page.getByRole('link', { name: 'CMBS' }).click();",
      "await page.getByRole('link', { name: 'Exceptions' }).click();",
      "await page.getByRole('checkbox', { name: 'EscalatedOnly' }).check();",
      "await page.goto('https://example.test/middle');"
    ];
    const popup = [
      "const page1Promise = page.waitForEvent('popup');",
      "await page.getByRole('link', { name: 'Report' }).click();",
      "const page1 = await page1Promise;",
      "await page1.locator('iframe').contentFrame().locator('iframe').contentFrame().getByTestId('toolbar-export-dropdown').click();",
      "const downloadPromise = page1.waitForEvent('download');",
      "await page1.frameLocator('iframe').frameLocator('iframe').getByTestId('export-xlsx-btn').click();",
      "const download = await downloadPromise;"
    ];
    for (const enterprise of [false, true]) {
      for (const source of [
        [...prefix, ...popup],
        [...prefix, ...popup, "await page.goto('https://example.test/end');"],
        [...prefix, "await page.getByAltText('Filter LoanNumber column').click();", "await page.getByAltText('Filter LoanNumber column').fill('695100026');"]
      ]) {
        const result = generate(source, enterprise);
        assert.strictEqual(result.validation.success, true, result.validation.errors.join(" | "));
        assert.strictEqual(result.unsupportedActions.length, 0);
        assert.strictEqual(result.actionFidelity.success, true);
        assert.deepStrictEqual(result.actionFidelity.emittedSourceLines, source.map((_, index) => index + 1));
        // Assert executable calls, not mere property declarations or parse counts.
        const snippets = [
          'GotoAsync(Config.Urls.Start)', 'await Cmbs.ClickAsync();',
          'await Exceptions.ClickAsync();', 'await EscalatedOnly.CheckAsync();',
          'GotoAsync(Config.Urls.Middle)'
        ];
        let previous = -1;
        for (const snippet of snippets) {
          const current = result.code.indexOf(snippet);
          assert.ok(current > previous, `Missing/reordered call ${snippet}\n${result.code}`);
          previous = current;
        }
        if (source.includes(popup[0])) {
          assert.ok(result.code.includes('_page1.FrameLocator("iframe").FrameLocator("iframe").GetByTestId("toolbar-export-dropdown")'));
          assert.ok(result.code.includes('_page1.FrameLocator("iframe").FrameLocator("iframe").GetByTestId("export-xlsx-btn")'));
          assert.ok(!result.code.includes("contentFrame"));
        } else {
          assert.ok(result.code.includes('Page.GetByAltText("Filter LoanNumber column")'));
          assert.ok(result.code.includes('await FilterLoanNumberColumn.ClickAsync();'));
          assert.ok(result.code.includes('await FilterLoanNumberColumn.FillAsync("695100026");'));
        }
        assert.strictEqual(JSON.parse(fs.readFileSync(reportFilePath)).actionFidelity.success, true);
      }
    }
    const locators = generate([
      'await page.getByAltText("Owner\'s filter", { exact: true }).nth(1).fill("loan");',
      'await page.frameLocator("iframe[name=\\\"outer\\\"]").locator("iframe").contentFrame().getByAltText("Owner\'s filter", { exact: true }).first().click();',
      'await page.frameLocator("iframe").getByTestId("Owner\'s export").last().click();',
      'await page.frameLocator("iframe").locator("#panel").getByRole("button", { name: "Export", exact: true }).click();'
    ]);
    assert.strictEqual(locators.validation.success, true, locators.validation.errors.join(" | "));
    assert.ok(locators.code.includes('GetByAltText("Owner\'s filter", new() { Exact = true }).Nth(1)'));
    assert.ok(locators.code.includes('FrameLocator("iframe[name=\\\"outer\\\"]").FrameLocator("iframe").GetByAltText("Owner\'s filter", new() { Exact = true }).First'));
    assert.ok(locators.code.includes('GetByTestId("Owner\'s export").Last'));
    assert.ok(locators.code.includes('FrameLocator("iframe").Locator("#panel").GetByRole(AriaRole.Button'));

    const previousOutput = fs.readFileSync(outputFilePath);
    const rejected = generate([
      "await page.locator('iframe').contentFrame().locator('#x').unknown('bad').click();",
      "await page.frameLocator('iframe').locator('#x').locator('#y').click();",
      "await page.getByAltText(filterName).click();"
    ]);
    assert.strictEqual(rejected.unsupportedActions.length, 3);
    assert.strictEqual(rejected.codeGenerationBlocked, true);
    assert.deepStrictEqual(fs.readFileSync(outputFilePath), previousOutput, "Blocked generation overwrote the last good C#");

    const actions = parseRecordedActions(prefix.join("\n"));
    for (const emitted of [[1, 5], [1, 3, 2, 4, 5], [1, 2, 2, 3, 4, 5]]) {
      assert.strictEqual(validateActionFidelity(actions, emitted).success, false);
    }
    // Repairs must retain popup actor AND nested frame scope.
    const { LocatorRepair } = require("../Intelligence/LocatorRepair.cjs");
    const framedActions = parseRecordedActions("await page1.frameLocator('outer').frameLocator('inner').getByText('Old').click();");
    const repair = new LocatorRepair({ repairProvider: () => "//button[@id='stable']" });
    const repaired = repair.repair(framedActions, { hasFailures: true, results: [{ sourceLine: 1, severity: "FAIL", suggestedLocator: "//button[@id='stable']", rules: [] }] });
    assert.strictEqual(repaired.repairedAny, true);
    assert.deepStrictEqual(repaired.actions[0].locator.framePath, [{ selector: "outer" }, { selector: "inner" }]);
    assert.strictEqual(repaired.actions[0].locator.actor, "page1");
    console.log("Action fidelity tests passed (navigation order, frames, alt text, blocking, repair scope)");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) runAllTests();
module.exports = { runAllTests };