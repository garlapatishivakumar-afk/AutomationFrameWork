const assert = require("assert");
const { evaluateMethodQuality } = require("./MethodQualityGate.cjs");

function testPassForBasicAsyncMethod() {
  const code = `
public async Task ClickSubmitAsync()
{
    await _page.Locator("//button[@id='btnSubmit']").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  assert.ok(["PASS", "WARNING"].includes(result.status));
  const mqg004 = result.rules.find((x) => x.ruleId === "MQG004");
  assert.ok(!mqg004);
}

function testBlockedForAwaitInNonAsyncMethod() {
  const code = `
public void ClickSubmit()
{
    await _page.Locator("//button[@id='btnSubmit']").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  assert.strictEqual(result.status, "BLOCKED");
  const mqg004 = result.rules.find((x) => x.ruleId === "MQG004");
  assert.ok(mqg004);
  assert.strictEqual(mqg004.status, "BLOCKED");
}

function testBlockedForEmptyMethodBody() {
  const code = `
public async Task DoWorkAsync()
{
}
`;

  const result = evaluateMethodQuality(code);
  assert.strictEqual(result.status, "BLOCKED");
  const mqg003 = result.rules.find((x) => x.ruleId === "MQG003");
  assert.ok(mqg003);
}

function testWarningForNamingConvention() {
  const code = `
public async Task clickSubmitAsync()
{
    await _page.Locator("#a").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg002 = result.rules.find((x) => x.ruleId === "MQG002");
  assert.ok(mqg002);
  assert.strictEqual(mqg002.status, "WARNING");
}

function testBlockedForDuplicateMethodNames() {
  const code = `
public async Task ClickSubmitAsync()
{
    await _page.Locator("#a").ClickAsync();
}

public async Task ClickSubmitAsync()
{
    await _page.Locator("#b").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg005 = result.rules.find((x) => x.ruleId === "MQG005");
  assert.ok(mqg005);
  assert.strictEqual(mqg005.status, "BLOCKED");
}

function testDuplicateLocatorPropertiesBlockedAndWarning() {
  const code = `
public ILocator Submit => Page.Locator("#btnSubmit");
public ILocator Submit => Page.Locator("#btnSubmit");
public ILocator Submit2 => Page.Locator("#btnSubmit");
`;

  const result = evaluateMethodQuality(code);
  const blocked = result.rules.find((x) => x.ruleId === "MQG008" && x.status === "BLOCKED");
  const warning = result.rules.find((x) => x.ruleId === "MQG008" && x.status === "WARNING");
  assert.ok(blocked);
  assert.ok(warning);
}

function testUnusedGeneratedMethodWarning() {
  const code = `
public async Task ReplayAsync()
{
    await LoginAsync();
}

public async Task LoginAsync()
{
    await _page.Locator("#login").ClickAsync();
}

public async Task SearchAsync()
{
    await _page.Locator("#search").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg009 = result.rules.find((x) => x.ruleId === "MQG009" && x.methodName === "SearchAsync");
  assert.ok(mqg009);
  assert.strictEqual(mqg009.status, "WARNING");
}

function testMissingReturnTypeBlocked() {
  const code = `
public async ClickSubmitAsync()
{
    await _page.Locator("#btnSubmit").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg006 = result.rules.find((x) => x.ruleId === "MQG006");
  assert.ok(mqg006);
  assert.strictEqual(mqg006.status, "BLOCKED");
}

function testTaskConsistencyBlocked() {
  const code = `
public async void ClickSubmitAsync()
{
    await _page.Locator("#btnSubmit").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg007 = result.rules.find((x) => x.ruleId === "MQG007");
  assert.ok(mqg007);
  assert.strictEqual(mqg007.status, "BLOCKED");
}

function testThreadSleepBlocked() {
  const code = `
public async Task WaitAsync()
{
    Thread.Sleep(1000);
    await _page.Locator("#btn").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg010 = result.rules.find((x) => x.ruleId === "MQG010");
  assert.ok(mqg010);
  assert.strictEqual(mqg010.status, "BLOCKED");
}

function testHardcodedUrlWarningOrBlocked() {
  const code = `
public async Task NavigateAsync()
{
    await Page.GotoAsync("https://example.com");
}
`;

  const warningResult = evaluateMethodQuality(code);
  const blockedResult = evaluateMethodQuality(code, { blockHardcodedUrl: true });

  const warningRule = warningResult.rules.find((x) => x.ruleId === "MQG011");
  const blockedRule = blockedResult.rules.find((x) => x.ruleId === "MQG011");
  assert.ok(warningRule);
  assert.ok(blockedRule);
  assert.strictEqual(warningRule.status, "WARNING");
  assert.strictEqual(blockedRule.status, "BLOCKED");
}

function testHardcodedDownloadPathWarningOrBlocked() {
  const code = `
public async Task DownloadAsync()
{
    var filePath = "C:/Users/test/Downloads/report.pdf";
    await _page.Locator("#download").ClickAsync();
}
`;

  const warningResult = evaluateMethodQuality(code);
  const blockedResult = evaluateMethodQuality(code, { blockHardcodedDownloadPath: true });

  const warningRule = warningResult.rules.find((x) => x.ruleId === "MQG012");
  const blockedRule = blockedResult.rules.find((x) => x.ruleId === "MQG012");
  assert.ok(warningRule);
  assert.ok(blockedRule);
  assert.strictEqual(warningRule.status, "WARNING");
  assert.strictEqual(blockedRule.status, "BLOCKED");
}

function testDuplicateActionSequenceWarning() {
  const code = `
public async Task FirstAsync()
{
    await _page.Locator("#a").ClickAsync();
    await _page.Locator("#b").ClickAsync();
}

public async Task SecondAsync()
{
    await _page.Locator("#a").ClickAsync();
    await _page.Locator("#b").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg013 = result.rules.find((x) => x.ruleId === "MQG013");
  assert.ok(mqg013);
  assert.strictEqual(mqg013.status, "WARNING");
}

function testAwaitInStringDoesNotTriggerAsyncMismatch() {
  const code = `
public void ValidateMessage()
{
    string message = "await something";
}
`;

  const result = evaluateMethodQuality(code);
  const mqg004 = result.rules.find((x) => x.ruleId === "MQG004");
  assert.ok(!mqg004);
}

function testUrlInCommentDoesNotTriggerHardcodedUrl() {
  const code = `
public async Task LoginAsync()
{
    // https://example.com
    await _page.Locator("#login").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg011 = result.rules.find((x) => x.ruleId === "MQG011");
  assert.ok(!mqg011);
}

function testThreadSleepInStringDoesNotTriggerBlockedRule() {
  const code = `
public async Task CaptureTextAsync()
{
    var text = "Thread.Sleep";
    await _page.Locator("#status").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg010 = result.rules.find((x) => x.ruleId === "MQG010");
  assert.ok(!mqg010);
}

function testCommentedFakeMethodDoesNotTriggerMalformedSignature() {
  const code = `
// public void FakeMethod()
public async Task RealAsync()
{
    await _page.Locator("#ok").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg006 = result.rules.find((x) => x.ruleId === "MQG006");
  assert.ok(!mqg006);
}

function testValidAsyncTaskMethodRemainsClean() {
  const code = `
public async Task ClickSubmitAsync()
{
    await _page.Locator("#btnSubmit").ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg004 = result.rules.find((x) => x.ruleId === "MQG004");
  const mqg006 = result.rules.find((x) => x.ruleId === "MQG006");
  const mqg007 = result.rules.find((x) => x.ruleId === "MQG007");
  assert.ok(!mqg004);
  assert.ok(!mqg006);
  assert.ok(!mqg007);
}

function testValidPlaywrightGetByRolePatternIsAccepted() {
  const code = `
public async Task LoginAsync()
{
    await _page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const blockedRules = result.rules.filter((x) => x.status === "BLOCKED");
  assert.strictEqual(blockedRules.length, 0);
}

function testPrivateLocatorPropertyPatternIsAccepted() {
  const code = `
private ILocator SubmitButton => _page.Locator("#btnSubmit");

public async Task ClickSubmitAsync()
{
    await SubmitButton.ClickAsync();
}
`;

  const result = evaluateMethodQuality(code);
  const mqg008 = result.rules.find((x) => x.ruleId === "MQG008");
  assert.ok(!mqg008);
}

function runAllTests() {
  testPassForBasicAsyncMethod();
  testBlockedForAwaitInNonAsyncMethod();
  testBlockedForEmptyMethodBody();
  testWarningForNamingConvention();
  testBlockedForDuplicateMethodNames();
  testDuplicateLocatorPropertiesBlockedAndWarning();
  testUnusedGeneratedMethodWarning();
  testMissingReturnTypeBlocked();
  testTaskConsistencyBlocked();
  testThreadSleepBlocked();
  testHardcodedUrlWarningOrBlocked();
  testHardcodedDownloadPathWarningOrBlocked();
  testDuplicateActionSequenceWarning();
  testAwaitInStringDoesNotTriggerAsyncMismatch();
  testUrlInCommentDoesNotTriggerHardcodedUrl();
  testThreadSleepInStringDoesNotTriggerBlockedRule();
  testCommentedFakeMethodDoesNotTriggerMalformedSignature();
  testValidAsyncTaskMethodRemainsClean();
  testValidPlaywrightGetByRolePatternIsAccepted();
  testPrivateLocatorPropertyPatternIsAccepted();
  console.log("MethodQualityGate tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
