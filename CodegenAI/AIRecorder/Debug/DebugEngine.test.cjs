const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createDebugCopy } = require("./DebugPointManager.cjs");
const { buildDebugPrompt, validateAnalysisResponse } = require("./DebugPromptBuilder.cjs");
const { runDebugEngine } = require("./DebugEngine.cjs");
const { generateCSharpCode } = require("../Generator/CSharpCodeGenerator.cjs");
const { runLiveTableLocatorEngine } = require("../Intelligence/LiveTableLocatorEngine.cjs");

async function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "debug-engine-"));
  try {
    await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildDataUrl(html) {
  return `data:text/html,${encodeURIComponent(html)}`;
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

        public ILocator WrongNamedButton =>
            _page.GetByRole(AriaRole.Button, new() { Name = "Wrong Name" });
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

function writeCodeArtifacts(tempDir, codeTs, options = {}) {
  const codeFilePath = path.join(tempDir, "Code.ts");
  const codeCsPath = path.join(tempDir, "Code.cs");
  const reportPath = path.join(tempDir, "CSharpGenerationReport.json");
  const appSettingsPath = path.join(tempDir, "appsettings.json");
  if (options.frameworkAware) {
    writeFrameworkFiles(tempDir);
  }
  fs.writeFileSync(codeFilePath, codeTs, "utf8");
  fs.writeFileSync(appSettingsPath, JSON.stringify({ Urls: {} }, null, 2), "utf8");
  generateCSharpCode({
    codeFilePath,
    outputFilePath: codeCsPath,
    reportFilePath: reportPath,
    appSettingsPath
  });

  return {
    codeFilePath,
    codeCsPath,
    reportPath,
    appSettingsPath
  };
}

function writeCommandScript(tempDir, name, content) {
  const filePath = path.join(tempDir, `${name}.cjs`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function assertFileExists(filePath) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findLineNumber(filePath, fragment) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(fragment));
  if (index < 0) {
    throw new Error(`Could not find fragment '${fragment}' in ${filePath}`);
  }

  return index + 1;
}

function findGeneratedLine(reportPath, sourceLine) {
  const report = readJson(reportPath);
  const sourceMap = Array.isArray(report.sourceMap) ? report.sourceMap : [];
  const entry = sourceMap.find((item) => Number(item.sourceLine) === Number(sourceLine));
  if (!entry) {
    throw new Error(`Could not find generated line for source line ${sourceLine} in ${reportPath}`);
  }

  return Number(entry.generatedLine);
}

function testDebugPointInsertion() {
  return withTempDir(async (tempDir) => {
    const sourceFile = path.join(tempDir, "Code.cs");
    fs.writeFileSync(sourceFile, `
using Microsoft.Playwright;

public sealed class Sample
{
    public IPage Page { get; }

    public async System.Threading.Tasks.Task ReplayAsync()
    {
        // Source: Code.ts line 10
        await Page.Locator("#old").ClickAsync();
    }
}
`, "utf8");

    const debugCopyPath = path.join(tempDir, "Code.debug.cs");
    const result = createDebugCopy({
      sourceFilePath: sourceFile,
      outputFilePath: debugCopyPath,
      sourceLine: 9,
      noPause: false
    });

    assert.strictEqual(result.created, true);
    assert.ok(fs.readFileSync(debugCopyPath, "utf8").includes("await Page.PauseAsync(); // DebugEngine pause before failing action"));
  });
}

function testMalformedAiResponseRejected() {
  assert.throws(() => validateAnalysisResponse("{}"), /classification/);
}

function testPayloadRedaction() {
  const prompt = buildDebugPrompt({
    testName: "sensitive",
    testCommand: "run",
    sourceFile: "Code.cs",
    sourceLine: 10,
    sourceLineText: 'await Page.GetByText("x").ClickAsync();',
    sourceExcerpt: "password=secret123\nAuthorization: Bearer abc.def\nCookie: sessionid=xyz\napiKey=my-key",
    failedLocator: "text=x",
    locatorStrategy: "TEXT",
    exceptionMessage: "failed",
    stackTrace: "stack",
    browserEvidence: {
      pageState: {
        url: "https://app/?access_token=token123",
        title: "Page"
      }
    }
  }, { category: "locator", confidence: 0.9, reason: "reason" }, []);

  const text = prompt.prompt;
  assert.ok(!text.includes("secret123"));
  assert.ok(!text.includes("abc.def"));
  assert.ok(!text.includes("sessionid=xyz"));
  assert.ok(!text.includes("my-key"));
  assert.ok(!text.includes("token123"));
}

async function testScenarioAWrongLocator() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('wrong-locator', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "wrong-locator-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "locator");
    assert.strictEqual(result.proposal.changeType, "ReplaceLocatorExpression");
    assert.strictEqual(result.proposalValidation.valid, true);
    assert.strictEqual(result.approval.decision, "Pending");
    assert.ok(result.proposal.newCode.includes('GetByTestId("save-button")'));
    assert.strictEqual(fs.readFileSync(artifacts.codeCsPath, "utf8").includes('GetByTestId("save-button")'), false);
    assertFileExists(path.join(result.sessionDir, "debug-point.json"));
    const debugPoint = readJson(path.join(result.sessionDir, "debug-point.json"));
    assert.strictEqual(debugPoint.codeTsLine, 6);
    assert.strictEqual(debugPoint.sourceLine, failureLine);
  });
}

async function testScenarioBTiming() {
  await withTempDir(async (tempDir) => {
    const html = `
<div id="root"></div>
<script>
  setTimeout(() => {
    const button = document.createElement('button');
    button.textContent = 'Delayed Button';
    button.setAttribute('data-testid', 'delayed-btn');
    document.getElementById('root').appendChild(button);
  }, 1500);
</script>`;
    const htmlFile = path.join(tempDir, "timing.html");
    fs.writeFileSync(htmlFile, html, "utf8");
    const fileUrl = `file:///${htmlFile.replace(/\\/g, "/")}`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('timing', async ({ page }) => {
  await page.goto('${fileUrl}');
  await page.getByRole('button', { name: 'Delayed Button' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "timing-fail", `
console.error('TimeoutError: waiting for locator in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      inspectionDelayMs: 1800,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "timing");
    assert.strictEqual(result.proposal.changeType, "InsertWaitBeforeAction");
    assert.strictEqual(result.proposalValidation.valid, true);
  });
}

async function testScenarioCTableGrid() {
  await withTempDir(async (tempDir) => {
    const html = `
<table id="rgTransactions">
  <tbody>
    <tr id="tx-row-1">
      <td>891411</td>
      <td>Investor</td>
      <td><a href="#">View Tx</a></td>
    </tr>
  </tbody>
</table>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('table-grid', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('link', { name: 'View Tx' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
    const domFile = path.join(tempDir, "LiveObservations.json");
    const metadataFile = path.join(tempDir, "TableLocatorMetadata.json");

    await runLiveTableLocatorEngine({
      codeFilePath: artifacts.codeFilePath,
      domFilePath: domFile,
      metadataFilePath: metadataFile,
      storageStateFile: "",
      tableSelector: "table",
      debug: false,
      showBrowser: false,
      skipObservation: false,
      skipRewrite: false
    });

    const codeCsSource = fs.readFileSync(artifacts.codeCsPath, "utf8").replace('GetByRole(AriaRole.Link, new() { Name = "View Tx" })', 'Locator("#broken-link")');
    fs.writeFileSync(artifacts.codeCsPath, codeCsSource, "utf8");
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);

    const failureCommand = writeCommandScript(tempDir, "table-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      domFile,
      metadataFile,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "table/grid");
    assert.ok(["ReplaceLocator", "ReplaceLocatorExpression"].includes(result.proposal.changeType));
    assert.strictEqual(result.proposalValidation.valid, true);
    assert.ok(readJson(metadataFile).actions.length > 0);
  });
}

async function testScenarioDIframe() {
  await withTempDir(async (tempDir) => {
    const html = `<iframe name="details-frame" srcdoc="<button data-testid='frame-button'>Inside Frame</button>"></iframe>`;
    const htmlFile = path.join(tempDir, "iframe.html");
    fs.writeFileSync(htmlFile, html, "utf8");
    const fileUrl = `file:///${htmlFile.replace(/\\/g, "/")}`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('iframe', async ({ page }) => {
  await page.goto('${fileUrl}');
  await page.getByRole('button', { name: 'Inside Frame' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "iframe-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "iframe");
    assert.strictEqual(result.proposal.changeType, "WrapInFrameLocator");
    assert.strictEqual(result.proposalValidation.valid, true);
    assert.ok(result.proposal.newCode.includes('FrameLocator("iframe[name=\\"details-frame\\"]")'));
  });
}

async function testScenarioEApplicationFailure() {
  await withTempDir(async (tempDir) => {
    const landingHtml = `<a href="#">Deals</a><a href="#">Deals Completion Status</a>`;
    const errorHtml = `<div><h1>Internal Server Error. Please contact support.</h1><button>Back to Homepage</button></div>`;
    const landingFile = path.join(tempDir, "landing.html");
    const errorFile = path.join(tempDir, "error.html");
    fs.writeFileSync(landingFile, landingHtml, "utf8");
    fs.writeFileSync(errorFile, errorHtml, "utf8");
    const landingUrl = `file:///${landingFile.replace(/\\/g, "/")}`;
    const errorUrl = `file:///${errorFile.replace(/\\/g, "/")}`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('application-failure', async ({ page }) => {
  await page.goto('${landingUrl}');
  await page.getByRole('link', { name: 'Deals' }).click();
  await page.getByRole('link', { name: 'Deals Completion Status' }).click();
  await page.goto('${errorUrl}');
  await page.getByText('Internal Server Error. Please').click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
    const failureLine = findGeneratedLine(artifacts.reportPath, 9);
    const failureCommand = writeCommandScript(tempDir, "application-fail", `
  console.error('PlaywrightException: unexpected application error in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "application-defect");
    assert.strictEqual(result.proposal.safeToApply, false);
    assert.strictEqual(result.proposal.changeType, "ManualReview");
  });
}

async function testScenarioFSuccessfulRepair() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('repair', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs, { frameworkAware: true });
    const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "repair-rerun", `
const fs = require("fs");
const source = fs.readFileSync(${JSON.stringify(artifacts.codeCsPath)}, "utf8");
if (source.includes('GetByTestId("save-button")')) {
  process.exit(0);
}
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);
    const compileCommand = writeCommandScript(tempDir, "compile-check", `
const fs = require("fs");
const source = fs.readFileSync(${JSON.stringify(artifacts.codeCsPath)}, "utf8");
if (!source.includes('await') || !source.includes('save-button') || !source.includes('GetByTestId(')) {
  console.error('Compile validation failed');
  process.exit(1);
}
process.exit(0);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      compileCommand: `node ${JSON.stringify(compileCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      debugAutoFix: true,
      debugApprove: true,
      debugMaxAttempts: 2
    });

    assert.strictEqual(result.status, "resolved");
    assert.strictEqual(result.classification.category, "locator");
    assert.strictEqual(result.proposalValidation.valid, true);
    assert.ok(fs.readFileSync(artifacts.codeCsPath, "utf8").includes('GetByTestId("save-button")'));
    assertFileExists(path.join(result.sessionDir, "approval.json"));
    assertFileExists(path.join(result.sessionDir, "patch.json"));
    assertFileExists(path.join(result.sessionDir, "compile-result.json"));
    assertFileExists(path.join(result.sessionDir, "rerun-result.json"));
    assertFileExists(path.join(path.dirname(result.sessionDir), "final-result.json"));
    assertFileExists(path.join(path.dirname(result.sessionDir), "session-summary.json"));
    const approval = readJson(path.join(result.sessionDir, "approval.json"));
    assert.strictEqual(approval.decision, "Approved");
    const rerun = readJson(path.join(result.sessionDir, "rerun-result.json"));
    assert.strictEqual(rerun.exitCode, 0);
    const finalResult = readJson(path.join(path.dirname(result.sessionDir), "final-result.json"));
    assert.strictEqual(finalResult.status, "resolved");
    assert.strictEqual(finalResult.stopReason, "Approved patch compiled and rerun passed.");
  });
}

async function testScenarioGAiMockRepair() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('ai-repair', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
    const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failingSourceLine = fs.readFileSync(artifacts.codeCsPath, "utf8").split(/\r?\n/)[failureLine - 1];
    const failureCommand = writeCommandScript(tempDir, "ai-repair-rerun", `
const fs = require("fs");
const source = fs.readFileSync(${JSON.stringify(artifacts.codeCsPath)}, "utf8");
if (source.includes('GetByTestId("save-button")')) process.exit(0);
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);
    const compileCommand = writeCommandScript(tempDir, "ai-compile-check", `
const fs = require("fs");
const source = fs.readFileSync(${JSON.stringify(artifacts.codeCsPath)}, "utf8");
if (!source.includes('GetByTestId("save-button")')) process.exit(1);
process.exit(0);
`);

    const aiClient = {
      async complete() {
        return {
          success: true,
          content: JSON.stringify({
            classification: {
              category: "locator",
              confidence: 0.98,
              reason: "Validated stable test id candidate exists."
            },
            rootCause: {
              summary: "Generated role/name locator no longer matches.",
              evidence: ["data-testid=save-button"]
            },
            proposedFix: {
              type: "ReplaceLocatorExpression",
              file: artifacts.codeCsPath,
              sourceLine: failureLine,
              oldCode: failingSourceLine,
              newCode: '            await Page.GetByTestId("save-button").ClickAsync();',
              reason: "Use the stable test id candidate."
            },
            confidence: 0.98,
            validationPlan: {
              steps: ["Validate candidate", "Compile", "Rerun"]
            },
            requiresHumanApproval: true
          }),
          model: "mock-debug-model",
          promptTokens: 120,
          completionTokens: 80,
          totalTokens: 200,
          latencyMs: 1,
          finishReason: "stop",
          estimated: false
        };
      }
    };

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      compileCommand: `node ${JSON.stringify(compileCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      debugAutoFix: true,
      debugApprove: true,
      aiClient,
      aiConfiguration: {
        provider: "OpenAI",
        model: "mock-debug-model",
        temperature: 0.1,
        maxTokens: 1200
      }
    });

    assert.strictEqual(result.status, "resolved");
    assert.strictEqual(result.analysis.analysisMode, "ai");
    assert.strictEqual(result.analysis.fallbackUsed, false);
    assert.strictEqual(result.tokenUsage.estimated, false);
  });
}

async function testScenarioHDeterministicFallback() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('fallback', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "fallback-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      disableAI: true
    });

    assert.strictEqual(result.analysis.analysisMode, "deterministic");
    assert.strictEqual(result.analysis.fallbackUsed, true);
    assert.strictEqual(result.proposalValidation.valid, true);
    assert.ok(result.analysis.fallbackReason);
  });
}

async function testScenarioKInvalidAiResponseFallsBackSafely() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('invalid-ai', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "invalid-ai-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const aiClient = {
      async complete() {
        return {
          success: true,
          content: "{\"bad\":true}",
          model: "mock-invalid",
          promptTokens: 25,
          completionTokens: 10,
          totalTokens: 35,
          latencyMs: 1,
          finishReason: "stop",
          estimated: false
        };
      }
    };

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      aiClient,
      aiConfiguration: {
        provider: "OpenAI",
        model: "mock-invalid",
        temperature: 0.1,
        maxTokens: 1200
      }
    });

    assert.strictEqual(result.analysis.analysisMode, "deterministic");
    assert.strictEqual(result.analysis.fallbackUsed, true);
    assert.ok(/missing classification|AI proposal/i.test(result.analysis.fallbackReason));
    assert.strictEqual(result.proposalValidation.valid, true);
  });
}

async function testScenarioLBoundedAttemptsStopClearly() {
  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="save-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('bounded-stop', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findLineNumber(artifacts.codeCsPath, 'Wrong Name');
    const failureCommand = writeCommandScript(tempDir, "bounded-rerun", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);
    const compileCommand = writeCommandScript(tempDir, "bounded-compile", "process.exit(0);");

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      compileCommand: `node ${JSON.stringify(compileCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      debugAutoFix: true,
      debugApprove: true,
      debugMaxAttempts: 2,
      disableAI: true
    });

    assert.strictEqual(result.status, "validation-rejected");
    assert.ok(typeof result.stopReason === "string" && result.stopReason.length > 0);
    const sessionSummary = readJson(path.join(path.dirname(result.sessionDir), "session-summary.json"));
    assert.ok(sessionSummary.attempts.length >= 1 && sessionSummary.attempts.length <= 2);
  });
}

async function testScenarioIPopup() {
  await withTempDir(async (tempDir) => {
    const popupFile = path.join(tempDir, "popup.html");
    fs.writeFileSync(popupFile, `<button data-testid="popup-save">Popup Save</button>`, "utf8");
    const popupUrl = `file:///${popupFile.replace(/\\/g, "/")}`;
    const landingFile = path.join(tempDir, "popup-entry.html");
    fs.writeFileSync(landingFile, `<a href="${popupUrl}" target="_blank">Open Popup</a>`, "utf8");
    const landingUrl = `file:///${landingFile.replace(/\\/g, "/")}`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('popup', async ({ page }) => {
  await page.goto('${landingUrl}');
  await page.getByRole('link', { name: 'Open Popup' }).click();
  await page.getByRole('button', { name: 'Popup Save' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 7);
    const failureCommand = writeCommandScript(tempDir, "popup-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "popup");
    assert.strictEqual(result.proposal.safeToApply, false);
  });
}

async function testScenarioJDialog() {
  await withTempDir(async (tempDir) => {
    const dialogFile = path.join(tempDir, "dialog.html");
    fs.writeFileSync(dialogFile, `<button onclick="alert('Blocking dialog')">Open Dialog</button><button>After Dialog</button>`, "utf8");
    const dialogUrl = `file:///${dialogFile.replace(/\\/g, "/")}`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('dialog', async ({ page }) => {
  await page.goto('${dialogUrl}');
  await page.getByRole('button', { name: 'Open Dialog' }).click();
  await page.getByRole('button', { name: 'After Dialog' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 7);
    const failureCommand = writeCommandScript(tempDir, "dialog-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput")
    });

    assert.strictEqual(result.classification.category, "popup");
    assert.strictEqual(result.proposal.safeToApply, false);
  });
}

async function testOptionalLiveProvider() {
  if (process.env.DEBUG_ENGINE_LIVE_AI !== "true") {
    return;
  }

  await withTempDir(async (tempDir) => {
    const html = `<button data-testid="live-ai-button">Actual Name</button>`;
    const codeTs = `
import { test, expect } from '@playwright/test';

test('live-ai', async ({ page }) => {
  await page.goto('${buildDataUrl(html)}');
  await page.getByRole('button', { name: 'Wrong Name' }).click();
});
`;
    const artifacts = writeCodeArtifacts(tempDir, codeTs);
  const failureLine = findGeneratedLine(artifacts.reportPath, 6);
    const failureCommand = writeCommandScript(tempDir, "live-ai-fail", `
console.error('TimeoutError: locator failed in ${artifacts.codeCsPath}:line ${failureLine}');
process.exit(1);
`);

    const result = await runDebugEngine({
      codeFilePath: artifacts.codeFilePath,
      testCommand: `node ${JSON.stringify(failureCommand)}`,
      sourceFile: artifacts.codeCsPath,
      sourceLine: failureLine,
      outputRoot: path.join(tempDir, "GeneratedOutput"),
      aiConfiguration: {
        provider: process.env.DEBUG_ENGINE_AI_PROVIDER || "OpenAI",
        model: process.env.DEBUG_ENGINE_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 1200
      }
    });

    assert.strictEqual(result.analysis.analysisMode, "ai");
  });
}

async function runAllTests() {
  await testDebugPointInsertion();
  testMalformedAiResponseRejected();
  testPayloadRedaction();
  await testScenarioAWrongLocator();
  await testScenarioBTiming();
  await testScenarioCTableGrid();
  await testScenarioDIframe();
  await testScenarioEApplicationFailure();
  await testScenarioFSuccessfulRepair();
  await testScenarioGAiMockRepair();
  await testScenarioHDeterministicFallback();
  await testScenarioKInvalidAiResponseFallsBackSafely();
  await testScenarioLBoundedAttemptsStopClearly();
  await testScenarioIPopup();
  await testScenarioJDialog();
  await testOptionalLiveProvider();
  console.log("DebugEngine tests passed");
}

if (require.main === module) {
  runAllTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests
};