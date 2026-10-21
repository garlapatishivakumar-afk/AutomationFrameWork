const assert = require("assert");
const os = require("os");
const path = require("path");
const { FailureTriage } = require("./FailureTriage.cjs");

function makeBaseContext() {
  return {
    codeFilePath: path.join(os.tmpdir(), "Code.ts"),
    codeContent: "await page.getByRole('button', { name: 'Save' }).click();",
    validation: { success: true, errors: [], warnings: [] },
    locatorValidation: { hasFailures: false, results: [] },
    locatorRepair: { attempts: 0, repairStatus: "SKIPPED" }
  };
}

function testBlockedLocatorValidationCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();
  context.locatorValidation = {
    hasFailures: true,
    results: [
      {
        rules: [
          { ruleId: "LV004", status: "FAIL" },
          { ruleId: "LV012", status: "FAIL" }
        ]
      }
    ]
  };

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "LOCATOR_VALIDATION");
  assert.strictEqual(result.blocking, true);
  assert.deepStrictEqual(result.ruleIds.sort(), ["LV004", "LV012"]);
}

function testBlockedRepairFailedCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();
  context.locatorValidation = {
    hasFailures: true,
    results: [
      {
        rules: [{ ruleId: "LV012", status: "FAIL" }]
      }
    ]
  };
  context.locatorRepair = { attempts: 1, repairStatus: "FAILED" };

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "LOCATOR_REPAIR_FAILED");
  assert.strictEqual(result.blocking, true);
}

function testBlockedDomEvidenceMissingCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();
  context.locatorValidation = {
    hasFailures: true,
    results: [
      {
        rules: [
          { ruleId: "LV014", status: "WARNING" },
          { ruleId: "LV012", status: "FAIL" }
        ]
      }
    ]
  };

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "DOM_EVIDENCE_MISSING");
}

function testInputErrorCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();
  context.codeContent = "   ";

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "INPUT_ERROR");
}

function testWarningCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();
  context.validation.warnings = ["Some warning"];

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.category, "UNKNOWN");
}

function testPassCategory() {
  const triage = new FailureTriage();
  const context = makeBaseContext();

  const result = triage.classifyFailure(context);
  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.category, "NONE");
  assert.strictEqual(result.blocking, false);
}

function runAllTests() {
  testBlockedLocatorValidationCategory();
  testBlockedRepairFailedCategory();
  testBlockedDomEvidenceMissingCategory();
  testInputErrorCategory();
  testWarningCategory();
  testPassCategory();
  console.log("FailureTriage tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
