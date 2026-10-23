const assert = require("node:assert/strict");
const { test } = require("node:test");
const { findTsHighlights, findCsHighlights, buildTooltip } = require("./highlightLogic.js");
const locator = "//input[@id='target']";
const action = `await page.locator("${locator}").click();`;
const entry = { line: 2, action: "click", locator, strategy: "TARGET_ID", confidence: 0.92, uniqueMatch: true };
const metadata = { analyzedActions: 13, transformedActions: 2, actions: [entry] };
const lines = (value) => value.split(/\r?\n/);
const positions = (m, text) => findTsHighlights(m, lines(text)).map((hit) => hit.line);

test("exact line match uses nonempty locator only, not analyzed count or uniqueness", () => {
  const m = { ...metadata, actions: [entry, { line: 3, uniqueMatch: true, confidence: 1 },
    { line: 4, locator: "", tableDetected: true }, { line: 5, locator: "  " }, null] };
  assert.deepEqual(findTsHighlights(m, lines(`// header\r\n${action}\r\n${action}\r\n${action}\r\n${action}`)), [{ line: 2, entry }]);
});
test("shifted line is verified by locator text", () => {
  assert.deepEqual(positions(metadata, `// inserted\n// header\n${action}`), [3]);
});
test("duplicate locator chooses nearest line; ties choose the earlier line", () => {
  assert.deepEqual(positions(metadata, `${action}\n// stale\n${action}\n${action}`), [1]);
  assert.deepEqual(positions({ actions: [{ ...entry, line: 4 }] }, `${action}\n// gap\n// stale\n// stale\n${action}`), [5]);
  assert.deepEqual(positions(metadata, `${action}\n${action}\n${action}`), [2]);
});
test("no matching locator, invalid metadata, wrong method and changed scope are skipped", () => {
  for (const m of [null, {}, { actions: {} }, { actions: [{ ...entry, line: 0 }] }])
    assert.deepEqual(positions(m, action), []);
  for (const text of [action.replace("target", "other"), action.replace("click", "fill"), `// ${action}`,
    'await page.locator("#other").fill("//input[@id=\'target\']");',
    action.replace('.click()', '.getByText("changed").click()'), `/*\n${action}\n*/`])
    assert.deepEqual(positions(metadata, text), []);
});
test("normalizes syntax whitespace and quote style, not literal text content", () => {
  const equivalent = "await page . locator ( '//input [ @id = \"target\" ]' ) . click ( );";
  assert.deepEqual(positions(metadata, equivalent), [1]);
  const m = { actions: [{ line: 1, locator: '//input[@title="New York"]' }] };
  assert.deepEqual(positions(m, "await page.locator('//input[@title=\"New York\"]').click();"), [1]);
  assert.deepEqual(positions(m, "await page.locator('//input[@title=\"NewYork\"]').click();"), []);
  assert.deepEqual(positions({ actions: [{ line: 1, locator: "#a b" }] }, "await page.locator('#ab').click();"), []);
  assert.deepEqual(positions({ actions: [{ line: 1, locator: ".a .b" }] }, "await page.locator('.a.b').click();"), []);
  assert.deepEqual(positions({ actions: [{ line: 1, locator: ".a .b" }] }, "await page.locator('.a   .b').click();"), [1]);
});
test("merged two-case metadata uses absolute line and never crosses case boundaries", () => {
  const text = `test('TC01 - One', async ({ page }) => {\n${action}\n});\ntest('TC02 - Two', async ({ page }) => {\n${action}\n});`;
  const m = { actions: [{ ...entry, testCaseId: "TC02", sourceLine: 2, line: 5 },
    { line: 2, testCaseId: "TC01", locator: "" }] };
  assert.deepEqual(positions(m, text), [5]);
  assert.deepEqual(positions(m, `// shifted\n${text}`), [6]);
  assert.deepEqual(positions(m, text.replace('TC02 -', 'TC03 -')), []);
});
test("legacy single file, framed selector and escaped quotes", () => {
  assert.deepEqual(positions({ actions: [entry] }, action), [1]);
  const selector = '//a[@title="quoted"]';
  const m = { actions: [{ line: 1, locator: selector }] };
  assert.deepEqual(positions(m, `await page.frameLocator('#frame').locator(${JSON.stringify(selector)}).click();`), [1]);
});
test("CSharp case and legacy markers, ordinary lines and string lookalikes", () => {
  const text = ['await Target.ClickAsync(); // [TLL TC01:L21]',
    'public ILocator X => Page.Locator("#x"); //[TLL TC_02-a:L3]',
    'await Target.ClickAsync(); // [TLL L7]', '//[TLLL8]',
    'await Target.ClickAsync();', 'var text = "// [TLL TC01:L9]";',
    '// [TLL]', '// [TLL L0]', '/*', '// [TLL TC01:L90]', '*/'];
  assert.deepEqual(findCsHighlights(text), [
    { line: 1, caseId: "TC01", sourceLine: 21 }, { line: 2, caseId: "TC_02-a", sourceLine: 3 },
    { line: 3, caseId: null, sourceLine: 7 }, { line: 4, caseId: null, sourceLine: 8 }
  ]);
});
test("tooltip includes provenance fields and visible non-live validation note", () => {
  const tooltip = buildTooltip({ ...entry, testCaseId: "TC01", sourceLine: 21,
    originalLocator: "page.getByText('Add')", strategy: "TABLE_FORCED_LOCATOR", confidence: 0.64 });
  for (const label of ["Case: TC01", "Source line: 21", "Original locator:", "Generated locator:",
    "Strategy:", "Confidence:", "uniqueMatch: true", "NOT LIVE-VALIDATED"]) assert.ok(tooltip.includes(label));
  assert.match(buildTooltip(entry), /Unavailable: not stored/);
  for (const fields of [{ strategy: "FALLBACK" }, { provenance: { liveValidated: false } },
    { confidence: 0.2 }, { uniqueMatch: false }, { provenance: "inferred" }])
    assert.match(buildTooltip({ ...entry, ...fields }), /NOT LIVE-VALIDATED/);
  assert.doesNotMatch(buildTooltip({ ...entry, liveValidated: true }), /NOT LIVE-VALIDATED/);
  assert.match(buildTooltip({ ...entry, liveValidated: true, strategy: "TABLE_FORCED_LOCATOR" }), /NOT LIVE-VALIDATED/);
  assert.match(buildTooltip({ ...entry, liveValidated: true, provenance: { liveValidated: false } }), /NOT LIVE-VALIDATED/);
  assert.doesNotMatch(buildTooltip({ ...entry, originalLocator: "<img src='https://example.test'>" }), /<img/);
});