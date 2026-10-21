const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { LocatorValidator } = require("./LocatorValidator.cjs");

function withTempFiles(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "locator-validator-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function testRejectsAbsoluteXPath() {
  const validator = new LocatorValidator({});
  const result = validator.validateActions([
    {
      sourceLine: 1,
      actionType: "click",
      targetElement: "button",
      locator: { kind: "locator", selector: "/html/body/div[2]/button" }
    }
  ]);

  assert.strictEqual(result.hasFailures, true);
  const failed = result.results[0].rules.find((x) => x.ruleId === "LV002");
  assert.ok(failed);
  assert.strictEqual(failed.status, "FAIL");
}

function testRejectsTextLocatorWhenStableIdExists() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 3,
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
    });

    const validator = new LocatorValidator({ domObservationPath: domFile });
    const result = validator.validateActions([
      {
        sourceLine: 3,
        actionType: "click",
        targetElement: "button",
        locator: { kind: "text", text: "Submit" }
      }
    ]);

    assert.strictEqual(result.hasFailures, true);
    const lv005 = result.results[0].rules.find((x) => x.ruleId === "LV005");
    assert.ok(lv005);
    assert.strictEqual(lv005.status, "FAIL");
    assert.strictEqual(result.results[0].suggestedLocator, "//button[@id='btnSubmit']");
  });
}

function testFailsOnNonUniqueLocatorCount() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 7,
          matchCount: 3,
          target: {
            tagName: "button"
          }
        }
      ]
    });

    const validator = new LocatorValidator({ domObservationPath: domFile });
    const result = validator.validateActions([
      {
        sourceLine: 7,
        actionType: "click",
        targetElement: "button",
        locator: { kind: "locator", selector: "//button[@type='button']" }
      }
    ]);

    assert.strictEqual(result.hasFailures, true);
    const lv012 = result.results[0].rules.find((x) => x.ruleId === "LV012");
    assert.ok(lv012);
    assert.strictEqual(lv012.status, "FAIL");
  });
}

function testPassesStableIdLocatorWithUniqueMatch() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 5,
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
    });

    const validator = new LocatorValidator({ domObservationPath: domFile });
    const result = validator.validateActions([
      {
        sourceLine: 5,
        actionType: "fill",
        targetElement: "input",
        locator: { kind: "locator", selector: "//input[@id='accountNumber']" }
      }
    ]);

    assert.strictEqual(result.hasFailures, false);
    assert.ok(["PASS", "WARNING"].includes(result.severity));
  });
}

function testDynamicIdIsWarningNotHardFailureWhenUnique() {
  withTempFiles((tempDir) => {
    const domFile = path.join(tempDir, "LiveObservations.json");
    writeJson(domFile, {
      actions: [
        {
          line: 5,
          matchCount: 1,
          target: {
            tagName: "input",
            id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0",
            attributes: {
              id: "ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0"
            }
          }
        }
      ]
    });

    const validator = new LocatorValidator({ domObservationPath: domFile });
    const result = validator.validateActions([
      {
        sourceLine: 5,
        actionType: "fill",
        targetElement: "input",
        locator: { kind: "locator", selector: "//input[@id='ctl00_ContentPlaceHolder1_rgTransactions_ctl00__0']" }
      }
    ]);

    assert.strictEqual(result.hasFailures, false);
    const lv008 = result.results[0].rules.find((x) => x.ruleId === "LV008");
    assert.ok(lv008);
    assert.strictEqual(lv008.status, "WARNING");
  });
}

function runAllTests() {
  testRejectsAbsoluteXPath();
  testRejectsTextLocatorWhenStableIdExists();
  testFailsOnNonUniqueLocatorCount();
  testPassesStableIdLocatorWithUniqueMatch();
  testDynamicIdIsWarningNotHardFailureWhenUnique();
  console.log("LocatorValidator tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
