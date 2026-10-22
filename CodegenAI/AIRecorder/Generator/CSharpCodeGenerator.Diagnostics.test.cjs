const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { generateCSharpCode, parseRecordedActions, collectGenerationIssues, formatGenerationIssues } = require("./CSharpCodeGenerator.cjs");
const { LocatorValidator } = require("../Intelligence/LocatorValidator.cjs");
const { rebuildSprint } = require("./SprintMerger.cjs");

// Sanitized Sprint8 TC01: preserve action order, source lines and replay evidence.
// No real host, query parameters, session path, account data, passwords or tokens.
function sprint8Fixture() {
  const source = [
    "import { test, expect } from '@playwright/test';", "",
    "// Session intentionally omitted from sanitized fixture.", "", "", "",
    "test('test', async ({ page }) => {",
    "  await page.goto('https://example.test/ErrorPages/ServerError.aspx?aspxerrorpath=/default.aspx');",
    "  await page.getByRole('link', { name: 'CMBS' }).click();",
    "  await page.getByRole('link', { name: 'Create Order' }).click();",
    "  await page.locator('#order-name').click();",
    "  await page.locator('#order-name').fill('Sample order');",
    "  await page.locator('#loan-type-arrow').click();",
    "  await page.locator('#loan-type-options').getByText('CMBS').click();",
    "  await page.getByText('Type your comments here').click();",
    "  await page.getByText('Type your comments here').fill('Sample comments');",
    "  await page.getByRole('button', { name: 'Next' }).click();",
    "  await page.getByRole('button', { name: 'Search' }).click();",
    "  await page.locator('#add-property').click();",
    "  await page.goto('https://example.test/WebForms/CreateOrder.aspx?LOB=TOKEN&Product=TOKEN');",
    "  await page.getByRole('button', { name: 'Yes' }).click();",
    "  await page.getByRole('button', { name: 'Save & Submit' }).click();",
    "  await page.getByRole('heading', { name: 'Confirmation:' }).click();",
    "});"
  ].join("\r\n");
  const actions = parseRecordedActions(source);
  const observations = { replayVersion: 2, actions: actions.map((action) => {
    const line = action.sourceLine;
    if (line > 21) return { line, observationStatus: "unverified", executionStatus: "skipped", blockedByLine: 21,
      error: "Observation replay incomplete at source line 21; downstream DOM evidence is not reliable." };
    if (line === 21) return { line, matchCount: 0, observationStatus: "observed", executionStatus: "failed",
      error: "Timeout waiting for locator to be attached",
      debug: { readyState: "complete", frameCount: 1, resolvedScope: "unresolved", attachedState: false,
        lastAttempt: { elapsedMs: 9837, mainFrameMatchCount: 0 } } };
    return { line, executionStatus: "succeeded", ...(action.locator ? { matchCount: 1, observationStatus: "observed" } : {}) };
  }) };
  return { source, actions, observations };
}

function runAllTests() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "generation-diagnostics-"));
  try {
    const fixture = sprint8Fixture();
    const work = path.join(root, ".work", "TC01");
    fs.mkdirSync(work, { recursive: true });
    const codeFilePath = path.join(work, "Code.ts");
    const domObservationPath = path.join(work, "LiveObservations.json");
    const outputFilePath = path.join(work, "Code.cs");
    const reportFilePath = path.join(work, "CSharpGenerationReport.json");
    fs.writeFileSync(codeFilePath, fixture.source);
    fs.writeFileSync(domObservationPath, JSON.stringify(fixture.observations));
    fs.writeFileSync(outputFilePath, "previous-good-output");
    const result = generateCSharpCode({ codeFilePath, domObservationPath, outputFilePath, reportFilePath,
      projectRoot: root, caseId: "TC01", className: "CodegenFlowTC01", caseTitle: "Create inspection order", enterpriseMode: true, strictLocators: true });
    assert.strictEqual(result.codeGenerationBlocked, true);
    assert.strictEqual(result.locatorValidation.failedLocators, 1);
    assert.strictEqual(fs.readFileSync(outputFilePath, "utf8"), "previous-good-output");
    const coverage = result.locatorValidation.observationCoverage;
    assert.strictEqual(coverage.stoppedAtLine, 21);
    assert.strictEqual(coverage.firstUntrustedLine, 22);
    assert.strictEqual(coverage.reason, "Timeout waiting for locator to be attached");
    assert.strictEqual(coverage.replayedActionCount, 13);
    assert.strictEqual(coverage.attemptedActionCount, 14);
    assert.strictEqual(coverage.totalActionCount, 16);
    assert.strictEqual(coverage.skippedActionCount, 2);
    assert.deepStrictEqual(coverage.unverifiedSourceLines, [22, 23]);
    const issues = collectGenerationIssues(result);
    const failed = issues.filter((item) => item.kind === "locatorValidation");
    assert.strictEqual(failed.length, 1);
    assert.deepStrictEqual(failed[0], { severity: "error", kind: "locatorValidation", sourceLine: 21,
      locator: "page.getByRole('button', { name: 'Yes' })", ruleId: "LV012",
      message: "Locator does not match any element in observed DOM. Expected matches=1; observed=0." });
    const replay = issues.find((item) => item.kind === "replayIncomplete");
    assert.match(replay.message, /completed 13\/16 actions; attempted=14; skipped=2/);
    assert.strictEqual(issues.length, 4, "Two diagnostic issues plus two recording guards, without duplicate aggregate summaries");
    assert.strictEqual(replay.sourceLine, 21);
    const output = formatGenerationIssues("TC01", issues).join("\n");
    assert.match(output, /case=TC01.*line=21.*getByRole.*Yes.*LV012/);
    assert.match(output, /Cause class 3/);
    assert.match(output, /UNVERIFIED/);
    const cli = spawnSync(process.execPath, [path.join(__dirname, "CSharpCodeGenerator.cjs"),
      "--code-file", codeFilePath, "--output-file", outputFilePath, "--report-file", reportFilePath,
      "--dom-file", domObservationPath, "--project-root", root, "--case-id", "TC01", "--class-name", "CodegenFlowTC01", "--strict-locators", "true"], { encoding: "utf8" });
    assert.strictEqual(cli.status, 1, cli.stderr);
    const missingArgs = spawnSync(process.execPath, [path.join(__dirname, "CSharpCodeGenerator.cjs")], { encoding: "utf8" });
    assert.strictEqual(missingArgs.status, 2);
    assert.match(cli.stdout, /case=TC01.*line=21.*LV012/);
    assert.match(cli.stdout, /Timeout waiting for locator to be attached/);
    assert.strictEqual(fs.readFileSync(outputFilePath, "utf8"), "previous-good-output");

    const manifestPath = path.join(root, "manifest.json");
    const manifest = { batchId: "SanitizedSprint8", testCases: [
      { id: "TC01", title: "Create inspection order", status: "failed: generation blocked", workFolder: ".work/TC01" },
      { id: "TC02", title: "Not recorded", status: "planned", workFolder: ".work/TC02" },
      { id: "TC03", title: "Missing report", status: "failed: generation error", workFolder: ".work/TC03" }
    ] };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const merged = rebuildSprint(manifestPath);
    assert.strictEqual(merged.codeTs, "");
    assert.strictEqual(merged.codeCs, "");
    assert.strictEqual(merged.report.codeGenerationBlocked, true);
    assert.deepStrictEqual(merged.errors, []); // A blocked case alone is NOT a merger CLI error.
    const persisted = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.deepStrictEqual(persisted.testCases[0].issues, merged.report.cases[0].issues);
    assert.deepStrictEqual(persisted.testCases[0].issues[0], failed[0]);
    assert.deepStrictEqual(persisted.testCases[1].issues, []);
    assert.strictEqual(persisted.testCases[2].issues[0].kind, "generation");
    assert.deepStrictEqual(rebuildSprint(manifestPath).report.cases[0].issues, persisted.testCases[0].issues);
    const mergerCli = spawnSync(process.execPath, [path.join(__dirname, "SprintMerger.cjs"), "--manifest-file", manifestPath], { encoding: "utf8" });
    assert.strictEqual(mergerCli.status, 0);
    assert.match(mergerCli.stdout, /Included 0 case\(s\); blocked=true/);
    assert.match(mergerCli.stdout, /case=TC01.*line=21.*LV012/);

    // An unreadable report remains a merger error, with a persisted explanation.
    fs.writeFileSync(reportFilePath, "invalid-json");
    const corrupt = rebuildSprint(manifestPath);
    assert.strictEqual(corrupt.errors.length, 1);
    assert.match(corrupt.report.cases[0].issues[0].message, /Cannot read case artifacts/);

    // Backward-compatible coverage/report shapes and non-replay failures.
    const legacy = collectGenerationIssues({ locatorValidation: { observationCoverage: {
      status: "INCOMPLETE", firstUntrustedLine: 22, gaps: [{ sourceLine: 21, reason: "Legacy replay failure" }]
    } } });
    assert.strictEqual(legacy[0].sourceLine, 21);
    assert.match(legacy[0].message, /Legacy replay failure/);
    const minimal = collectGenerationIssues({ locatorValidation: { observationCoverage: { status: "INCOMPLETE" } } });
    assert.strictEqual(minimal[0].sourceLine, null);
    assert.match(minimal[0].message, /reason unavailable/);
    const unsupported = collectGenerationIssues({ unsupportedActions: [{ sourceLine: 9, diagnostics: ["Unsupported popup action"] }] });
    assert.strictEqual(unsupported[0].kind, "unsupportedAction");
    assert.strictEqual(unsupported[0].sourceLine, 9);
    assert.deepStrictEqual(collectGenerationIssues({}), []);
    assert.deepStrictEqual(collectGenerationIssues({ locatorValidation: { observationCoverage: { status: "AVAILABLE" } } }), []);

    // Diagnostic locator extraction must not include fill arguments.
    const input = new LocatorValidator().validateActions(parseRecordedActions("await page.getByLabel('Notes').fill('fixture-value-not-for-diagnostics');"));
    assert.strictEqual(input.results[0].locatorExpression, "page.getByLabel('Notes')");
    assert.ok(!JSON.stringify(input).includes("fixture-value-not-for-diagnostics"));
    const unsupportedReplay = new LocatorValidator();
    unsupportedReplay.domObservations = { replayVersion: 2 };
    unsupportedReplay.liveByLine.set(1, { line: 1, type: "unsupportedAction", executionStatus: "skipped", observationStatus: "unverified" });
    const unsupportedCoverage = unsupportedReplay.validateActions([{ sourceLine: 1 }]).observationCoverage;
    assert.strictEqual(unsupportedCoverage.stoppedAtLine, 1);
    assert.match(unsupportedCoverage.reason, /Observer does not support/);
    console.log("Generation diagnostic tests passed (sanitized Sprint8, exact failure, replay counts, CLI exits, manifest persistence, strict gates, legacy reports)");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) runAllTests();
module.exports = { runAllTests, sprint8Fixture };