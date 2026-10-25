const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");
const { extractTestBlock, renameTestBlock, mergeTypeScript, mergeCSharp, buildSprint, rebuildSprint } = require("./SprintMerger.cjs");

function fixture(id, title = `Case ${id}`) {
  const codeTs = [
    "import { test, expect } from '@playwright/test';", "",
    "test.use({ storageState: 'shared-session.json' });", "",
    "test('test', async ({ page }) => {",
    `  await page.locator('#${id}').click();`,
    "});"
  ].join("\n");
  return {
    entry: { id, title, status: "generated", workFolder: `.work/${id}` }, codeTs,
    codeCs: `// Test case: ${id} - ${title}\n// Source: Code.ts\nusing System;\nusing Microsoft.Playwright;\n\nnamespace AutomationFrameWork.CodegenAI\n{\n    public sealed class CodegenFlow${id}\n    {\n        // Misleading closing brace: }\n        public string Text => "brace } and namespace Fake {";\n        public CodegenFlow${id}() { }\n    }\n}\n`,
    report: { className: `CodegenFlow${id}`, actionCount: 1, unsupportedActions: [], codeGenerationBlocked: false, locatorValidation: { hasFailures: false }, locatorRepair: { codeGenerationBlocked: false }, validation: { success: true } },
    metadata: { analyzedActions: 1, transformedActions: 1, actions: [{ line: 6, locator: `#${id}`, transformed: true }] }
  };
}

function testExtractionAndEscaping() {
  const item = fixture("TC01");
  const title = "TC01 - Owner's \\folder\nsecond line\u2028end";
  const extracted = extractTestBlock(item.codeTs.replace(/\n/g, "\r\n"));
  const renamed = renameTestBlock(extracted, title);
  const parsed = ts.createSourceFile("Code.ts", renamed.block, ts.ScriptTarget.Latest, true);
  assert.strictEqual(parsed.parseDiagnostics.length, 0);
  assert.strictEqual(parsed.statements[0].expression.arguments[0].text, title);
  assert.ok(renamed.block.includes("await page.locator('#TC01').click();"));
  assert.strictEqual(renamed.lineMap.get(6).relativeLine, 2);
  const braces = item.codeTs.replace("  await", "  // test('not a test', () => { });\n  const value = `text } ${1 + 2}`;\n  await");
  assert.ok(extractTestBlock(braces).block.includes("const value"));
  assert.throws(() => extractTestBlock(item.codeTs + "\n" + extracted.block), /exactly one/);
  assert.throws(() => extractTestBlock("test('broken', async () => {"), /Invalid TypeScript/);
  assert.throws(() => extractTestBlock("const shared = 1;\n" + item.codeTs), /helpers\/hooks/);
}

function testMergeAndMetadataLines() {
  const cases = [fixture("TC01"), fixture("TC02", "Owner's \\files"), fixture("TC03")];
  cases[1].codeTs = cases[1].codeTs.replace("test('test'", "test(\n  'test'");
  cases[1].metadata.actions[0].line += 1;
  cases[1].codeCs = cases[1].codeCs.replace("using System;", "using System;\nusing System.Threading.Tasks;");
  const result = buildSprint("Demo", cases, "fixed-time");
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual((result.codeTs.match(/^import /gm) || []).length, 1);
  assert.strictEqual((result.codeTs.match(/^test\.use/gm) || []).length, 1);
  const parsed = ts.createSourceFile("Code.ts", result.codeTs, ts.ScriptTarget.Latest, true);
  const titles = parsed.statements.filter((statement) => statement.expression?.expression?.text === "test")
    .map((statement) => statement.expression.arguments[0].text);
  assert.deepStrictEqual(titles, cases.map((item) => `${item.entry.id} - ${item.entry.title}`));
  assert.strictEqual((result.codeCs.match(/^namespace /gm) || []).length, 1);
  assert.strictEqual((result.codeCs.match(/^using System;/gm) || []).length, 1);
  assert.strictEqual((result.codeCs.match(/public sealed class/g) || []).length, 4);
  assert.strictEqual((result.codeCs.match(/public sealed class TestCase/g) || []).length, 3);
  assert.deepStrictEqual(result.report.cases.map((entry) => entry.className), ["TestCaseTC01", "TestCaseTC02", "TestCaseTC03"]);
  assert.deepStrictEqual(result.report.cases.map((entry) => entry.internalClassName), ["CodegenFlowTC01", "CodegenFlowTC02", "CodegenFlowTC03"]);
  assert.strictEqual((result.codeCs.match(/\/\/ Test case:/g) || []).length, 3);
  assert.strictEqual(result.report.cases.length, 3);
  assert.strictEqual(result.report.codeGenerationBlocked, false);
  for (const entry of result.metadata.actions) {
    assert.ok(result.codeTs.split("\n")[entry.line - 1].includes(entry.locator));
    assert.strictEqual(entry.relativeLine, entry.testCaseId === "TC02" ? 3 : 2);
  }
  assert.strictEqual(result.metadata.transformedActions, 3);
  assert.ok(result.metadata.actions[2].line > result.metadata.actions[1].line);
  // Removing a preceding block must recompute absolute positions, not reuse old lines.
  const reduced = buildSprint("Demo", cases.slice(1));
  assert.ok(reduced.metadata.actions[0].line < result.metadata.actions[1].line);
  assert.ok(reduced.codeTs.split("\n")[reduced.metadata.actions[0].line - 1].includes("#TC02"));
}

function testFailureIsolation() {
  const good = fixture("TC01");
  const failed = fixture("TC02");
  failed.entry.status = "failed: generation blocked";
  failed.report.codeGenerationBlocked = true;
  failed.report.validation.success = false;
  const skipped = fixture("TC03");
  skipped.entry.status = "skipped";
  const missing = fixture("TC04");
  missing.codeCs = null;
  const result = buildSprint("Demo", [good, failed, skipped, missing]);
  assert.strictEqual((result.codeTs.match(/^test\(/gm) || []).length, 1);
  assert.ok(!result.codeCs.includes("class TestCaseTC02"));
  assert.strictEqual(result.report.codeGenerationBlocked, true);
  assert.strictEqual(result.report.cases.length, 4);
  assert.strictEqual(result.report.cases[1].included, false);
  const malformed = fixture("TC02");
  malformed.codeTs += "\ntest('extra', async () => {});";
  const rejected = buildSprint("Demo", [good, malformed, fixture("TC03")]);
  assert.strictEqual(rejected.errors.length, 1);
  assert.deepStrictEqual(rejected.report.cases.map((item) => item.included), [true, false, true]);
  const badLine = fixture("TC02");
  badLine.metadata.actions[0].line = 1;
  assert.match(buildSprint("Demo", [good, badLine]).errors[0], /outside its test block/);
  assert.throws(() => mergeCSharp([good, good]), /Duplicate generated class/);
  const namespace = fixture("TC02");
  namespace.codeCs = namespace.codeCs.replace("AutomationFrameWork.CodegenAI", "Different.Namespace");
  assert.throws(() => mergeCSharp([good, namespace]), /different C# namespaces/);
  const imported = fixture("TC02");
  imported.codeTs = "import fs from 'fs';\n" + imported.codeTs;
  assert.throws(() => mergeTypeScript([good, imported]), /imports differ/);
  assert.strictEqual(buildSprint("Empty", []).codeTs, "");
  assert.strictEqual(buildSprint("Empty", []).codeCs, "");
}

function testDiskRebuildReplacementAndFailure() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-merger-"));
  try {
    const cases = [fixture("TC01"), fixture("TC02"), fixture("TC03")];
    const manifest = { batchId: "Demo", testCases: cases.map((item) => item.entry) };
    const manifestPath = path.join(folder, "manifest.json");
    for (const item of cases) {
      const work = path.join(folder, item.entry.workFolder);
      fs.mkdirSync(work, { recursive: true });
      for (const [name, content] of Object.entries({ "Code.ts": item.codeTs, "Code.cs": item.codeCs, "CSharpGenerationReport.json": JSON.stringify(item.report), "TableLocatorMetadata.json": JSON.stringify(item.metadata) })) {
        fs.writeFileSync(path.join(work, name), content);
      }
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    rebuildSprint(manifestPath);
    const before = fs.readFileSync(path.join(folder, "Code.ts"), "utf8");
    const unchanged = fs.readFileSync(path.join(folder, ".work", "TC01", "Code.ts"));
    const second = path.join(folder, ".work", "TC02", "Code.ts");
    fs.writeFileSync(second, fs.readFileSync(second, "utf8").replace(".click()", ".dblclick()"));
    rebuildSprint(manifestPath);
    const after = fs.readFileSync(path.join(folder, "Code.ts"), "utf8");
    assert.strictEqual(after, before.replace("locator('#TC02').click()", "locator('#TC02').dblclick()"));
    assert.deepStrictEqual(fs.readFileSync(path.join(folder, ".work", "TC01", "Code.ts")), unchanged);
    manifest.testCases[1].status = "failed: generation error";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const failed = rebuildSprint(manifestPath);
    assert.ok(!failed.codeTs.includes("test('TC02"));
    assert.ok(failed.codeTs.includes("test('TC01"));
    assert.ok(failed.codeTs.includes("test('TC03"));
    assert.ok(!fs.readdirSync(folder).some((name) => name.endsWith(".tmp")));
    const prior = fs.readFileSync(path.join(folder, "Code.ts"));
    manifest.testCases[0].workFolder = "../../escape";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    assert.throws(() => rebuildSprint(manifestPath), /expected workFolder/);
    assert.deepStrictEqual(fs.readFileSync(path.join(folder, "Code.ts")), prior);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

function runAllTests() {
  testExtractionAndEscaping();
  testMergeAndMetadataLines();
  testFailureIsolation();
  testDiskRebuildReplacementAndFailure();
  console.log("SprintMerger tests passed (titles, single headers, classes, metadata lines, replacement, failure isolation, atomic writes)");
}

if (require.main === module) runAllTests();
module.exports = { runAllTests };