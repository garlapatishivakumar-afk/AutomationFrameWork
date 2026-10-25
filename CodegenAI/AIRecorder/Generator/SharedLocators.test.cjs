"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { test } = require("node:test");
const { generateCSharpCode, compileGeneratedCSharp } = require("./CSharpCodeGenerator.cjs");
const { buildSprint, mergeCSharp, mergeCSharpWithSharedLocators } = require("./SprintMerger.cjs");
const { extractOriginalLocator, replaceLocatorReferences } = require("./SharedLocators.cjs");

const hash = (text) => createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shared-locators-"));
  const make = (id, body, options = {}, metadata = { actions: [] }) => {
    const folder = path.join(root, id);
    fs.mkdirSync(folder, { recursive: true });
    const codeTs = `import { test, expect } from '@playwright/test';\ntest('recording', async ({ page }) => {\n${body.join("\n")}\n});\n`;
    const codeFilePath = path.join(folder, "Code.ts");
    const reportFilePath = path.join(folder, "CSharpGenerationReport.json");
    fs.writeFileSync(codeFilePath, codeTs);
    fs.writeFileSync(path.join(folder, "TableLocatorMetadata.json"), JSON.stringify(metadata));
    const generated = generateCSharpCode({ codeFilePath, reportFilePath, projectRoot: root,
      outputFilePath: path.join(folder, "Code.cs"), enableRepair: false,
      className: `CodegenFlow${id}`, caseId: id, caseTitle: "Synthetic", ...options });
    assert.equal(generated.validation.success, true, JSON.stringify(generated.validation));
    assert.equal(generated.actionFidelity.success, true);
    assert.equal(fs.readFileSync(codeFilePath, "utf8"), codeTs);
    const report = JSON.parse(fs.readFileSync(reportFilePath, "utf8"));
    assert.equal(typeof report.generatedLocatorProperties, "number", "Keep the legacy count API");
    assert.equal(report.locatorProvenanceVersion, 1);
    assert.deepEqual(report.generatedLocators, generated.generatedLocators);
    return { entry: { id, title: "Synthetic", status: "generated" }, codeTs, codeCs: generated.code, report, metadata };
  };
  try { run({ make, root }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function renamed(item, oldName, name) {
  item.codeCs = item.codeCs.replace(new RegExp(`\\b${oldName}\\b`, "g"), name);
  const locator = item.report.generatedLocators.find((entry) => entry.propertyName === oldName);
  locator.propertyName = name;
  locator.expression = name;
  item.report.generatedCodeHash = hash(item.codeCs);
  return item;
}

const action = (expression) => `await ${expression}.click();`;

function commentFreeLocators(code) {
  assert.match(code, /namespace [\w.]+\n\{\s+public sealed class Locators\b/, "No banner above Locators");
  const section = code.match(/    public sealed class Locators\b[\s\S]*?\n    \}/)?.[0];
  assert.ok(section);
  assert.doesNotMatch(section, /\/\/|\/\*/, "No headings, REVIEW comments or property TLL tags");
  return section;
}

test("provenance is the complete AST source slice, not normalized or a leaf selector", () => {
  const expression = `page.locator( '#scope' ).getByRole('button', { name: 'Go', exact: true }).nth(0)`;
  assert.deepEqual(extractOriginalLocator(`  await ${expression}.click(); // note`), { originalExpression: expression, actor: "page" });
  const commented = `page.locator(/* keep */ '#scope').filter({ hasText: 'Go' }).first()`;
  assert.equal(extractOriginalLocator(action(commented)).originalExpression, commented);
  assert.equal(extractOriginalLocator(`await expect(${expression}).toBeVisible();`).originalExpression, expression);
  assert.equal(extractOriginalLocator("await page1.locator('#x').fill('value');").actor, "page1");
  for (const raw of ["await page.goto('url');", "await page.waitForSelector('#x');", "await page.keyboard.press('A');", "broken(", "await page.locator('#x').click(); other();"])
    assert.equal(extractOriginalLocator(raw), null);
});

test("exact selectors share above per-case classes in both render paths and retain ReplayAsync", () => fixture(({ make }) => {
  for (const enterpriseMode of [false, true]) {
    const cases = ["TC01", "TC02"].map((id) => make(id, [action("page.locator('#target')")], { enterpriseMode }));
    const original = JSON.stringify(cases);
    const result = buildSprint("Synthetic", cases, "fixed");
    assert.deepEqual(result.errors, []);
    commentFreeLocators(result.codeCs);
    assert.equal(result.report.sharedLocators.sharedCount, 1);
    assert.equal(result.report.sharedLocators.replacedPropertyCount, 2);
    assert.ok(result.codeCs.indexOf("class Locators") < result.codeCs.indexOf("class TestCaseTC01"));
    assert.equal((result.codeCs.match(/public ILocator Target =>/g) || []).length, 1);
    assert.equal((result.codeCs.match(/new Locators\(Page\)/g) || []).length, 2);
    assert.equal((result.codeCs.match(/await _locators.Target.ClickAsync\(\)/g) || []).length, 2);
    assert.equal((result.codeCs.match(/public async Task ReplayAsync\(\)/g) || []).length, 2);
    assert.equal(JSON.stringify(cases), original, "Do not mutate validated drafts, reports or source");
    assert.equal(mergeCSharp(cases), mergeCSharpWithSharedLocators(cases).code);
    assert.deepEqual(result.report.sharedLocators.shared[0].references.map((ref) => ref.actionSourceLines), [[3], [3]]);
  }
}));

test("different names for one exact expression become one shared property", () => fixture(({ make }) => {
  const unique = renamed(make("TC00", [action("page.locator('#other')")]), "Other", "Target");
  const first = make("TC01", [action("page.locator('#target')")]);
  const second = renamed(make("TC02", [action("page.locator('#target')")]), "Target", "AlternateTarget");
  const result = buildSprint("Synthetic", [unique, first, second]);
  assert.equal(result.report.sharedLocators.sharedCount, 1);
  assert.equal(result.report.sharedLocators.shared[0].propertyName, "Target");
  assert.equal(result.report.sharedLocators.shared[0].emittedPropertyName, "Target");
  assert.deepEqual(result.report.sharedLocators.shared[0].references.map((ref) => ref.propertyName), ["Target", "AlternateTarget"]);
  assert.deepEqual(result.report.sharedLocators.shared[0].references.map((ref) => ref.emittedPropertyName), ["Target", "Target"]);
  assert.doesNotMatch(result.codeCs, /AlternateTarget/);
  assert.equal((result.codeCs.match(/_locators.Target.ClickAsync/g) || []).length, 2);
  assert.match(result.codeCs, /_locators.Target_TC00_page.ClickAsync/);
  const reversed = buildSprint("Synthetic", [unique, second, first]);
  assert.equal(reversed.report.sharedLocators.shared[0].emittedPropertyName, "AlternateTarget", "First existing name in case/property order wins");
  assert.equal(buildSprint("Synthetic", [unique, first, second]).codeCs, result.codeCs);
}));

test("options, quotes, casing, whitespace and complete chaining must match character-for-character", () => fixture(({ make }) => {
  const pairs = [
    ["page.locator('#target')", "page.locator('#other')"],
    ["page.locator('#target')", "page.locator('#Target')"],
    ["page.locator('#target')", 'page.locator("#target")'],
    ["page.getByRole('button', { name: 'Go' })", "page.getByRole('button', {  name: 'Go' })"],
    ["page.getByRole('button', { name: 'Go' })", "page.getByRole('button', { name: 'Go', exact: false })"],
    ["page.getByRole('button', { name: 'Go', exact: true })", "page.getByRole('button', { name: 'Go', exact: false })"],
    ["page.getByText('New York')", "page.getByText('New  York')"],
    ["page.locator('#target').first()", "page.locator('#target').nth(0)"],
    ["page.locator('#scopeA').getByText('Go')", "page.locator('#scopeB').getByText('Go')"],
    ["page.frameLocator('#a').locator('#target')", "page.frameLocator('#b').locator('#target')"],
    ["page.frameLocator('#a').getByRole('button', { name: 'Go', exact: true })", "page.frameLocator('#a').getByRole('button', { exact: true, name: 'Go' })"],
    ["page.frameLocator('#a').locator('#target')", "page.frameLocator( '#a' ).locator('#target')"]
  ];
  for (const [left, right] of pairs) {
    const cases = [make("TC01", [action(left)]), make("TC02", [action(right)])];
    const result = buildSprint("Synthetic", cases);
    assert.deepEqual(result.errors, [], `${left} vs ${right}`);
    assert.equal(result.report.sharedLocators.sharedCount, 0, `${left} vs ${right}`);
    assert.equal((result.codeCs.match(/class Locators\b/g) || []).length, 1);
    assert.equal((result.codeCs.match(/public ILocator /g) || []).length, 2, "Different raw selectors remain separate globally");
    assert.equal(cases[0].report.generatedLocators[0].originalExpression, left);
    assert.equal(cases[1].report.generatedLocators[0].originalExpression, right);
    const triple = buildSprint("Synthetic", [...cases, make("TC03", [action(left)])]);
    assert.deepEqual(triple.errors, []);
    assert.equal(triple.report.sharedLocators.sharedCount, 1, "Only the exact raw pair may share, regardless of a third name collision");
    assert.equal(triple.report.sharedLocators.replacedPropertyCount, 2);
    assert.equal(triple.report.sharedLocators.shared[0].originalExpression, left);
    assert.deepEqual(triple.report.sharedLocators.shared[0].caseIds, ["TC01", "TC03"]);
    assert.equal((triple.codeCs.match(/public ILocator /g) || []).length, 2);
  }
}));

test("local C# dedup does not lose raw distinctions or share a partially matching property", () => fixture(({ make }) => {
  const a = "page.getByRole('button', { name: 'Go' })";
  const b = "page.getByRole('button', { name: 'Go', exact: false })";
  const first = make("TC01", [action(a), action(b), action(a)]);
  const properties = first.report.generatedLocators;
  assert.equal(properties.length, 2);
  assert.equal(properties[0].locatorExpression, properties[1].locatorExpression);
  assert.deepEqual(properties.map((item) => item.originalExpression), [a, b]);
  assert.deepEqual(properties.map((item) => item.actionSourceLines), [[3, 5], [4]]);
  const result = buildSprint("Synthetic", [first, make("TC02", [action(a)])]);
  assert.equal(result.report.sharedLocators.sharedCount, 1);
  assert.equal(result.report.sharedLocators.shared[0].originalExpression, a);
  assert.match(result.codeCs, /public ILocator Go2 =>/);
  assert.match(result.codeCs, /await _locators.Go2.ClickAsync/);
  assert.equal((result.codeCs.match(/await _locators.Go.ClickAsync/g) || []).length, 3);
  assert.equal(buildSprint("Synthetic", [first]).report.sharedLocators.sharedCount, 0, "Repetition in one case is insufficient");
}));

test("an exact Deals pair shares its plain name while a third Exact=true definition is suffixed", () => fixture(({ make }) => {
  const cases = [make("95063", [action("page.getByRole('link', { name: 'Deals' })")]),
    make("95064", [action("page.getByRole('link', { name: 'Deals' })")]),
    make("95065", [action("page.getByRole('link', { name: 'Deals', exact: true })")])];
  const result = buildSprint("Synthetic", cases);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 1);
  assert.equal(result.report.sharedLocators.replacedPropertyCount, 2);
  const shared = result.report.sharedLocators.shared[0];
  assert.equal(shared.propertyName, "Deals");
  assert.equal(shared.emittedPropertyName, "Deals");
  assert.deepEqual(shared.caseIds, ["95063", "95064"]);
  assert.deepEqual(shared.references.map((ref) => ref.propertyName), ["Deals", "Deals"]);
  assert.deepEqual(shared.references.map((ref) => ref.emittedPropertyName), ["Deals", "Deals"]);
  assert.equal(result.report.sharedLocators.conflicts.length, 1);
  assert.equal(result.report.sharedLocators.conflicts[0].references.length, 3);
  assert.equal(result.report.reviewRequired, true);
  assert.equal(result.report.codeGenerationBlocked, false);
  for (const entry of result.report.cases) {
    assert.equal(entry.reviewRequired, true);
    const issue = entry.issues.find((issue) => issue.ruleId === "SL001");
    assert.match(issue.message, /different original TS expressions; distinct expressions retained in Locators/);
  }
  const names = ["Deals", "Deals", "Deals_95065_page"];
  const locators = commentFreeLocators(result.codeCs);
  assert.deepEqual(locators.split("\n").filter((line) => line.includes("public ILocator")).map((line) => line.trim()), [
    'public ILocator Deals => Page.GetByRole(AriaRole.Link, new() { Name = "Deals" });',
    'public ILocator Deals_95065_page => Page.GetByRole(AriaRole.Link, new() { Name = "Deals", Exact = true });'
  ]);
  assert.doesNotMatch(locators, /public ILocator[^\n]+\n\s*\n\s*public ILocator/);
  assert.doesNotMatch(result.codeCs.slice(result.codeCs.indexOf("class TestCase95063")), /public ILocator/);
  for (const [index, name] of names.entries()) {
    const start = result.codeCs.indexOf(`class TestCase${cases[index].entry.id}`);
    const end = index + 1 < cases.length ? result.codeCs.indexOf(`class TestCase${cases[index + 1].entry.id}`) : result.codeCs.length;
    const calls = [...result.codeCs.slice(start, end).matchAll(/_locators\.(Deals(?:_95065_page)?)\.ClickAsync/g)];
    assert.deepEqual(calls.map((match) => match[1]), [name]);
    assert.ok(result.codeCs.includes(`// TEST CASE ${cases[index].entry.id}\n    // ===`));
  }
  const references = result.report.sharedLocators.conflicts[0].references;
  assert.deepEqual(references.map((ref) => ref.propertyName), ["Deals", "Deals", "Deals"]);
  assert.deepEqual(references.map((ref) => ref.emittedPropertyName), names);
  assert.equal(buildSprint("Synthetic", cases).codeCs, result.codeCs, "Suffix names are deterministic across repeated merges");
  assert.equal((result.codeCs.match(/REVIEW REQUIRED/g) || []).length, 3);
}));

test("independent exact groups with the same base name each share without duplicate properties", () => fixture(({ make }) => {
  const cases = ["TC01", "TC02", "TC03", "TC04"].map((id, index) => make(id, [
    action(index < 2 ? "page.getByText('Go')" : "page.getByText('Go', { exact: true })")
  ]));
  const result = buildSprint("Synthetic", cases);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 2);
  assert.equal(result.report.sharedLocators.replacedPropertyCount, 4);
  assert.deepEqual(result.report.sharedLocators.shared.map((group) => group.emittedPropertyName), ["Go", "Go2"]);
  assert.equal((result.codeCs.match(/public ILocator /g) || []).length, 2);
  assert.equal((result.codeCs.match(/_locators.Go.ClickAsync/g) || []).length, 2);
  assert.equal((result.codeCs.match(/_locators.Go2.ClickAsync/g) || []).length, 2);
  assert.equal(buildSprint("Synthetic", cases).codeCs, result.codeCs);
}));

test("a shared main-page expression never absorbs the same selector on a popup actor", () => fixture(({ make }) => {
  const main = "page.getByRole('link', { name: 'Deals' })";
  const popup = "page1.getByRole('link', { name: 'Deals' })";
  const cases = [make("95063", [action(main)]), make("95064", [action(main)]), make("95065", [
    "const page1Promise = page.waitForEvent('popup');", action("page.locator('#open')"),
    "const page1 = await page1Promise;", action(popup)
  ])];
  const result = buildSprint("Synthetic", cases);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 1);
  assert.deepEqual(result.report.sharedLocators.shared[0].caseIds, ["95063", "95064"]);
  assert.equal((result.codeCs.match(/public ILocator Deals =>/g) || []).length, 1);
  assert.match(result.codeCs, /public ILocator Deals_95065_page1 =>/);
  assert.match(result.codeCs, /await _page1Locators.Deals_95065_page1.ClickAsync/);
  assert.ok(result.report.sharedLocators.skipped.some((item) => item.testCaseId === "95065" && item.reason === "non-main-page-actor"));
}));

test("popup actors never share; main-page locators in popup flows can share", () => fixture(({ make }) => {
  for (const enterpriseMode of [false, true]) {
    const body = ["const page1Promise = page.waitForEvent('popup');", action("page.locator('#open')"),
      "const page1 = await page1Promise;", "await page1.locator('#target').fill('synthetic');"];
    const result = buildSprint("Synthetic", [make("TC01", body, { enterpriseMode }), make("TC02", body, { enterpriseMode })]);
    assert.equal(result.report.sharedLocators.sharedCount, 1);
    assert.equal(result.report.sharedLocators.shared[0].propertyName, "Open");
    assert.deepEqual(result.errors, []);
    assert.equal((result.codeCs.match(/public ILocator Target_TC\d+_page1 => Page\./g) || []).length, 2);
    assert.equal((result.codeCs.match(/_page1 = await page1Promise;\n\s+_page1Locators = new Locators\(_page1\);/g) || []).length, 2);
    assert.equal(result.report.sharedLocators.skipped.filter((item) => item.reason === "non-main-page-actor").length, 2);
  }
}));

test("reference replacement is token-aware and leaves strings, comments, member calls and longer names intact", () => {
  const untouched = [
    String.raw`var text = "Target.ClickAsync() \"quoted\""; // Target.ClickAsync()`,
    'var verbatim = @"Target.ClickAsync() ""Target""";',
    "/* Target.ClickAsync(); */", "// Target.ClickAsync();", "await Target2.ClickAsync();",
    "await other.Target();", "await other.Target.ClickAsync();", "public ILocator Target => Page.Locator(\"Target\");"
  ];
  const source = [...untouched, "await Target.ClickAsync();", "await this.Target.ClickAsync();",
    "await FillInputAsync(Target, value);", "await Assertions.Expect(Target).ToBeVisibleAsync();"].join("\n");
  const result = replaceLocatorReferences(source, new Map([["Target", "SharedTarget"]]), "_sharedLocators");
  for (const line of untouched) assert.ok(result.includes(line), line);
  assert.match(result, /await _sharedLocators.SharedTarget.ClickAsync/);
  assert.match(result, /await this._sharedLocators.SharedTarget.ClickAsync/);
  assert.match(result, /FillInputAsync\(_sharedLocators.SharedTarget, value\)/);
  assert.match(result, /Expect\(_sharedLocators.SharedTarget\)/);
});

test("legacy, missing, stale and inconsistent provenance consolidate without cross-sharing", () => fixture(({ make }) => {
  const changes = [
    (report) => { delete report.locatorProvenanceVersion; },
    (report) => { delete report.generatedLocators; },
    (report) => { delete report.generatedLocators[0].originalExpression; },
    (report) => { report.generatedLocators[0].originalExpression = "page.locator('#stale')"; },
    (report) => { report.generatedLocators[0].actionSourceLines = [999]; },
    (report) => { report.generatedLocators[0].locatorExpression = 'Page.Locator("#other")'; },
    (report) => { report.generatedLocators.push({ ...report.generatedLocators[0] }); }
  ];
  for (const change of changes) {
    const cases = [make("TC01", [action("page.locator('#target')")]), make("TC02", [action("page.locator('#target')")])];
    change(cases[1].report);
    const result = buildSprint("Synthetic", cases);
    assert.deepEqual(result.errors, []);
    assert.equal(result.report.sharedLocators.sharedCount, 0);
    assert.equal((result.codeCs.match(/public ILocator Target_TC\d+_page =>/g) || []).length, 2);
  }
}));

test("different generated expressions for the same raw source are never overwritten", () => fixture(({ make }) => {
  const first = make("TC01", [action("page.locator('#target')")]);
  const second = make("TC02", [action("page.locator('#target')")]);
  // Model a validated case-specific repair. Original TS remains byte-identical.
  second.codeCs = second.codeCs.replace('Page.Locator("#target")', 'Page.Locator("#repaired")');
  second.report.generatedLocators[0].locatorExpression = 'Page.Locator("#repaired")';
  second.report.generatedCodeHash = hash(second.codeCs);
  const result = buildSprint("Synthetic", [first, second]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 0);
  assert.equal(result.report.sharedLocators.skipped.filter((item) => item.reason === "different-generated-expression").length, 2);
  assert.match(result.codeCs, /Page.Locator\("#target"\)/);
  assert.match(result.codeCs, /Page.Locator\("#repaired"\)/);
}));

test("suffix and shared-field collisions do not create duplicate names or alter literals", () => fixture(({ make }) => {
  const first = make("TC01", [action("page.locator('#target')"), action('page.locator("#target")'), action("page.locator('#target2')")]);
  const names = first.report.generatedLocators.map((item) => item.propertyName);
  assert.equal(new Set(names).size, names.length);
  const second = make("TC02", [action("page.locator('#target')")]);
  const extra = String.raw`        private readonly string _locators = "Target.ClickAsync()";
        // Target.ClickAsync() should not change
        /* Target.ClickAsync() should not change */
`;
  first.codeCs = first.codeCs.replace("        public CodegenFlowTC01", extra + "        public CodegenFlowTC01");
  first.report.generatedCodeHash = hash(first.codeCs);
  const result = buildSprint("Synthetic", [first, second]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 1);
  assert.ok(result.codeCs.includes(extra));
  assert.match(result.codeCs, /private readonly Locators _locators2;/);
  assert.match(result.codeCs, /await _locators2.Target.ClickAsync/);
}));

test("draft hashes are checked before sharing and excluded cases never contribute", () => fixture(({ make }) => {
  const first = make("TC01", [action("page.locator('#target')")]);
  const second = make("TC02", [action("page.locator('#target')")]);
  second.codeCs += "\n// edited draft";
  const changed = buildSprint("Synthetic", [first, second]);
  assert.match(changed.errors[0], /differs from the validated draft/);
  assert.equal(changed.report.sharedLocators.sharedCount, 0);
  assert.deepEqual(changed.report.cases.map((item) => item.included), [true, false]);
  second.codeCs = second.codeCs.replace("\n// edited draft", "");
  for (const status of ["planned", "skipped", "failed: generation blocked"]) {
    second.entry.status = status;
    assert.equal(buildSprint("Synthetic", [first, second]).report.sharedLocators.sharedCount, 0);
  }
  assert.equal(buildSprint("Empty", []).report.sharedLocators.sharedCount, 0);
}));

test("comment-free shared properties preserve review policy, action TLL origins and merged TS line mappings", () => fixture(({ make }) => {
  const metadata = { analyzedActions: 2, transformedActions: 2,
    actions: [{ line: 3, locator: "#target" }, { line: 4, locator: "#target" }] };
  const first = make("TC01", [action("page.locator('#target')"), "await page.locator('#target').fill('value');"], {}, metadata);
  const second = make("TC02", [action("page.locator('#target')"), "await page.locator('#target').fill('value');"], {}, metadata);
  first.report.reviewRequired = true;
  first.report.recordingIssues = [{ severity: "warning", kind: "suspiciousNavigation", sourceLine: 3, message: "Synthetic review" }];
  const before = JSON.stringify([first, second]);
  const result = buildSprint("Synthetic", [first, second]);
  assert.equal(JSON.stringify([first, second]), before, "Draft properties, reports and metadata remain untouched");
  commentFreeLocators(result.codeCs);
  assert.match(result.codeCs, /\/\/ REVIEW REQUIRED:[^\n]*\n    public sealed class TestCaseTC01/);
  assert.equal(result.report.reviewRequired, true);
  assert.equal(result.report.cases[0].reviewRequired, true);
  assert.equal(result.report.cases[1].reviewRequired, second.report.reviewRequired);
  assert.equal(result.report.codeGenerationBlocked, false);
  for (const id of ["TC01", "TC02"]) {
    assert.ok(result.codeCs.includes(`await _locators.Target.ClickAsync(); // [TLL ${id}:L3]`));
    assert.ok(result.codeCs.includes(`await _locators.Target.FillAsync("value"); // [TLL ${id}:L4]`));
  }
  assert.deepEqual(result.report.sharedLocators.shared[0].references.map((ref) => ref.tllSourceLines), [[3, 4], [3, 4]]);
  const { findCsHighlights } = require("../Extension/TllHighlighter/highlightLogic.js");
  const highlights = findCsHighlights(result.codeCs.split("\n"));
  for (const id of ["TC01", "TC02"]) {
    for (const line of [3, 4]) assert.ok(highlights.some((entry) => entry.caseId === id && entry.sourceLine === line));
  }
  for (const entry of result.metadata.actions) {
    assert.ok(result.codeTs.split("\n")[entry.line - 1].includes("page.locator('#target')"));
    assert.equal(entry.sourceLine, entry.relativeLine + 1);
  }
  assert.doesNotMatch(result.codeTs, /\[TLL/);
}));

test("merged shared flow compiles against the real framework without executing it", () => fixture(({ make, root }) => {
  const body = [action("page.locator('#target')"), "await expect(page.locator('#target')).toBeVisible();",
    action("page.locator('#shared-locators')")];
  const cases = [make("TC01", body), make("TC02", body, { enterpriseMode: true })];
  const popupBody = ["const page1Promise = page.waitForEvent('popup');", action("page.locator('#open')"),
    "const page1 = await page1Promise;", "await page1.locator('#popup-target').fill('synthetic');",
    action("page.locator('#target')")];
  cases.push(make("TC03", popupBody), make("TC04", popupBody, { enterpriseMode: true }));
  const result = buildSprint("Synthetic", cases);
  assert.deepEqual(result.errors, []);
  assert.equal(result.report.sharedLocators.sharedCount, 3);
  assert.match(result.codeCs, /public ILocator SharedLocators2 =>/);
  const compilation = compileGeneratedCSharp(result.codeCs, { projectRoot: path.resolve(__dirname, "../../.."), codeFilePath: path.join(root, "Code.ts") });
  assert.equal(compilation.success, true, JSON.stringify(compilation));
}));