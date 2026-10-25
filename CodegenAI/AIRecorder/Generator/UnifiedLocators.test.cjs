"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { buildSprint, mergeCSharp, mergeCSharpWithSharedLocators } = require("./SprintMerger.cjs");
const { compileGeneratedCSharp, generateCSharpCode } = require("./CSharpCodeGenerator.cjs");
const { maskCSharp } = require("./SharedLocators.cjs");

// Intentionally legacy reports: declaration expressions, not invented TS
// provenance, must be enough to consolidate WITHOUT sharing across cases.
function legacy(id) {
  return {
    entry: { id, title: "Synthetic popup scope", status: "generated" },
    codeTs: "import { test } from '@playwright/test';\ntest('test', async ({ page }) => {\n  await page.locator('#open').click();\n});\n",
    report: { className: `CodegenFlow${id}`, validation: { success: true }, reviewRequired: true,
      recordingIssues: [{ severity: "warning", kind: "synthetic", sourceLine: 3, message: "Keep review" }] },
    metadata: { actions: [] },
    codeCs: `using System;
using System.Threading.Tasks;
using Microsoft.Playwright;
using AutomationFrameWork.Utilities;
namespace AutomationFrameWork.CodegenAI
{
    public sealed class CodegenFlow${id}
    {
        private IPage _page1 = default!;
        private IPage _page2 = default!;
        public CodegenFlow${id}(IPage page, ConfigReader config)
        {
            Page = page ?? throw new ArgumentNullException(nameof(page));
            Config = config ?? throw new ArgumentNullException(nameof(config));
        }
        public IPage Page { get; }
        public ConfigReader Config { get; }
        // Locators
        public ILocator Open => Page.Locator("#open");
        // REVIEW: keep popup selector evidence
        // [TLL ${id}:L3]
        public ILocator Value =>
            _page1.GetByRole(AriaRole.Textbox, new() { Name = "Value; { literal }", Exact = true }); // [TLL ${id}:L3]
        public ILocator Value2 => _page2.Locator("#value");

        public async Task ReplayAsync()
        {
            var page1Promise = Page.WaitForPopupAsync();
            await Open.ClickAsync();
            _page1 = await page1Promise;
            await _page1.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            await Value.WaitForAsync(new() { State = WaitForSelectorState.Visible }); // [TLL ${id}:L3]
            await Value.FillAsync("first");
            var page2Promise = Page.WaitForPopupAsync();
            await Open.ClickAsync();
            _page2 = await page2Promise;
            await Value2.FillAsync("second");
            await Value.FillAsync("first-again");
            await UpdateAsync(_page1, "third");
            await UpdateSecondAsync(_page2);
            await BothAsync(_page1, _page2);
            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        }
        public async Task UpdateAsync(IPage popupPage, string value)
        {
            // Value.FillAsync and CodegenFlow${id} are comments, not references.
            await this.Value.FillAsync(value);
            await Assertions.Expect(Value).ToHaveValueAsync(value);
            await popupPage.WaitForLoadStateAsync(LoadState.NetworkIdle);
        }
        public async Task UpdateSecondAsync(IPage popupPage)
        {
            await Value2.FillAsync("second-parameter");
        }
        public async Task BothAsync(IPage page1, IPage page2)
        {
            await Value.FillAsync("left");
            await Value2.FillAsync("right");
        }
    }
}
`
  };
}

function method(code, name) {
  const mask = maskCSharp(code);
  const start = mask.indexOf(`public async Task ${name}(`);
  assert.notEqual(start, -1);
  const open = mask.indexOf("{", start);
  let depth = 1, end = open + 1;
  for (; depth && end < mask.length; end++) {
    if (mask[end] === "{") depth++;
    if (mask[end] === "}") depth--;
  }
  return code.slice(open + 1, end - 1);
}

function originalStatements(body) {
  return body.split("\n").filter((line) => !line.includes("= new Locators("))
    .map((line) => line.replace(/\b(?:_locators|_page\d+Locators|popupLocators\d*|page\d+Locators)\./g, "")
      .replace(/_(?:95063|95064)_page\d*\b/g, "").replace(/\bthis\./g, "").trim())
    .filter(Boolean);
}

function commentFreeLocators(code) {
  assert.match(code, /namespace [\w.]+\n\{\s+public sealed class Locators\b/, "No banner above Locators");
  const section = code.match(/    public sealed class Locators\b[\s\S]*?\n    \}/)?.[0];
  assert.ok(section);
  assert.doesNotMatch(section, /\/\/|\/\*/, "No headings, REVIEW comments or property TLL tags");
  return section;
}

test("one namespace-top Locators with single-line properties; TestCase classes and reports; no draft mutations", () => {
  const cases = [legacy("95063"), legacy("95064")];
  const before = JSON.stringify(cases);
  const result = buildSprint("Unified", cases, "fixed");
  assert.deepEqual(result.errors, []);
  assert.equal(JSON.stringify(cases), before);
  assert.equal((result.codeCs.match(/public sealed class Locators\b/g) || []).length, 1);
  assert.equal((result.codeCs.match(/public ILocator \w+ => Page\./g) || []).length, 6);
  const locators = commentFreeLocators(result.codeCs);
  assert.deepEqual(locators.split("\n").filter((line) => line.includes("public ILocator")).map((line) => line.trim()),
    ["95063", "95064"].flatMap((id) => [
      `public ILocator Open_${id}_page => Page.Locator("#open");`,
      `public ILocator Value_${id}_page1 => Page.GetByRole(AriaRole.Textbox, new() { Name = "Value; { literal }", Exact = true });`,
      `public ILocator Value2_${id}_page2 => Page.Locator("#value");`
    ]), "Single-line declarations retain their exact order, names and selectors");
  assert.doesNotMatch(result.codeCs, /public ILocator \w+ =>\s*\n/);
  assert.doesNotMatch(result.codeCs, /public ILocator[^\n]+\n[ \t]*\n[ \t]*public ILocator/);
  assert.doesNotMatch(result.codeCs.slice(result.codeCs.indexOf("public sealed class TestCase")), /public ILocator/);
  assert.equal(result.report.sharedLocators.sharedCount, 0, "Legacy expressions must not cross-share");
  assert.deepEqual(result.report.cases.map((c) => c.className), ["TestCase95063", "TestCase95064"]);
  assert.deepEqual(result.report.cases.map((c) => c.internalClassName), ["CodegenFlow95063", "CodegenFlow95064"]);
  assert.equal((result.codeCs.match(/\/\/ REVIEW REQUIRED:/g) || []).length, 2);
  assert.match(result.codeCs, /\/\/ REVIEW REQUIRED:[^\n]*\n    public sealed class TestCase95063/);
  assert.ok(result.report.cases.every((c) => c.reviewRequired));
  for (const id of ["95063", "95064"]) {
    assert.ok(result.codeCs.includes(`// TEST CASE ${id}\n    // ===`));
    assert.ok(result.codeCs.includes(`public TestCase${id}(IPage page, ConfigReader config)`));
    assert.ok(result.codeCs.includes(`// Value.FillAsync and CodegenFlow${id} are comments, not references.`));
    assert.ok(result.codeCs.includes(`await _page1Locators.Value_${id}_page1.WaitForAsync(new() { State = WaitForSelectorState.Visible }); // [TLL ${id}:L3]`));
  }
  assert.match(result.codeCs, /Page = page[^\n]+\n\s+_locators = new Locators\(Page\);/);
  assert.equal(mergeCSharp(cases), mergeCSharpWithSharedLocators(cases).code);
  assert.equal(mergeCSharp(cases), mergeCSharp(cases), "Deterministic names/order");
});

test("multiple popup assignments bind immediately; later use of the first popup stays isolated", () => {
  const result = buildSprint("Unified", [legacy("95063"), legacy("95064")]);
  assert.deepEqual(result.errors, []);
  const replay = method(result.codeCs, "ReplayAsync");
  for (const actor of ["page1", "page2"]) {
    assert.match(replay, new RegExp(`_${actor} = await ${actor}Promise;\\n\\s+_${actor}Locators = new Locators\\(_${actor}\\);`));
  }
  assert.match(replay, /_page1Locators.Value_95063_page1.FillAsync\("first-again"\)/);
  assert.match(replay, /_page2Locators.Value2_95063_page2.FillAsync\("second"\)/);
  assert.doesNotMatch(replay, /_page2Locators.Value_95063_page1|_page1Locators.Value2_95063_page2/);
  for (const name of ["ReplayAsync", "UpdateAsync", "UpdateSecondAsync", "BothAsync"]) {
    assert.deepEqual(originalStatements(method(result.codeCs, name)), originalStatements(method(legacy("95063").codeCs, name)),
      `${name}: ordered statements, waits, values and comments unchanged except locator bindings`);
  }
});

test("popup methods honor actual parameters rather than stale fields, including two distinct parameters", () => {
  const result = buildSprint("Unified", [legacy("95063"), legacy("95064")]);
  assert.deepEqual(result.errors, []);
  const update = method(result.codeCs, "UpdateAsync");
  assert.match(update, /^\s*var popupLocators = new Locators\(popupPage\);/);
  assert.match(update, /await popupLocators.Value_95063_page1.FillAsync\(value\)/);
  assert.match(update, /Expect\(popupLocators.Value_95063_page1\)/);
  assert.doesNotMatch(update, /this\.popupLocators|_page1Locators/);
  const second = method(result.codeCs, "UpdateSecondAsync");
  assert.match(second, /^\s*var popupLocators\d* = new Locators\(popupPage\);/);
  assert.match(second, /popupLocators\d*.Value2_95063_page2.FillAsync/);
  const both = method(result.codeCs, "BothAsync");
  assert.match(both, /var page1Locators = new Locators\(page1\)/);
  assert.match(both, /var page2Locators = new Locators\(page2\)/);
  assert.match(both, /page1Locators.Value_95063_page1.FillAsync\("left"\)/);
  assert.match(both, /page2Locators.Value2_95063_page2.FillAsync\("right"\)/);
});

test("broken/unsupported declarations and ambiguous popup parameters fail safe rather than omitting code", () => {
  const mutations = [
    (s) => s.replace('public ILocator Open => Page.Locator("#open");', 'public ILocator Open => Page.Locator("#open")'),
    (s) => s.replace('public ILocator Open => Page.Locator("#open");', 'public ILocator Open { get { return Page.Locator("#open"); } }'),
    (s) => s.replace('Page.Locator("#open")', 'Unknown.Locator("#open")'),
    (s) => s.replace("BothAsync(IPage page1, IPage page2)", "BothAsync(IPage popupPage, IPage otherPopup)"),
    (s) => s.replace("_page2 = await page2Promise;", "// Missing assignment"),
    (s) => s.replace("_page2 = await page2Promise;", 'await Value2.FillAsync("too early");\n            _page2 = await page2Promise;'),
    (s) => s.replace("_page2 = await page2Promise;", "if (true)\n                _page2 = await page2Promise;"),
    (s) => s.replace("Page = page ?? throw new ArgumentNullException(nameof(page));", "Page = page;")
  ];
  for (const mutate of mutations) {
    const bad = legacy("95064");
    bad.codeCs = mutate(bad.codeCs);
    assert.throws(() => mergeCSharp([bad]));
    const result = buildSprint("Unified", [legacy("95063"), bad]);
    assert.equal(result.errors.length, 1);
    assert.deepEqual(result.report.cases.map((c) => c.included), [true, false]);
    assert.equal(result.report.codeGenerationBlocked, true);
    assert.match(result.codeCs, /class TestCase95063/);
    assert.doesNotMatch(result.codeCs, /class TestCase95064/);
  }
});

test("property comments are omitted while assignment and action TLL highlights remain", () => {
  const item = legacy("95063");
  item.codeCs = item.codeCs.replace("_page1 = await page1Promise;", "_page1 = await page1Promise; // [TLL 95063:L3]");
  const result = buildSprint("Unified", [item]);
  assert.deepEqual(result.errors, []);
  assert.match(result.codeCs, /_page1 = await page1Promise; \/\/ \[TLL 95063:L3\]\n\s+_page1Locators = new Locators\(_page1\);/);
  commentFreeLocators(result.codeCs);
  assert.match(result.codeCs, /await _page1Locators.Value.WaitForAsync\([^\n]+; \/\/ \[TLL 95063:L3\]/);
  const { findCsHighlights } = require("../Extension/TllHighlighter/highlightLogic.js");
  const lines = result.codeCs.split("\n");
  const highlights = findCsHighlights(lines);
  assert.equal(highlights.length, 2, "Only the assignment and wait action retain markers");
  assert.ok(highlights.every((entry) => entry.caseId === "95063" && entry.sourceLine === 3));
});

test("reserved names and case/actor suffixes cannot steal another property's name", () => {
  const cases = [legacy("95063"), legacy("95064")];
  for (const item of cases) {
    item.codeCs = item.codeCs.replace(/\bOpen\b/g, "Locators");
    item.codeCs = item.codeCs.replace("        public ILocator Value2", '        public ILocator Value_95063_page1 => Page.Locator("#suffix-owner");\n        public ILocator Value2');
  }
  const result = buildSprint("Unified", cases);
  assert.deepEqual(result.errors, []);
  const names = [...result.codeCs.matchAll(/public ILocator (\w+) =>/g)].map((m) => m[1]);
  assert.equal(names.length, 8);
  assert.equal(new Set(names).size, 8);
  assert.ok(!names.includes("Locators") && !names.includes("Page"));
  assert.ok(names.includes("Value_95063_page1_2"));
  assert.match(result.codeCs, /await _locators.Locators_95063_page.ClickAsync/);
  assert.match(result.codeCs, /await _page1Locators.Value_95063_page1_2.FillAsync/);
});

test("real generator multi-popup drafts keep actors and exact source separate in both render modes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "unified-generator-"));
  try {
    for (const enterpriseMode of [false, true]) {
      const cases = ["95063", "95064"].map((id) => {
        const folder = path.join(root, id);
        fs.mkdirSync(folder, { recursive: true });
        const codeTs = `import { test } from '@playwright/test';
test('test', async ({ page }) => {
  const page1Promise = page.waitForEvent('popup');
  await page.locator('#open').click();
  const page1 = await page1Promise;
  await page1.locator('#value').fill('first');
  const page2Promise = page.waitForEvent('popup');
  await page.locator('#open').click();
  const page2 = await page2Promise;
  await page2.locator('#value').fill('second');
  await page1.locator('#value').click();
});\n`;
        const codeFilePath = path.join(folder, "Code.ts"), reportFilePath = path.join(folder, "CSharpGenerationReport.json");
        fs.writeFileSync(codeFilePath, codeTs);
        const generated = generateCSharpCode({ codeFilePath, reportFilePath, outputFilePath: path.join(folder, "Code.cs"),
          projectRoot: root, className: `CodegenFlow${id}`, caseId: id, enterpriseMode, enableRepair: false });
        assert.equal(generated.validation.success, true);
        assert.equal(generated.actionFidelity.success, true);
        return { entry: { id, title: "Generated popups", status: "generated" }, codeTs,
          codeCs: generated.code, report: JSON.parse(fs.readFileSync(reportFilePath, "utf8")), metadata: { actions: [] } };
      });
      const before = JSON.stringify(cases);
      const result = buildSprint("Generated", cases);
      assert.deepEqual(result.errors, []);
      assert.equal(JSON.stringify(cases), before);
      assert.equal(result.report.sharedLocators.sharedCount, 1);
      commentFreeLocators(result.codeCs);
      assert.equal((result.codeCs.match(/public ILocator /g) || []).length, 5);
      for (const actor of ["page1", "page2"]) {
        assert.equal((result.codeCs.match(new RegExp(`_${actor}Locators = new Locators\\(_${actor}\\)`, "g")) || []).length, 2);
      }
      if (enterpriseMode) {
        const update = method(result.codeCs, "UpdateOverrideDetailsAsync");
        assert.match(update, /var popupLocators = new Locators\(popupPage\)/);
        assert.match(update, /popupLocators\.Value_95063_page1/);
        assert.match(update, /_page2Locators\.Value2_95063_page2/);
        assert.doesNotMatch(update, /popupLocators\.Value2_95063_page2/);
      }
      const compilation = compileGeneratedCSharp(result.codeCs, { projectRoot: path.resolve(__dirname, "../../..") });
      assert.equal(compilation.success, true, JSON.stringify(compilation));
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("single-line projection compiles with two popup actors per case and parameter-bound methods", () => {
  const result = buildSprint("Unified", [legacy("95063"), legacy("95064")]);
  assert.deepEqual(result.errors, []);
  const compilation = compileGeneratedCSharp(result.codeCs, { projectRoot: path.resolve(__dirname, "../../..") });
  assert.equal(compilation.success, true, JSON.stringify(compilation));
});