const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { LocatorRepair } = require("./LocatorRepair.cjs");

function withTempFiles(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "locator-repair-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function testUsesSuggestedLocatorFromValidation() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 2,
          target: {
            tagName: "button",
            id: "btnSubmit",
            attributes: { id: "btnSubmit" }
          }
        }
      ]
    });

    const repair = new LocatorRepair({ domObservationPath: domFile, maxAttempts: 1 });
    const actions = [
      {
        sourceLine: 2,
        locator: { kind: "locator", selector: "//button[text()='Submit']", actor: "page" },
        locatorStrategy: "LOCATOR"
      }
    ];

    const validation = {
      hasFailures: true,
      results: [
        {
          sourceLine: 2,
          locator: "//button[text()='Submit']",
          severity: "FAIL",
          suggestedLocator: "//button[@id='btnSubmit']",
          rules: [{ ruleId: "LV004", status: "FAIL" }]
        }
      ]
    };

    const repaired = repair.repair(actions, validation);
    assert.strictEqual(repaired.attempts, 1);
    assert.strictEqual(repaired.repairedAny, true);
    assert.strictEqual(repaired.items[0].repairedLocator, "//button[@id='btnSubmit']");
    assert.strictEqual(repaired.actions[0].locator.selector, "//button[@id='btnSubmit']");
  });
}

function testBuildsLocatorFromStableAttributesWhenNoSuggestion() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 3,
          target: {
            tagName: "input",
            id: "accountNumber",
            attributes: { id: "accountNumber" }
          }
        }
      ]
    });

    const repair = new LocatorRepair({ domObservationPath: domFile, maxAttempts: 1 });
    const actions = [
      {
        sourceLine: 3,
        locator: { kind: "text", text: "account", actor: "page" },
        locatorStrategy: "TEXT"
      }
    ];

    const validation = {
      hasFailures: true,
      results: [
        {
          sourceLine: 3,
          locator: "account",
          severity: "FAIL",
          suggestedLocator: "",
          rules: [{ ruleId: "LV005", status: "FAIL" }]
        }
      ]
    };

    const repaired = repair.repair(actions, validation);
    assert.strictEqual(repaired.repairedAny, true);
    assert.strictEqual(repaired.items[0].repairedLocator, "//input[@id='accountNumber']");
  });
}

function testFailsWhenNoCandidateExists() {
  const repair = new LocatorRepair({ maxAttempts: 1 });
  const actions = [
    {
      sourceLine: 10,
      locator: { kind: "locator", selector: "//button[text()='Submit']", actor: "page" },
      locatorStrategy: "LOCATOR"
    }
  ];

  const validation = {
    hasFailures: true,
    results: [
      {
        sourceLine: 10,
        locator: "//button[text()='Submit']",
        severity: "FAIL",
        suggestedLocator: "",
        rules: [{ ruleId: "LV004", status: "FAIL" }]
      }
    ]
  };

  const repaired = repair.repair(actions, validation);
  assert.strictEqual(repaired.repairStatus, "FAILED");
  assert.strictEqual(repaired.repairedAny, false);
  assert.strictEqual(repaired.items[0].repairStatus, "FAILED");
}

function runAllTests() {
  testUsesSuggestedLocatorFromValidation();
  testBuildsLocatorFromStableAttributesWhenNoSuggestion();
  testFailsWhenNoCandidateExists();
  console.log("LocatorRepair tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
