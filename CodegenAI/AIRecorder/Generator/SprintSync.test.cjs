"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { createHash } = require("crypto");
const { syncSprint, extractCases, describeSteps, matchSteps } = require("./SprintSync.cjs");
const { generateCSharpCode } = require("./CSharpCodeGenerator.cjs");
const { buildSprint } = require("./SprintMerger.cjs");

const header = "import { test, expect } from '@playwright/test';\n\ntest.use({ storageState: 'session.json' });\n\n";
const block = (id, title, lines) => `test('${id} - ${title}', async ({ page }) => {\n${lines.map((line) => `  ${line}`).join("\n")}\n});`;
const click = (selector) => `await page.locator('${selector}').click();`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

function fixture(t, definitions = [["TC01", "First", [click("#save")]], ["TC02", "Second", [click("#save")]]]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-sync-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeJson(path.join(root, "appsettings.json"), { Urls: {} });
  const folder = path.join(root, "CodegenAI", "Recordings", "Demo");
  fs.mkdirSync(folder, { recursive: true });
  const manifestPath = path.join(folder, "manifest.json"), sourcePath = path.join(folder, "Code.ts");
  const manifest = { batchId: "Demo", testCases: definitions.map(([id, title]) => ({ id, title, status: "recorded", workFolder: `.work/${id}` })) };
  writeJson(manifestPath, manifest);
  fs.writeFileSync(sourcePath, header + definitions.map(([id, title, lines]) => block(id, title, lines)).join("\n\n") + "\n");
  const file = (name) => path.join(folder, name);
  const work = (id, name) => path.join(folder, ".work", id, name);
  const sync = (options) => syncSprint(manifestPath, options);
  return { root, folder, manifestPath, sourcePath, manifest, file, work, sync };
}

function tree(folder) {
  const result = {};
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else result[path.relative(folder, file)] = fs.readFileSync(file).toString("base64");
    }
  };
  visit(folder);
  return result;
}

function seedHistory(f, metadata = true) {
  const cases = extractCases(fs.readFileSync(f.sourcePath, "utf8"), f.manifest);
  for (const item of cases) {
    fs.mkdirSync(path.dirname(f.work(item.entry.id, "Code.ts")), { recursive: true });
    fs.writeFileSync(f.work(item.entry.id, "Code.ts"), item.codeTs);
    writeJson(f.work(item.entry.id, "LiveObservations.json"), { replayVersion: 2, actions: item.actions.map((action) => ({
      line: action.sourceLine, raw: action.raw, executionStatus: "succeeded", matchCount: 1,
      tagName: "button", visible: true, enabled: true
    })) });
    writeJson(f.work(item.entry.id, "TableLocatorMetadata.json"), { analyzedActions: item.actions.length,
      transformedActions: metadata ? item.actions.length : 0,
      actions: metadata ? item.actions.filter((action) => action.locator?.selector).map((action) => ({
        line: action.sourceLine, action: action.actionType, locator: action.locator.selector,
        uniqueMatch: true, confidence: 0.98, notes: "DOM validated", validation: { success: true }
      })) : [] });
  }
}

// Normal generation/merge history, deliberately without a bootstrap sync.
function publishHistory(f, observed, ending = "\n") {
  seedHistory(f, observed);
  const cases = f.manifest.testCases.map((entry) => {
    const file = (name) => f.work(entry.id, name);
    const codeTs = fs.readFileSync(file("Code.ts"), "utf8").replace(/\n+$/, "") + ending;
    fs.writeFileSync(file("Code.ts"), codeTs);
    if (!observed) fs.rmSync(file("LiveObservations.json"));
    const generated = generateCSharpCode({ projectRoot: f.root, appSettingsPath: path.join(f.root, "appsettings.json"),
      codeFilePath: file("Code.ts"), outputFilePath: file("Code.cs"), reportFilePath: file("CSharpGenerationReport.json"),
      tableMetadataPath: file("TableLocatorMetadata.json"), domObservationPath: file("LiveObservations.json"),
      caseId: entry.id, caseTitle: entry.title, className: `CodegenFlow${entry.id}`, enterpriseMode: true, enableRepair: false });
    assert.equal(generated.codeGenerationBlocked, false);
    return { entry, codeTs, codeCs: generated.code, report: readJson(file("CSharpGenerationReport.json")),
      metadata: readJson(file("TableLocatorMetadata.json")) };
  });
  const published = buildSprint(f.manifest.batchId, cases);
  assert.deepEqual(published.errors, []);
  fs.writeFileSync(f.file("Code.cs"), published.codeCs);
  writeJson(f.file("CSharpGenerationReport.json"), published.report);
  return { published, cases };
}

for (const [observed, selector] of [[false, "#save"], [false, "/html/body/div[1]/button"], [true, "#save"]]) {
  test(`normal publication no-op preserves bytes/disposition and final-newline variants (${observed}, ${selector})`, (t) => {
    for (const ending of ["", "\n", "\n\n", "\r\n\r\n"]) {
      const f = fixture(t, [["TC01", "First", [click(selector)]]]);
      const { published, cases } = publishHistory(f, observed, ending);
      const source = fs.readFileSync(f.sourcePath), local = fs.readFileSync(f.work("TC01", "Code.cs"));
      for (let repeat = 0; repeat < 3; repeat++) {
        const result = f.sync(), report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
        assert.equal(result.codeCs, published.codeCs);
        assert.deepEqual(fs.readFileSync(f.file("Code.cs")), Buffer.from(published.codeCs));
        assert.deepEqual(fs.readFileSync(f.work("TC01", "Code.cs")), local);
        assert.deepEqual(fs.readFileSync(f.sourcePath), source);
        assert.deepEqual(result.summary.affectedIds, []);
        assert.equal(report.sync.evidenceInvalidated, false);
        assert.equal(report.sync.evidenceStatus, observed ? "SAVED" : "UNAVAILABLE");
        assert.deepEqual(report.locatorValidation, cases[0].report.locatorValidation);
        for (const current of [report, result.report.cases[0], readJson(f.manifestPath).testCases[0]]) {
          assert.equal(current.reviewRequired, cases[0].report.reviewRequired);
          assert.deepEqual(current.issues, cases[0].report.issues);
          assert.ok(!current.issues.some((issue) => ["LV015", "SYNC001"].includes(issue.ruleId)));
        }
        if (!observed) {
          assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
          assert.equal(fs.existsSync(f.work("TC01", "LiveObservations.json")), false);
        }
      }
    }
  });
}

test("real selector whitespace edits invalidate saved or absent evidence, then remain stable", (t) => {
  for (const observed of [true, false]) for (const [before, after] of [
    ["#panel button", "#panelbutton"], ['[aria-label="Save  now"]', '[aria-label="Save now"]']
  ]) {
    const f = fixture(t, [["TC01", "First", [click(before)]]]);
    publishHistory(f, observed, "\n\n");
    fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace(before, after));
    let previous;
    for (let repeat = 0; repeat < 3; repeat++) {
      const source = fs.readFileSync(f.sourcePath), result = f.sync();
      const report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
      assert.deepEqual(fs.readFileSync(f.sourcePath), source);
      assert.equal(report.sync.evidenceInvalidated, true);
      assert.equal(report.sync.evidenceStatus, "UNVERIFIED");
      assert.equal(report.locatorValidation.observationCoverage.status, "INCOMPLETE");
      assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
      assert.equal(report.generatedLocators[0].originalExpression, `page.locator('${after}')`);
      for (const current of [report, result.report.cases[0], readJson(f.manifestPath).testCases[0]]) {
        assert.equal(current.reviewRequired, true);
        for (const rule of ["LV015", "SYNC001"]) assert.equal(current.issues.filter((issue) => issue.ruleId === rule).length, 1);
      }
      const live = readJson(f.work("TC01", "LiveObservations.json"));
      assert.equal(live.evidenceStatus, "UNVERIFIED");
      assert.ok(live.actions.every((action) => action.executionStatus === "skipped" && action.matchCount === undefined));
      for (const entry of result.metadata.actions) {
        assert.equal(entry.evidenceStatus, "UNVERIFIED");
        assert.equal(entry.uniqueMatch, undefined);
        assert.equal(entry.validation, undefined);
      }
      assert.equal(result.summary.changed, repeat === 0 ? 1 : 0);
      if (previous) assert.equal(result.codeCs, previous.codeCs);
      previous = result;
    }
  }
});

test("missing observations are not known absence without a prior UNAVAILABLE report", (t) => {
  for (const priorReport of [true, false]) {
    const f = fixture(t, [["TC01", "First", [click("#save")]]]);
    publishHistory(f, true);
    fs.rmSync(f.work("TC01", "LiveObservations.json"));
    if (!priorReport) fs.rmSync(f.work("TC01", "CSharpGenerationReport.json"));
    const result = f.sync(), report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
    assert.equal(report.sync.evidenceInvalidated, true);
    assert.equal(report.sync.evidenceStatus, "UNVERIFIED");
    assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
    assert.equal(result.report.reviewRequired, true);
    assert.equal(f.sync().codeCs, result.codeCs);
  }
});

test("known absence does not bypass strict locator validation on unchanged source", (t) => {
  const f = fixture(t, [["TC01", "First", [click("/html/body/div[1]/button")]]]);
  publishHistory(f, false, "\n\n");
  const before = tree(f.folder);
  assert.throws(() => f.sync({ strictLocators: true }), /generation blocked/);
  assert.deepEqual(tree(f.folder), before);
});

test("bootstrap named blocks, share locators, preserve BOM/CRLF/no-final-newline bytes, repeat stable", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.sourcePath, "\uFEFF" + fs.readFileSync(f.sourcePath, "utf8").trimEnd().replace(/\n/g, "\r\n"));
  const original = fs.readFileSync(f.sourcePath);
  const first = f.sync();
  assert.deepEqual(fs.readFileSync(f.sourcePath), original);
  assert.equal(first.codeTs, undefined);
  assert.equal(first.report.sharedLocators.sharedCount, 1);
  assert.match(first.codeCs, /class Locators/);
  assert.match(first.codeCs, /class TestCaseTC01/);
  assert.doesNotMatch(first.codeCs, /class CodegenFlow/);
  assert.equal(first.report.compilation.status, "UNAVAILABLE");
  assert.equal(first.report.reviewRequired, true);
  assert.equal(first.boundaries.version, 1);
  assert.equal(first.boundaries.cases.length, 2);
  const second = f.sync();
  assert.equal(second.codeCs, first.codeCs);
  assert.deepEqual(fs.readFileSync(f.sourcePath), original);
  assert.equal(second.summary.changed, 0);
  assert.equal(second.summary.added, 0);
  assert.deepEqual(second.summary.affectedIds, []);
  assert.deepEqual(second.summary.locatorChanges, []);
  assert.match(second.summary.text, /affected=none$/);
  assert.equal(second.report.generatedCodeHash, createHash("sha256").update(second.codeCs).digest("hex"));
  assert.equal(readJson(f.work("TC01", "CSharpGenerationReport.json")).locatorRepair.repairStatus, "SKIPPED");
});

test("manual selector edit keeps stable property name and changes only selector in a single-case draft", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#old-selector")]]]);
  const first = f.sync();
  const oldReport = readJson(f.work("TC01", "CSharpGenerationReport.json"));
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace("#old-selector", "#manual-selector"));
  const updated = f.sync();
  const report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
  assert.equal(report.generatedLocators[0].propertyName, oldReport.generatedLocators[0].propertyName);
  assert.equal(updated.codeCs, first.codeCs.replace(/#old-selector/g, "#manual-selector"));
  assert.deepEqual(updated.summary.affectedIds, ["TC01"]);
  assert.equal(updated.summary.changed, 1);
  assert.equal(updated.summary.added, 0);
  assert.equal(updated.summary.removed, 0);
  assert.deepEqual(updated.summary.locatorChanges, [{ caseId: "TC01", propertyName: report.generatedLocators[0].propertyName,
    stepId: report.sync.steps[0].id, category: "changed" }]);
  assert.doesNotMatch(JSON.stringify(updated.summary), /#old-selector|#manual-selector|originalExpression|locatorExpression/);
  assert.equal(report.sync.evidenceStatus, "UNVERIFIED");
  assert.equal(f.sync().codeCs, updated.codeCs);
});

test("AST boundaries survive inserted/deleted lines, case reorder and stale saved line counts", (t) => {
  const f = fixture(t);
  f.sync();
  const saved = readJson(f.file("boundaries.json"));
  saved.extraRecorderData = { ignored: true };
  for (const entry of saved.cases) { entry.startLine = 999; entry.endLine = -2; entry.optional = true; }
  writeJson(f.file("boundaries.json"), saved);
  const source = header + "// new comment\n\n" + block("TC02", "Second", [click("#save")]) + "\n\n\n" +
    block("TC01", "First", ["// a comment inside the test", click("#save")]) + "\n";
  fs.writeFileSync(f.sourcePath, source);
  const result = f.sync();
  assert.equal(fs.readFileSync(f.sourcePath, "utf8"), source);
  assert.deepEqual(result.boundaries.cases.map((item) => item.id), ["TC02", "TC01"]);
  for (const item of result.boundaries.cases) assert.ok(source.split("\n")[item.startLine - 1].startsWith(`test('${item.id}`));
  assert.deepEqual(result.boundaries.extraRecorderData, { ignored: true });
  assert.equal(result.report.sourceMap[0].sourceLine, source.split("\n").findIndex((line) => line.includes("await")) + 1);
  assert.equal(f.sync().codeCs, result.codeCs);
});

test("manual TLL edit uses step identity; maps metadata and shared markers to actual combined lines", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#old")]], ["TC02", "Second", [click("#old")]]]);
  seedHistory(f);
  const first = f.sync();
  assert.equal(first.report.sharedLocators.sharedCount, 1);
  assert.equal(readJson(f.work("TC01", "CSharpGenerationReport.json")).sync.evidenceStatus, "SAVED");
  const source = fs.readFileSync(f.sourcePath, "utf8").replace(/#old/g, "#correct-manual").replace("test('TC02", "// inserted between blocks\n\n\ntest('TC02");
  fs.writeFileSync(f.sourcePath, source);
  const updated = f.sync();
  assert.equal(updated.metadata.actions.length, 2);
  assert.equal(updated.report.sharedLocators.sharedCount, 1);
  for (const entry of updated.metadata.actions) {
    assert.equal(entry.locator, "#correct-manual");
    assert.equal(entry.evidenceStatus, "UNVERIFIED");
    assert.equal(entry.uniqueMatch, undefined);
    assert.equal(entry.validation, undefined);
    assert.ok(source.split("\n")[entry.line - 1].includes("#correct-manual"));
    assert.ok(updated.codeCs.includes(`[TLL ${entry.testCaseId}:L${entry.line}]`));
    const report = readJson(f.work(entry.testCaseId, "CSharpGenerationReport.json"));
    assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
    assert.equal(report.locatorValidation.observationCoverage.status, "INCOMPLETE");
    assert.equal(report.sync.evidenceStatus, "UNVERIFIED");
  }
  const refs = updated.report.sharedLocators.shared[0].references;
  assert.deepEqual(refs.map((ref) => ref.tllSourceLines[0]), updated.metadata.actions.map((entry) => entry.line));
  assert.equal(f.sync().codeCs, updated.codeCs);
});

test("insert/delete/reorder actions preserve surviving TLL identities and summarize changes", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#a"), click("#b"), click("#c")]]]);
  seedHistory(f); f.sync();
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", [click("#c"), "await page.getByRole('button', { name: 'New' }).click();", click("#a")]) + "\n");
  const result = f.sync();
  assert.equal(result.summary.added, 1);
  assert.equal(result.summary.removed, 1);
  assert.equal(result.summary.moved, 2);
  assert.deepEqual(result.metadata.actions.map((entry) => entry.locator).sort(), ["#a", "#c"]);
  assert.deepEqual(result.summary.affectedIds, ["TC01"]);
  const report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
  const property = (id) => report.generatedLocators.find((binding) => binding.actionSourceLines.includes(
    report.sync.steps.find((step) => step.id === id).sourceLine)).propertyName;
  assert.deepEqual(result.summary.locatorChanges, [
    { caseId: "TC01", propertyName: property("TC01:S3"), stepId: "TC01:S3", category: "moved" },
    { caseId: "TC01", propertyName: property("TC01:S4"), stepId: "TC01:S4", category: "added" },
    { caseId: "TC01", propertyName: property("TC01:S1"), stepId: "TC01:S1", category: "moved" },
    { caseId: "TC01", propertyName: "B", stepId: "TC01:S2", category: "removed" }
  ]);
});

test("stale work selectors are never generation inputs; missing combined source fails without writes", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#current")]]]);
  seedHistory(f, false);
  fs.writeFileSync(f.work("TC01", "Code.ts"), fs.readFileSync(f.work("TC01", "Code.ts"), "utf8").replace("#current", "#stale"));
  const result = f.sync();
  assert.ok(result.codeCs.includes("#current"));
  assert.ok(!result.codeCs.includes("#stale"));
  fs.rmSync(f.sourcePath);
  const before = tree(f.folder);
  assert.throws(() => f.sync(), /Combined Code.ts is missing/);
  assert.deepEqual(tree(f.folder), before);
});

test("legacy manifest titles bootstrap without boundaries; duplicate titles are ambiguous", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace("TC01 - First", "First").replace("TC02 - Second", "Second"));
  assert.equal(f.sync().boundaries.cases.length, 2);
  const manifest = readJson(f.manifestPath);
  manifest.testCases[1].title = "First";
  writeJson(f.manifestPath, manifest);
  fs.rmSync(f.file("boundaries.json"));
  const before = tree(f.folder);
  assert.throws(() => f.sync(), /ambiguous test title/);
  assert.deepEqual(tree(f.folder), before);
});

test("missing, unknown, duplicated and malformed cases fail before any artifact writes", (t) => {
  const f = fixture(t);
  const original = fs.readFileSync(f.sourcePath, "utf8");
  const variants = [header + block("TC01", "First", [click("#save")]),
    original.replace("TC01 - First", "TC99 - Unknown"),
    original + "\n" + block("TC01", "First", [click("#save")]), original + "\ntest('broken', async () => {",
    "const helper = 1;\n" + original];
  for (const source of variants) {
    fs.writeFileSync(f.sourcePath, source);
    const before = tree(f.folder);
    assert.throws(() => f.sync());
    assert.deepEqual(tree(f.folder), before);
  }
  fs.writeFileSync(f.sourcePath, original);
  writeJson(f.file("boundaries.json"), { version: 2, cases: [] });
  assert.throws(() => f.sync(), /version 1/);
});

test("ambiguous edited table steps block instead of moving provenance to arbitrary action", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#old")]]]);
  seedHistory(f); f.sync();
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", [click("#new-a"), click("#new-b")]) + "\n");
  const before = tree(f.folder);
  assert.throws(() => f.sync(), /ambiguous edited table step/);
  assert.deepEqual(tree(f.folder), before);
});

test("default review policy and saved strict-locator policy survive offline sync", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#simple")]]]);
  f.sync({ strictLocators: true });
  let report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
  assert.equal(report.strictLocators, true);
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace("#simple", "/html/body/div[1]/button"));
  const before = tree(f.folder);
  assert.throws(() => f.sync(), /generation blocked/);
  assert.deepEqual(tree(f.folder), before);
  const review = f.sync({ strictLocators: false });
  assert.equal(review.report.codeGenerationBlocked, false);
  assert.equal(review.report.reviewRequired, true);
  report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
  assert.equal(report.strictLocators, false);
  assert.equal(report.locatorValidation.hasFailures, true);
  assert.equal(report.locatorRepair.repairStatus, "SKIPPED");
  assert.ok(review.codeCs.includes("/html/body/div[1]/button"));
});

test("generated draft hash protects both combined and per-case manual C# edits", (t) => {
  const f = fixture(t);
  f.sync();
  for (const file of [f.file("Code.cs"), f.work("TC01", "Code.cs")]) {
    const original = fs.readFileSync(file);
    fs.appendFileSync(file, "\n// manual draft edit\n");
    const before = tree(f.folder);
    assert.throws(() => f.sync(), /saved draft hash/);
    assert.deepEqual(tree(f.folder), before);
    fs.writeFileSync(file, original);
  }
});

test("editing one shared selector moves declarations local but preserves case property names", (t) => {
  const f = fixture(t);
  const first = f.sync();
  const beforeNames = ["TC01", "TC02"].map((id) => readJson(f.work(id, "CSharpGenerationReport.json")).generatedLocators[0].propertyName);
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace("#save", "#edited"));
  const result = f.sync();
  assert.equal(first.report.sharedLocators.sharedCount, 1);
  assert.equal(result.report.sharedLocators.sharedCount, 0);
  assert.equal(result.summary.changed, 1);
  assert.equal(result.summary.shared.removed, 2);
  assert.deepEqual(result.summary.affectedIds, ["TC01", "TC02"]);
  assert.deepEqual(["TC01", "TC02"].map((id) => readJson(f.work(id, "CSharpGenerationReport.json")).generatedLocators[0].propertyName), beforeNames);
  assert.deepEqual(result.summary.locatorChanges, [
    { caseId: "TC01", propertyName: beforeNames[0], stepId: "TC01:S1", category: "changed" },
    ...["TC01", "TC02"].map((caseId, index) => ({ caseId, propertyName: beforeNames[index], stepId: `${caseId}:S1`, category: "movedFromSharedLocators" }))
  ]);
  assert.equal(f.sync().codeCs, result.codeCs);
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace("#edited", "#save"));
  const sharedAgain = f.sync();
  assert.equal(sharedAgain.summary.shared.added, 2);
  assert.deepEqual(sharedAgain.summary.locatorChanges.filter((row) => row.category === "movedToSharedLocators"),
    ["TC01", "TC02"].map((caseId, index) => ({ caseId, propertyName: beforeNames[index], stepId: `${caseId}:S1`, category: "movedToSharedLocators" })));
  assert.deepEqual(f.sync().summary.locatorChanges, []);
});

test("three-case Deals exact groups reserve the common name across stable sync, rejoining and splitting", (t) => {
  const plain = "page.getByRole('link', { name: 'Deals' })";
  const exact = "page.getByRole('link', { name: 'Deals', exact: true })";
  const ids = ["95063", "95064", "95065"];
  const f = fixture(t, ids.map((id, index) => [id, "Deals", [`await ${index === 2 ? exact : plain}.click();`]]));
  const syncReadOnly = () => {
    const source = fs.readFileSync(f.sourcePath), result = f.sync();
    assert.deepEqual(fs.readFileSync(f.sourcePath), source);
    assert.deepEqual(ids.map((id) => readJson(f.work(id, "CSharpGenerationReport.json")).generatedLocators[0].propertyName),
      ["Deals", "Deals", "Deals"], "Internal property names stay stable for sync comparisons");
    return result;
  };
  const assertPair = (result) => {
    const summary = result.report.sharedLocators;
    assert.equal(summary.sharedCount, 1);
    assert.equal(summary.replacedPropertyCount, 2);
    assert.equal(summary.shared[0].emittedPropertyName, "Deals");
    assert.deepEqual(summary.shared[0].caseIds, ids.slice(0, 2));
    assert.deepEqual(summary.conflicts[0].references.map((ref) => [ref.propertyName, ref.emittedPropertyName]),
      [["Deals", "Deals"], ["Deals", "Deals"], ["Deals", "Deals_95065_page"]]);
    assert.deepEqual([...result.codeCs.matchAll(/public ILocator (\w+) =>/g)].map((match) => match[1]), ["Deals", "Deals_95065_page"]);
    assert.equal((result.codeCs.match(/_locators.Deals.ClickAsync/g) || []).length, 2);
    assert.match(result.codeCs, /_locators.Deals_95065_page.ClickAsync/);
    assert.match(result.codeCs, /public ILocator Deals_95065_page =>[^\n]+Exact = true/);
  };
  const stableRepeat = (previous) => {
    for (let repeat = 0; repeat < 2; repeat++) {
      const result = syncReadOnly();
      assert.equal(result.codeCs, previous.codeCs);
      assert.deepEqual(result.report.sharedLocators, previous.report.sharedLocators);
      assert.deepEqual(result.summary.affectedIds, []);
      assert.deepEqual(result.summary.locatorChanges, []);
      assert.deepEqual([result.summary.shared.added, result.summary.shared.removed, result.summary.shared.moved], [0, 0, 0]);
    }
  };
  const first = syncReadOnly();
  assertPair(first);
  stableRepeat(first);
  fs.writeFileSync(f.sourcePath, fs.readFileSync(f.sourcePath, "utf8").replace(exact, plain));
  const joined = syncReadOnly();
  assert.equal(joined.report.sharedLocators.sharedCount, 1);
  assert.equal(joined.report.sharedLocators.replacedPropertyCount, 3);
  assert.deepEqual(joined.report.sharedLocators.conflicts, []);
  assert.deepEqual(joined.report.sharedLocators.shared[0].references.map((ref) => ref.emittedPropertyName), ["Deals", "Deals", "Deals"]);
  assert.equal((joined.codeCs.match(/public ILocator /g) || []).length, 1);
  assert.deepEqual(joined.summary.affectedIds, ["95065"]);
  assert.deepEqual([joined.summary.shared.added, joined.summary.shared.removed], [1, 0]);
  assert.deepEqual(joined.summary.locatorChanges, [
    { caseId: "95065", propertyName: "Deals", stepId: "95065:S1", category: "changed" },
    { caseId: "95065", propertyName: "Deals", stepId: "95065:S1", category: "movedToSharedLocators" }
  ]);
  stableRepeat(joined);
  const source = fs.readFileSync(f.sourcePath, "utf8"), last = source.lastIndexOf(plain);
  fs.writeFileSync(f.sourcePath, source.slice(0, last) + exact + source.slice(last + plain.length));
  const split = syncReadOnly();
  assertPair(split);
  assert.deepEqual(split.summary.affectedIds, ["95065"]);
  assert.deepEqual([split.summary.shared.added, split.summary.shared.removed], [0, 1]);
  assert.deepEqual(split.summary.locatorChanges, [
    { caseId: "95065", propertyName: "Deals", stepId: "95065:S1", category: "changed" },
    { caseId: "95065", propertyName: "Deals", stepId: "95065:S1", category: "movedFromSharedLocators" }
  ]);
  stableRepeat(split);
});

test("AST/order matching is selector independent for an edit and allocates new monotonic identities", () => {
  const before = describeSteps(click("#a") + "\n" + click("#b"), "TC01");
  const after = describeSteps("// inserted line\n" + click("#manual") + "\n" + click("#b"), "TC01");
  const result = matchSteps(before, after, 3);
  assert.equal(result.matches.get(0), 0);
  assert.equal(after[0].id, before[0].id);
  const next = describeSteps(click("#manual") + "\n" + click("#b") + "\nawait page.getByText('extra').click();", "TC01");
  matchSteps(after, next, 3);
  assert.equal(next[2].id, "TC01:S3");
});

test("unrepresentable same-line actions cannot silently disappear", (t) => {
  const f = fixture(t, [["TC01", "First", [`${click("#a")} ${click("#b")}`]]]);
  const before = tree(f.folder);
  assert.throws(() => f.sync(), /one complete action per line/);
  assert.deepEqual(tree(f.folder), before);
});

test("CLI exits nonzero for blockers, succeeds offline, and reports concise affected IDs", (t) => {
  const f = fixture(t);
  const script = path.join(__dirname, "SprintSync.cjs");
  const ok = spawnSync(process.execPath, [script, "--manifest-file", f.manifestPath], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /changed=0 added=2 removed=0 moved=0 shared=1/);
  assert.match(ok.stdout, /affected=TC01,TC02/);
  assert.match(ok.stdout, /caseId=TC01 propertyName=\w+ stepId=TC01:S1 category=added/);
  assert.match(ok.stdout, /caseId=TC02 propertyName=\w+ stepId=TC02:S1 category=movedToSharedLocators/);
  assert.doesNotMatch(ok.stdout + ok.stderr, /#save|page\.locator/);
  const noop = spawnSync(process.execPath, [script, "--manifest-file", f.manifestPath], { encoding: "utf8" });
  assert.equal(noop.status, 0, noop.stdout + noop.stderr);
  assert.match(noop.stdout, /affected=none/);
  assert.match(noop.stdout, /locator changes: none/);
  assert.doesNotMatch(noop.stdout, /category=/);
  fs.writeFileSync(f.sourcePath, "test('unknown', async ({page}) => {});");
  const before = tree(f.folder);
  const failed = spawnSync(process.execPath, [script, "--manifest-file", f.manifestPath], { encoding: "utf8" });
  assert.equal(failed.status, 1);
  assert.deepEqual(tree(f.folder), before);
  const usage = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Required argument/);
});

test("CLI bounds named locator rows without logging selectors or input values", (t) => {
  const lines = Array.from({ length: 25 }, (_, i) => `await page.locator('[data-private="private-selector-${i}"]').fill('private-input-${i}');`);
  const f = fixture(t, [["TC01", "First", lines]]);
  const result = spawnSync(process.execPath, [path.join(__dirname, "SprintSync.cjs"), "--manifest-file", f.manifestPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout.split(/\r?\n/).filter((line) => line.includes("category=")).length, 20);
  assert.match(result.stdout, /5 more locator change row\(s\)/);
  assert.doesNotMatch(result.stdout + result.stderr, /private-selector-|private-input-|page\.locator|\.fill\(/);
  const summary = readJson(f.file("CSharpGenerationReport.json")).syncSummary;
  assert.equal(summary.locatorChanges.length, 25);
  for (const row of summary.locatorChanges) assert.deepEqual(Object.keys(row), ["caseId", "propertyName", "stepId", "category"]);
});

test("sync refreshes manifest action, unsupported and transformed counts and preserves inactive entries", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#a"), click("#b")]]]);
  Object.assign(f.manifest.testCases[0], { actionCount: 99, unsupportedActionCount: 99, transformedTableActions: 99, recordedAtUtc: "keep" });
  const inactive = ["planned", "skipped"].map((status, index) => ({ id: `TC0${index + 2}`, title: status,
    status, workFolder: `.work/TC0${index + 2}`, actionCount: 9, unsupportedActionCount: 8, transformedTableActions: 7 }));
  f.manifest.testCases.push(...inactive);
  writeJson(f.manifestPath, f.manifest);
  seedHistory(f); f.sync();
  const check = (expected) => {
    const manifest = readJson(f.manifestPath), entry = manifest.testCases[0];
    const report = readJson(f.work("TC01", "CSharpGenerationReport.json"));
    const metadata = readJson(f.work("TC01", "TableLocatorMetadata.json"));
    assert.deepEqual([entry.actionCount, entry.unsupportedActionCount, entry.transformedTableActions], expected);
    assert.equal(entry.actionCount, report.actionCount);
    assert.equal(entry.unsupportedActionCount, report.unsupportedActionCount ?? report.unsupportedActions.length);
    assert.equal(entry.transformedTableActions, metadata.transformedActions);
    assert.equal(entry.recordedAtUtc, "keep");
    assert.deepEqual(manifest.testCases.slice(1), inactive);
  };
  check([2, 0, 2]);
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", [click("#b"), "await page.evaluate(() => 42);"]) + "\n");
  f.sync(); check([2, 1, 1]);
  const settings = { Urls: { Home: "https://example.invalid/home" } };
  writeJson(path.join(f.root, "appsettings.json"), settings);
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", [`await page.goto('${settings.Urls.Home}');`]) + "\n");
  f.sync(); check([1, 0, 0]);
  f.sync(); check([1, 0, 0]);
});

test("invalidated locator-free cases retain offline review issues in merged report and manifest", (t) => {
  const f = fixture(t, [["TC01", "First", []]]);
  const settings = { Urls: { Home: "https://example.invalid/home" } };
  writeJson(path.join(f.root, "appsettings.json"), settings);
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", [`await page.goto('${settings.Urls.Home}');`]) + "\n");
  for (let iteration = 0; iteration < 2; iteration++) {
    const result = f.sync();
    const local = readJson(f.work("TC01", "CSharpGenerationReport.json"));
    const manifest = readJson(f.manifestPath).testCases[0];
    assert.equal(local.generatedLocators.length, 0);
    assert.equal(local.sync.evidenceInvalidated, true);
    for (const report of [local, result.report.cases[0], manifest]) {
      assert.equal(report.reviewRequired, true);
      assert.equal(report.issues.filter((issue) => issue.kind === "offlineSync" && issue.ruleId === "SYNC001").length, 1);
    }
    assert.equal(result.report.reviewRequired, true);
    assert.match(result.codeCs, /REVIEW REQUIRED: \d+ issue\(s\):[^\r\n]*line n\/a SYNC001/);
    assert.deepEqual(result.summary.locatorChanges, []);
  }
});

test("planned/skipped cases remain inactive and do not inherit stale work artifacts", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#one")]]]);
  f.manifest.testCases.push({ id: "TC02", title: "Later", status: "planned", workFolder: ".work/TC02" },
    { id: "TC03", title: "Not now", status: "skipped", workFolder: ".work/TC03" });
  writeJson(f.manifestPath, f.manifest);
  fs.mkdirSync(path.dirname(f.work("TC02", "Code.ts")), { recursive: true });
  fs.writeFileSync(f.work("TC02", "Code.ts"), "stale and invalid TypeScript");
  const result = f.sync();
  assert.deepEqual(result.report.cases.map((entry) => entry.included), [true, false, false]);
  assert.equal(readJson(f.manifestPath).testCases[1].status, "planned");
  assert.equal(fs.readFileSync(f.work("TC02", "Code.ts"), "utf8"), "stale and invalid TypeScript");
  assert.equal(f.sync().codeCs, result.codeCs);
});

test("marker-looking selector text and C# string tokens are not provenance comments", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#a [TLL TC01:L999]")]], ["TC02", "Second", [click("#b [TLL TC02:L999]")]]]);
  seedHistory(f);
  const result = f.sync();
  assert.ok(result.codeCs.includes('Page.Locator("#a [TLL TC01:L999]")'));
  assert.ok(result.codeCs.includes('Page.Locator("#b [TLL TC02:L999]")'));
  for (const entry of result.metadata.actions) assert.ok(result.codeCs.includes(`// [TLL ${entry.testCaseId}:L${entry.line}]`));
});

test("adding a property with an existing historical name cannot steal the stable property name", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#old")]]]);
  f.sync();
  const before = readJson(f.work("TC01", "CSharpGenerationReport.json")).generatedLocators[0].propertyName;
  fs.writeFileSync(f.sourcePath, header + block("TC01", "First", ["await page.getByText('old').click();", click("#old")]) + "\n");
  const result = f.sync();
  const bindings = readJson(f.work("TC01", "CSharpGenerationReport.json")).generatedLocators;
  assert.equal(bindings.find((binding) => binding.originalExpression === "page.locator('#old')").propertyName, before);
  assert.equal(new Set(bindings.map((binding) => binding.propertyName)).size, 2);
  assert.equal(f.sync().codeCs, result.codeCs);
});

test("combined compilation failure blocks publication even after successful individual compiles", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "Fixture.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>');
  const child = require("child_process"), original = child.spawnSync;
  let compiles = 0;
  child.spawnSync = (command, args, options) => {
    if (command !== "dotnet") return original(command, args, options);
    compiles++;
    return compiles <= 2 ? { status: 0, stdout: "", stderr: "" }
      : { status: 1, stdout: "Draft.cs: error CS0000: Combined draft rejected by test compiler", stderr: "" };
  };
  try {
    const before = tree(f.folder);
    assert.throws(() => f.sync(), /Combined C# compilation blocked/);
    assert.equal(compiles, 3);
    assert.deepEqual(tree(f.folder), before);
  } finally { child.spawnSync = original; }
});

test("SDK unavailable with a project is a blocker, not a silent compile pass", (t) => {
  const f = fixture(t, [["TC01", "First", [click("#one")]]]);
  fs.writeFileSync(path.join(f.root, "Fixture.csproj"), '<Project Sdk="Microsoft.NET.Sdk"/>');
  const child = require("child_process"), original = child.spawnSync;
  child.spawnSync = (command, args, options) => command === "dotnet"
    ? { status: null, error: { code: "ENOENT" } } : original(command, args, options);
  try {
    const before = tree(f.folder);
    assert.throws(() => f.sync(), /dotnet was not found/);
    assert.deepEqual(tree(f.folder), before);
  } finally { child.spawnSync = original; }
});

test("real framework compile of the temporary shared merged draft (opt-in, no application execution)",
  { skip: !process.env.SPRINT_SYNC_COMPILE_PROJECT_ROOT }, (t) => {
    const f = fixture(t);
    const result = f.sync({ projectRoot: process.env.SPRINT_SYNC_COMPILE_PROJECT_ROOT });
    assert.equal(result.report.compilation.success, true);
    assert.equal(result.report.sharedLocators.sharedCount, 1);
    assert.equal(result.report.generatedCodeHash, createHash("sha256").update(result.codeCs).digest("hex"));
  });