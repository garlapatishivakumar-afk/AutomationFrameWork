const assert = require("assert");
const {
  analyzeMaintainabilityDrift,
  MaintainabilityDriftIntelligence
} = require("./MaintainabilityDriftIntelligence.cjs");

function testInsufficientHistoryWarning() {
  const result = analyzeMaintainabilityDrift({
    runs: [
      { failed: false },
      { failed: true }
    ]
  });

  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.driftDetected, false);
  assert.strictEqual(result.rules[0].ruleId, "MDI000");
}

function testHighDriftDetectionWithHotspotEvidence() {
  const result = analyzeMaintainabilityDrift({
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
        executionReliability: { category: "ERI001_TIMEOUT_VISIBILITY_RACE" },
        locatorChanges: [{ key: "BeneficiaryAddress" }]
      },
      {
        timestampUtc: "2026-10-03T10:00:00Z",
        failed: true,
        executionReliability: { category: "ERI001_TIMEOUT_VISIBILITY_RACE" },
        locatorChanges: [{ key: "BeneficiaryAddress" }]
      },
      {
        timestampUtc: "2026-10-04T10:00:00Z",
        failed: true,
        executionReliability: { category: "ERI001_TIMEOUT_VISIBILITY_RACE" },
        locatorChanges: [{ key: "BeneficiaryAddress" }]
      },
      {
        timestampUtc: "2026-10-05T10:00:00Z",
        failed: true,
        executionReliability: { category: "ERI001_TIMEOUT_VISIBILITY_RACE" },
        locatorChanges: [{ key: "BeneficiaryAddress" }]
      },
      {
        timestampUtc: "2026-10-06T10:00:00Z",
        failed: true,
        executionReliability: { category: "ERI001_TIMEOUT_VISIBILITY_RACE" },
        locatorChanges: [{ key: "BeneficiaryAddress" }]
      }
    ]
  });

  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.driftDetected, true);
  assert.strictEqual(result.severity, "HIGH");
  assert.ok(result.driftScore >= 75);
  assert.ok(result.hotspots.some((x) => x.key === "BeneficiaryAddress" && x.locatorChanges >= 3));
  assert.ok(result.rules.some((x) => x.ruleId === "MDI001"));
  assert.ok(result.rules.some((x) => x.ruleId === "MDI002"));
}

function testMediumDriftFromRepeatedCategory() {
  const result = analyzeMaintainabilityDrift({
    runs: [
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] },
      { failed: true, executionReliability: { category: "ASSERTION_TIMING_MISMATCH" }, locatorChanges: [] },
      { failed: true, executionReliability: { category: "ASSERTION_TIMING_MISMATCH" }, locatorChanges: [] },
      { failed: true, executionReliability: { category: "ASSERTION_TIMING_MISMATCH" }, locatorChanges: [] },
      { failed: true, executionReliability: { category: "ASSERTION_TIMING_MISMATCH" }, locatorChanges: [] },
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] }
    ]
  });

  assert.strictEqual(result.status, "WARNING");
  assert.ok(result.driftScore >= 35);
  assert.strictEqual(result.driftDetected, true);
  assert.ok(["MEDIUM", "HIGH"].includes(result.severity));
  assert.ok(result.rules.some((x) => x.ruleId === "MDI002"));
}

function testStableHistoryPassRulePresent() {
  const result = analyzeMaintainabilityDrift({
    runs: [
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] },
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] },
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] },
      { failed: false, executionReliability: { category: "NONE" }, locatorChanges: [] }
    ]
  });

  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.driftDetected, false);
  assert.ok(result.rules.some((x) => x.ruleId === "MDI005"));
}

function testClassApiReturnsSameShape() {
  const engine = new MaintainabilityDriftIntelligence();
  const result = engine.analyze({
    runs: [
      { failed: false },
      { failed: false },
      { failed: false }
    ]
  });

  assert.ok(typeof result.driftScore === "number");
  assert.ok(Array.isArray(result.rules));
  assert.ok(Array.isArray(result.recommendations));
}

function runAllTests() {
  testInsufficientHistoryWarning();
  testHighDriftDetectionWithHotspotEvidence();
  testMediumDriftFromRepeatedCategory();
  testStableHistoryPassRulePresent();
  testClassApiReturnsSameShape();
  console.log("MaintainabilityDriftIntelligence tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
