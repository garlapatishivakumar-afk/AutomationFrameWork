const assert = require("assert");
const {
  classifyExecutionReliability,
  ExecutionReliabilityIntelligence
} = require("./ExecutionReliabilityIntelligence.cjs");

function testPassWhenNoFailureSignal() {
  const result = classifyExecutionReliability({
    failed: false,
    stdout: "test completed"
  });

  assert.strictEqual(result.status, "PASS");
  assert.strictEqual(result.category, "NONE");
  assert.strictEqual(result.blocking, false);
}

function testEri001TimeoutVisibilityRace() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Timeout 30000ms exceeded while waiting for selector #Submit to be visible",
    locator: "#Submit",
    timeoutMs: 30000
  });

  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "TIMEOUT_VISIBILITY_RACE");
  assert.strictEqual(result.rules[0].ruleId, "ERI001");
  assert.strictEqual(result.severity, "HIGH");
  assert.ok(result.confidence >= 0.9);
  assert.ok(result.recommendation.includes("wait strategy"));
}

function testEri002DetachedOrStaleElement() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Element is not attached to the DOM"
  });

  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "DETACHED_OR_STALE_ELEMENT");
  assert.strictEqual(result.rules[0].ruleId, "ERI002");
  assert.strictEqual(result.severity, "HIGH");
}

function testEri003NavigationNotSettled() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Execution context was destroyed, most likely because of a navigation"
  });

  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "NAVIGATION_NOT_SETTLED");
  assert.strictEqual(result.rules[0].ruleId, "ERI003");
  assert.strictEqual(result.severity, "HIGH");
}

function testEri004PopupWindowSync() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Timeout waiting for waitForEvent('popup')"
  });

  assert.strictEqual(result.status, "BLOCKED");
  assert.strictEqual(result.category, "POPUP_WINDOW_SYNC");
  assert.strictEqual(result.rules[0].ruleId, "ERI004");
  assert.strictEqual(result.severity, "HIGH");
}

function testEri005AssertionTimingMismatch() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "expect(locator).toHaveText: expected string but received string"
  });

  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.category, "ASSERTION_TIMING_MISMATCH");
  assert.strictEqual(result.rules[0].ruleId, "ERI005");
  assert.strictEqual(result.severity, "MEDIUM");
}

function testEri006NetworkInfraTransient() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "request failed with net::ERR_CONNECTION_RESET",
    networkErrors: ["ECONNRESET"]
  });

  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.category, "NETWORK_INFRA_TRANSIENT");
  assert.strictEqual(result.rules[0].ruleId, "ERI006");
  assert.strictEqual(result.severity, "MEDIUM");
}

function testEri007UnknownRuntimeFailure() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Unhandled custom runtime failure in plugin adapter"
  });

  assert.strictEqual(result.status, "WARNING");
  assert.strictEqual(result.category, "UNKNOWN_RUNTIME_FAILURE");
  assert.strictEqual(result.rules[0].ruleId, "ERI007");
  assert.strictEqual(result.severity, "MEDIUM");
}

function testPriorityPrefersTimeoutOverAssertion() {
  const result = classifyExecutionReliability({
    failed: true,
    errorMessage: "Timeout waiting for selector #Submit to be visible. expect(locator).toHaveText failed"
  });

  assert.strictEqual(result.rules[0].ruleId, "ERI001");
  assert.strictEqual(result.category, "TIMEOUT_VISIBILITY_RACE");
}

function testClassApiMatchesFunctionApi() {
  const classifier = new ExecutionReliabilityIntelligence();
  const result = classifier.classifyFailure({
    failed: true,
    errorMessage: "Element is not attached to the DOM"
  });

  assert.strictEqual(result.rules[0].ruleId, "ERI002");
}

function runAllTests() {
  testPassWhenNoFailureSignal();
  testEri001TimeoutVisibilityRace();
  testEri002DetachedOrStaleElement();
  testEri003NavigationNotSettled();
  testEri004PopupWindowSync();
  testEri005AssertionTimingMismatch();
  testEri006NetworkInfraTransient();
  testEri007UnknownRuntimeFailure();
  testPriorityPrefersTimeoutOverAssertion();
  testClassApiMatchesFunctionApi();
  console.log("ExecutionReliabilityIntelligence tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
