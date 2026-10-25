"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { PassThrough, Writable } = require("stream");
const { spawn, spawnSync } = require("child_process");
const { recordSession, publishSession, parseCapture, stableCapture, resolveCli } = require("./SessionRecorder.cjs");
const { generateCSharpCode, parseRecordedActions } = require("./CSharpCodeGenerator.cjs");
const { syncSprint } = require("./SprintSync.cjs");

const header = "import { test, expect } from '@playwright/test';\n\n";
const raw = (actions) => header + "test('test', async ({ page }) => {\n" + actions.map((action) => "  " + action).join("\n") + "\n});\n";
const click = (id) => `await page.locator('#${id}').click();`;
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function fixture(t, count = 2) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "session-recorder-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const manifestFile = path.join(folder, "manifest.json"), output = path.join(folder, "Code.ts");
  const entries = Array.from({ length: count }, (_, i) => ({ id: `TC0${i + 1}`, title: `Case ${i + 1}`,
    status: "planned", workFolder: `.work/TC0${i + 1}`, folder: ".", codeTs: "Code.ts", codeCs: "Code.cs",
    report: "CSharpGenerationReport.json", tableMetadata: "TableLocatorMetadata.json" }));
  write(manifestFile, JSON.stringify({ batchId: "Demo", testCases: entries }));
  const input = new PassThrough(), state = { launches: [], exits: [], prompts: [], child: null };
  const fakeSpawn = (exe, args, options) => {
    state.launches.push({ exe, args, options });
    const child = new EventEmitter(); state.child = child;
    child.stdin = new Writable({ write(chunk, _encoding, done) { state.exits.push(String(chunk)); done(); } });
    child.stdin.on("finish", () => queueMicrotask(() => { state.onExit?.(); child.emit("close", 0, null); }));
    child.kill = () => { state.killed = true; child.emit("close", null, "SIGTERM"); };
    write(output, raw([]));
    return child;
  };
  const run = (steps, options = {}) => recordSession({ manifestFile, url: "https://example.invalid/", input,
    spawn: fakeSpawn, flush: { quietMs: 15, timeoutMs: 1000 }, closeTimeoutMs: 100,
    log(message) {
      state.prompts.push(message);
      if (message.includes(": record actions") || message.includes("All boundaries saved")) {
        const step = steps.shift();
        assert.ok(step, `Unexpected prompt: ${message}`);
        step({ input, state, output, folder, manifestFile });
      }
    }, ...options });
  return { folder, manifestFile, output, entries, input, state, run };
}
const enter = (actions, answer = "\n") => ({ output, input }) => { write(output, raw(actions)); input.write(answer); };

test("launches one node CLI, saves action-end boundaries while browser stays open, then exits once", async (t) => {
  const f = fixture(t);
  const result = await f.run([
    enter([click("one")]),
    ({ state, folder, input, output }) => {
      assert.deepEqual(state.exits, []);
      assert.equal(state.launches.length, 1);
      const saved = readJson(path.join(folder, "boundaries.json"));
      const boundary = saved.captureSessions[0].boundaries[0];
      assert.equal(boundary.rawEndAction, 1);
      assert.equal(boundary.rawEndLine, 4); // action, not closing test footer
      assert.equal(readJson(f.manifestFile).testCases[0].status, "recorded");
      assert.match(fs.readFileSync(path.join(folder, ".work/TC01/Code.ts"), "utf8"), /TC01 - Case 1/);
      write(output, raw([click("one"), click("two")])); input.write("\n");
    },
    ({ state, input }) => { assert.deepEqual(state.exits, []); input.write("\n"); }
  ], { loadStorage: path.join(f.folder, "load.json"), saveStorage: path.join(f.folder, "save.json"), testIdAttribute: "data-test" });
  assert.deepEqual(result.recordedIds, ["TC01", "TC02"]);
  assert.deepEqual(f.state.exits, ["exit\n"]);
  const launch = f.state.launches[0];
  assert.equal(launch.exe, process.execPath);
  assert.equal(launch.args[0], resolveCli());
  assert.equal(launch.args[launch.args.indexOf("--output") + 1], f.output);
  assert.equal(launch.args[launch.args.indexOf("--target") + 1], "playwright-test");
  assert.equal(launch.options.stdio[0], "pipe");
  assert.equal(launch.options.env.PWTEST_CLI_IS_UNDER_TEST, "1");
  assert.ok(launch.args.includes("--load-storage") && launch.args.includes("--save-storage"));
  const source = fs.readFileSync(f.output, "utf8");
  assert.equal((source.match(/^test\(/gm) || []).length, 2);
  assert.equal((source.match(/^import /gm) || []).length, 1);
  for (const boundary of result.boundaries.cases) {
    assert.match(source.split("\n")[boundary.startLine - 1], new RegExp(boundary.id));
    assert.equal(source.split("\n")[boundary.endLine - 1], "});");
  }
  assert.equal(result.boundaries.captureSessions[0].status, "complete");
});

test("empty Enter reprompts without advancing; done records current nonempty case and leaves rest planned", async (t) => {
  const f = fixture(t, 3);
  const result = await f.run([enter([]), enter([click("one")]), enter([click("one"), click("two")], "done\n")]);
  assert.deepEqual(result.recordedIds, ["TC01", "TC02"]);
  assert.deepEqual(result.manifest.testCases.map((entry) => entry.status), ["recorded", "recorded", "planned"]);
  assert.ok(f.state.prompts.some((message) => message.startsWith("Empty boundary")));
  assert.equal(f.state.prompts.filter((message) => message.includes("TC01 -")).length, 2);
});

test("done with empty current case leaves it planned", async (t) => {
  const f = fixture(t);
  const result = await f.run([enter([click("one")]), enter([click("one")], "done\n")]);
  assert.deepEqual(result.recordedIds, ["TC01"]);
  assert.equal(result.manifest.testCases[1].status, "planned");
});

test("done before any actions publishes an empty plan, without using stale working files", async (t) => {
  const f = fixture(t);
  write(path.join(f.folder, ".work/TC01/CSharpGenerationReport.json"), "invalid stale report");
  const result = await f.run([enter([], "done\n")]);
  assert.deepEqual(result.recordedIds, []);
  assert.ok(result.manifest.testCases.every((entry) => entry.status === "planned"));
  const published = publishSession(f.manifestFile);
  assert.ok(published.report.cases.every((entry) => !entry.included));
  assert.equal(fs.readFileSync(f.output, "utf8"), header);
});

test("late shutdown flush belongs to the empty current case, not the preceding completed case", async (t) => {
  const f = fixture(t);
  f.state.onExit = () => write(f.output, raw([click("one"), click("late-current")]));
  const result = await f.run([enter([click("one")]), enter([click("one")], "done\n")]);
  assert.deepEqual(result.recordedIds, ["TC01", "TC02"]);
  assert.equal(result.manifest.testCases[0].actionCount, 1);
  assert.match(fs.readFileSync(path.join(f.folder, ".work/TC02/Code.ts"), "utf8"), /late-current/);
});

test("extra actions after last boundary and during final CLI flush are retained in last case", async (t) => {
  const f = fixture(t, 1);
  f.state.onExit = () => write(f.output, raw([click("one"), click("tail"), click("close-flush")]));
  const result = await f.run([enter([click("one")]), enter([click("one"), click("tail")], "done\n")]);
  assert.equal(result.boundaries.cases[0].rawEndAction, 3);
  assert.equal(result.boundaries.cases[0].boundaryEndAction, 1);
  assert.equal(result.boundaries.cases[0].finalTailActionCount, 2);
  assert.equal(result.manifest.testCases[0].actionCount, 3);
  assert.match(fs.readFileSync(f.output, "utf8"), /close-flush/);
  assert.match(fs.readFileSync(path.join(f.folder, ".work/TC01/Code.ts"), "utf8"), /tail/);
});

test("coalesced fill rewrite fails explicitly, closes child, saves raw/snapshots and restores old source", async (t) => {
  const f = fixture(t), before = header + 'test("TC01 - Case 1", async ({ page }) => {\n  ' + click("old") + "\n});\n";
  write(f.output, before);
  await assert.rejects(f.run([
    enter(["await page.locator('#input').fill('first');"]),
    enter(["await page.locator('#input').fill('coalesced');", click("next")])
  ]), /Completed capture prefix changed/);
  assert.deepEqual(f.state.exits, ["exit\n"]);
  assert.equal(fs.readFileSync(f.output, "utf8"), before);
  const capture = readJson(path.join(f.folder, "boundaries.json")).captureSessions[0];
  assert.equal(capture.status, "failed");
  assert.match(fs.readFileSync(path.join(f.folder, capture.rawFile), "utf8"), /coalesced/);
  assert.match(fs.readFileSync(path.join(f.folder, capture.boundaries[0].snapshotFile), "utf8"), /first/);
  assert.equal(readJson(f.manifestFile).testCases[0].status, "failed: session incomplete");
});

test("prefix rewrites during shutdown are rejected too", async (t) => {
  const f = fixture(t, 1);
  f.state.onExit = () => write(f.output, raw([click("rewritten")]));
  await assert.rejects(f.run([enter([click("original")]), ({ input }) => input.write("done\n")]), /prefix changed/);
  assert.ok(!fs.existsSync(f.output));
});

test("manual early browser close is a failure even with exit code zero", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run([({ state }) => queueMicrotask(() => state.child.emit("close", 0, null))]), /Browser closed before/);
  assert.deepEqual(f.state.exits, []);
  assert.equal(readJson(path.join(f.folder, "boundaries.json")).captureSessions[0].status, "failed");
});

test("EOF triggers explicit cleanup instead of silently completing the case", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run([({ input }) => input.end()]), /Terminal input closed/);
  assert.deepEqual(f.state.exits, ["exit\n"]);
});

test("child launch error fails without hanging on terminal input", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run([({ state }) => queueMicrotask(() => state.child.emit("error", new Error("fixture launch error")))]), /fixture launch error/);
  assert.deepEqual(f.state.exits, []);
});

test("unresponsive child is terminated after bounded graceful-exit attempt", async (t) => {
  const f = fixture(t, 1);
  await assert.rejects(f.run([enter([click("one")]), ({ state, input }) => {
    state.child.stdin.removeAllListeners("finish"); input.write("done\n");
  }]), /did not exit gracefully/);
  assert.equal(f.state.killed, true);
  assert.deepEqual(f.state.exits, ["exit\n"]);
});

test("popup variable dependency blocks dependent case without omitting its source", async (t) => {
  const f = fixture(t), first = ["const page1Promise = page.waitForEvent('popup');", click("open"), "const page1 = await page1Promise;"];
  const result = await f.run([enter(first), enter([...first, "await page1.getByText('Save').click();"], "done\n")]);
  assert.equal(result.manifest.testCases[1].status, "failed: cross-case variable dependency");
  assert.deepEqual(result.boundaries.cases[1].dependencies, ["page1"]);
  assert.match(fs.readFileSync(f.output, "utf8"), /page1.getByText/);
  const published = publishSession(f.manifestFile);
  assert.equal(published.report.cases[1].included, false);
  assert.match(fs.readFileSync(f.output, "utf8"), /TC02 - Case 2/);
  assert.ok(published.report.cases[1].issues.some((issue) => issue.ruleId === "SESSION001"));
});

test("Only replacement preserves unselected combined block, work bytes, status and backups", async (t) => {
  const f = fixture(t);
  f.entries[1].status = "generated";
  write(f.manifestFile, JSON.stringify({ batchId: "Demo", testCases: f.entries }));
  const kept = 'test("TC02 - Case 2", async ({ page }) => {\n  // manual source edit\n  ' + click("unselected-edited") + "\n});";
  const before = header + 'test("TC01 - Case 1", async ({ page }) => {\n  ' + click("old") + "\n});\n\n" + kept + "\n";
  write(f.output, before);
  const work = path.join(f.folder, ".work/TC02/Code.ts"); write(work, "unselected work must not be read for recording");
  const result = await f.run([enter([click("new")], "done\n")], { ids: ["TC01"] });
  assert.ok(fs.readFileSync(f.output, "utf8").includes(kept));
  assert.equal(fs.readFileSync(work, "utf8"), "unselected work must not be read for recording");
  assert.equal(result.manifest.testCases[1].status, "generated");
  const backup = path.join(f.folder, ".work/session", result.sessionId, "Code.ts");
  assert.equal(fs.readFileSync(backup, "utf8"), before);
  // Publication refuses stale unselected evidence rather than erasing edits.
  assert.throws(() => publishSession(f.manifestFile), /TypeScript|ordinary async|No complete/);
  assert.ok(fs.readFileSync(f.output, "utf8").includes(kept));
});

test("rejects unknown combined identities before launch or overwrite", async (t) => {
  const f = fixture(t);
  write(f.output, raw([click("old")]));
  await assert.rejects(f.run([]), /unknown or duplicate/);
  assert.equal(f.state.launches.length, 0);
  assert.equal(fs.readFileSync(f.output, "utf8"), raw([click("old")]));
});

test("complete single-test AST is required; helpers, extra tests and alternate fixtures cannot be dropped", () => {
  assert.throws(() => parseCapture(raw([]) + raw([])), /exactly one|Headers must/);
  assert.throws(() => parseCapture(raw([]) + "const lost = 1;"), /ordinary async/);
  assert.throws(() => parseCapture(raw([]).replace("{ page }", "{ page, context }")), /ordinary async/);
  assert.throws(() => parseCapture(raw([]).slice(0, -4)), /Incomplete/);
});

test("event/debounce flush waits through partial and delayed live writes", async (t) => {
  const f = fixture(t);
  write(f.output, "test(");
  const pending = stableCapture(f.output, { quietMs: 30, timeoutMs: 1000 });
  const writer = setTimeout(() => write(f.output, raw([click("delayed")])), 50);
  t.after(() => clearTimeout(writer));
  const result = await pending;
  assert.equal(result.parsed.statements.length, 1);
  assert.match(result.source, /delayed/);
});

function generatedCase(folder, entry, options = {}) {
  const work = path.join(folder, entry.workFolder), code = fs.readFileSync(path.join(work, "Code.ts"), "utf8");
  const actionLine = code.split("\n").findIndex((line) => line.includes("await page.")) + 1;
  const report = { className: `CodegenFlow${entry.id}`, actionCount: 1, validation: { success: true },
    locatorValidation: { hasFailures: !!options.review, observationCoverage: { status: options.review ? "INCOMPLETE" : "AVAILABLE" } },
    reviewRequired: !!options.review, sourceMap: [{ sourceLine: actionLine, generatedLine: 8 }], unsupportedActions: [] };
  write(path.join(work, "CSharpGenerationReport.json"), JSON.stringify(report));
  write(path.join(work, "Code.cs"), `using Microsoft.Playwright;\nnamespace AutomationFrameWork.CodegenAI\n{\n    public sealed class CodegenFlow${entry.id}\n    {\n        public string Selector => "[TLL ${entry.id}:L${actionLine}]";\n        // [TLL ${entry.id}:L${actionLine}]\n    }\n}\n`);
  write(path.join(work, "TableLocatorMetadata.json"), JSON.stringify({ analyzedActions: 1, transformedActions: 1,
    actions: [{ line: actionLine, locator: "#fixed" }] }));
  return { report, actionLine };
}

test("publication retains blocked TS, projects rewritten snippets once, maps global tags and preserves validator results", async (t) => {
  const f = fixture(t, 3);
  await f.run([enter([click("one")]), enter([click("one"), click("two")]), enter([click("one"), click("two"), click("three")], "done\n")]);
  const manifest = readJson(f.manifestFile);
  manifest.testCases[0].status = "failed: generation blocked";
  write(f.manifestFile, JSON.stringify(manifest));
  const work = path.join(f.folder, ".work/TC02/Code.ts");
  write(work, fs.readFileSync(work, "utf8").replace("#two", "#fixed"));
  const saved = generatedCase(f.folder, manifest.testCases[1], { review: true });
  generatedCase(f.folder, manifest.testCases[2]);
  const result = publishSession(f.manifestFile), combined = fs.readFileSync(f.output, "utf8");
  assert.match(combined, /TC01 - Case 1/);
  assert.match(combined, /#fixed/);
  assert.ok(!combined.includes("#two"));
  assert.deepEqual(result.report.cases.map((entry) => entry.included), [false, true, true]);
  assert.deepEqual(result.report.cases[1].locatorValidation, saved.report.locatorValidation);
  assert.equal(result.report.cases[1].reviewRequired, true);
  const mapped = result.metadata.actions.find((entry) => entry.testCaseId === "TC02");
  assert.match(combined.split("\n")[mapped.line - 1], /#fixed/);
  assert.ok(mapped.line > saved.actionLine);
  assert.match(result.codeCs, new RegExp(`// \\[TLL TC02:L${mapped.line}\\]`));
  assert.ok(result.codeCs.includes(`"[TLL TC02:L${saved.actionLine}]"`), "selector string is not remapped");
  assert.deepEqual(readJson(path.join(f.folder, ".work/TC02/CSharpGenerationReport.json")), saved.report);
  assert.equal(readJson(path.join(f.folder, "boundaries.json")).captureSessions[0].boundaries[0].rawEndLine, 4);
});

// This integration uses the explicitly fake capture child, but the real per-case
// generator, publisher and offline sync. Evidence below is a fixture, not a DOM
// observation. Nothing loads an application or calls a navigation service.
async function generatedSession(t, observed) {
  const f = fixture(t, 3);
  write(path.join(f.folder, "appsettings.json"), '{"Urls":{}}');
  await f.run([
    enter([click("shared")]),
    enter([click("shared"), click("shared")]),
    enter([click("shared"), click("shared"), click("shared")], "done\n")
  ]);
  assert.equal(f.state.launches.length, 1);
  const work = (id, name) => path.join(f.folder, ".work", id, name);
  for (const entry of f.entries) {
    const actions = parseRecordedActions(fs.readFileSync(work(entry.id, "Code.ts"), "utf8"));
    assert.equal(actions.length, 1);
    write(work(entry.id, "TableLocatorMetadata.json"), JSON.stringify({ analyzedActions: 1, transformedActions: 1,
      actions: actions.map((action) => ({ line: action.sourceLine, action: action.actionType, locator: "#shared",
        ...(observed ? { uniqueMatch: true, confidence: 0.98, validation: { success: true } } : {}),
        notes: "Synthetic table provenance for offline integration coverage" })) }));
    if (observed) write(work(entry.id, "LiveObservations.json"), JSON.stringify({ replayVersion: 2,
      actions: actions.map((action) => ({ line: action.sourceLine, raw: action.raw, executionStatus: "succeeded",
        matchCount: 1, tagName: "button", visible: true, enabled: true })) }));
    const result = generateCSharpCode({ projectRoot: f.folder, appSettingsPath: path.join(f.folder, "appsettings.json"),
      codeFilePath: work(entry.id, "Code.ts"), outputFilePath: work(entry.id, "Code.cs"),
      reportFilePath: work(entry.id, "CSharpGenerationReport.json"), tableMetadataPath: work(entry.id, "TableLocatorMetadata.json"),
      domObservationPath: work(entry.id, "LiveObservations.json"), caseId: entry.id, caseTitle: entry.title,
      className: `CodegenFlow${entry.id}`, enterpriseMode: true, enableRepair: false });
    assert.equal(result.codeGenerationBlocked, false);
    assert.equal(result.validation.success, true);
  }
  const source = fs.readFileSync(f.output);
  const published = publishSession(f.manifestFile);
  assert.deepEqual(fs.readFileSync(f.output), source);
  assert.deepEqual(published.errors, []);
  assert.ok(published.report.cases.every((entry) => entry.included));
  assert.equal(published.report.sharedLocators.sharedCount, 1);
  assert.match(published.codeCs, /public sealed class Locators/);
  assert.doesNotMatch(published.codeCs, /public sealed class CodegenFlow/);
  assert.ok(published.report.cases.every((entry) => entry.className === `TestCase${entry.testCaseId}` &&
    entry.internalClassName === `CodegenFlow${entry.testCaseId}`));
  return { ...f, work, published, sync: () => syncSprint(f.manifestFile, { projectRoot: f.folder }) };
}

function assertGlobalProvenance(f, result) {
  const lines = fs.readFileSync(f.output, "utf8").split("\n");
  assert.equal(result.metadata.actions.length, 3);
  const ranges = readJson(path.join(f.folder, "boundaries.json")).cases;
  for (const action of result.metadata.actions) {
    const range = ranges.find((entry) => entry.id === action.testCaseId);
    assert.ok(action.line > range.startLine && action.line < range.endLine);
    assert.ok(lines[action.line - 1].includes(action.locator));
    assert.ok(result.codeCs.includes(`[TLL ${action.testCaseId}:L${action.line}]`));
    const mapped = result.report.sourceMap.filter((entry) => entry.testCaseId === action.testCaseId);
    assert.ok(mapped.some((entry) => entry.sourceLine === action.line));
  }
  // Check every emitted marker too, not just existence of one correct marker.
  for (const match of result.codeCs.matchAll(/\/\/[^\n]*?\[TLL (TC\d+):L(\d+)\]/g)) {
    assert.ok(result.metadata.actions.some((action) => action.testCaseId === match[1] && action.line === Number(match[2])));
  }
  for (const group of [...result.report.sharedLocators.shared, ...result.report.sharedLocators.conflicts]) for (const ref of group.references) {
    const action = result.metadata.actions.find((entry) => entry.testCaseId === ref.testCaseId);
    assert.deepEqual(ref.actionSourceLines, [action.line]);
    assert.deepEqual(ref.tllSourceLines, [action.line]);
  }
}

for (const observed of [true, false]) {
  const baseline = observed ? "saved synthetic observations" : "observation skipped";
  test(`record -> real generation -> publish -> edit -> sync twice, shared moves and global TLL (${baseline})`, async (t) => {
    const f = await generatedSession(t, observed);
    assertGlobalProvenance(f, f.published);
    const capture = readJson(path.join(f.folder, "boundaries.json")).captureSessions;
    const originals = f.entries.map((entry) => fs.readFileSync(f.work(entry.id, "Code.ts")));
    const names = f.entries.map((entry) => readJson(f.work(entry.id, "CSharpGenerationReport.json")).generatedLocators[0].propertyName);
    const syncReadOnly = () => {
      const before = fs.readFileSync(f.output), result = f.sync();
      assert.deepEqual(fs.readFileSync(f.output), before, "sync must not rewrite authoritative source bytes");
      assert.deepEqual(readJson(path.join(f.folder, "boundaries.json")).captureSessions, capture);
      assert.equal(result.report.compilation.status, "UNAVAILABLE", "temp fixture has no framework project; this is not a compile test");
      assertGlobalProvenance(f, result);
      assert.deepEqual(f.entries.map((entry) => readJson(f.work(entry.id, "CSharpGenerationReport.json")).generatedLocators[0].propertyName), names);
      return result;
    };
    const stableRepeat = (previous) => {
      const repeated = syncReadOnly();
      assert.equal(repeated.codeCs, previous.codeCs);
      assert.deepEqual(repeated.report.sharedLocators, previous.report.sharedLocators);
      assert.deepEqual(repeated.metadata.actions, previous.metadata.actions);
      assert.deepEqual([repeated.summary.changed, repeated.summary.added, repeated.summary.removed, repeated.summary.moved], [0, 0, 0, 0]);
      assert.equal(repeated.summary.shared.moved, 0);
      assert.deepEqual(repeated.summary.affectedIds, []);
      assert.deepEqual(repeated.summary.locatorChanges, []);
    };
    // No bootstrap sync: exercise the first edit directly against normal publish
    // history, not history manufactured by SprintSync itself.
    write(f.output, fs.readFileSync(f.output, "utf8").replace("#shared", "#edited"));
    const edited = syncReadOnly();
    assert.equal(edited.summary.changed, 1);
    assert.equal(edited.summary.added, 0);
    assert.equal(edited.summary.removed, 0);
    // The unchanged exact pair stays shared despite the edited historical name.
    assert.equal(edited.report.sharedLocators.sharedCount, 1);
    assert.deepEqual(edited.report.sharedLocators.shared[0].caseIds, ["TC02", "TC03"]);
    assert.equal(edited.report.sharedLocators.shared[0].emittedPropertyName, names[1]);
    assert.equal(edited.report.sharedLocators.conflicts.length, 1);
    assert.equal(edited.summary.shared.removed, 1);
    assert.deepEqual(edited.summary.affectedIds, ["TC01"]);
    assert.deepEqual(edited.summary.locatorChanges, [
      { caseId: "TC01", propertyName: names[0], stepId: "TC01:S1", category: "changed" },
      { caseId: "TC01", propertyName: names[0], stepId: "TC01:S1", category: "movedFromSharedLocators" }
    ]);
    const metadata = edited.metadata.actions.find((entry) => entry.testCaseId === "TC01");
    assert.equal(metadata.locator, "#edited");
    assert.equal(metadata.evidenceStatus, "UNVERIFIED");
    assert.equal(metadata.uniqueMatch, undefined);
    assert.equal(metadata.validation, undefined);
    for (const entry of f.entries) {
      const report = readJson(f.work(entry.id, "CSharpGenerationReport.json"));
      const invalidated = entry.id === "TC01";
      assert.equal(report.sync.evidenceInvalidated, invalidated);
      assert.equal(report.sync.evidenceStatus, invalidated ? "UNVERIFIED" : observed ? "SAVED" : "UNAVAILABLE");
      if (invalidated || !observed) assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
      else assert.deepEqual(fs.readFileSync(f.work(entry.id, "Code.ts")), originals[f.entries.indexOf(entry)]);
    }
    stableRepeat(edited);
    stableRepeat(edited);
    // A second edit restores sharing; both repeats must remain silent/stable.
    write(f.output, fs.readFileSync(f.output, "utf8").replace("#edited", "#shared"));
    const restored = syncReadOnly();
    assert.equal(restored.summary.changed, 1);
    assert.equal(restored.summary.shared.added, 1);
    assert.deepEqual(restored.summary.affectedIds, ["TC01"]);
    assert.deepEqual(restored.summary.locatorChanges, [
      { caseId: "TC01", propertyName: names[0], stepId: "TC01:S1", category: "changed" },
      { caseId: "TC01", propertyName: names[0], stepId: "TC01:S1", category: "movedToSharedLocators" }
    ]);
    stableRepeat(restored);
    stableRepeat(restored);
  });

  test(`first no-op sync after normal publish preserves generated code (${baseline})`, async (t) => {
    const f = await generatedSession(t, observed), source = fs.readFileSync(f.output);
    const first = f.sync();
    assert.deepEqual(fs.readFileSync(f.output), source);
    assert.deepEqual(first.summary.locatorChanges, []);
    assert.deepEqual(first.summary.affectedIds, []);
    assertGlobalProvenance(f, first);
    assert.equal(first.codeCs, f.published.codeCs, "First no-op sync must preserve published C# bytes");
    assert.deepEqual(fs.readFileSync(path.join(f.folder, "Code.cs")), Buffer.from(f.published.codeCs));
    for (const entry of f.entries) {
      const report = readJson(f.work(entry.id, "CSharpGenerationReport.json"));
      assert.equal(report.sync.evidenceInvalidated, false);
      assert.equal(report.sync.evidenceStatus, observed ? "SAVED" : "UNAVAILABLE");
      assert.equal(report.reviewRequired, f.published.report.cases.find((item) => item.testCaseId === entry.id).reviewRequired);
      assert.ok(!report.issues.some((issue) => ["LV015", "SYNC001"].includes(issue.ruleId)));
      if (!observed) {
        assert.equal(report.locatorValidation.observationCoverage.status, "UNAVAILABLE");
        assert.equal(report.locatorValidation.results[0].observedMatchCount, null);
        assert.equal(fs.existsSync(f.work(entry.id, "LiveObservations.json")), false);
      }
    }
    for (let repeat = 0; repeat < 2; repeat++) {
      const next = f.sync();
      assert.equal(next.codeCs, first.codeCs);
      assert.deepEqual(next.summary.locatorChanges, []);
      assert.deepEqual(next.summary.affectedIds, []);
      assert.deepEqual(fs.readFileSync(f.output), source);
    }
  });
}

test("PowerShell Sync and boundary GenerateOnly run before missing config/auth/CSV; legacy remains separate", { skip: process.platform !== "win32" }, (t) => {
  const f = fixture(t), recorder = path.join(f.folder, "CodegenAI"), script = path.join(recorder, "StartCodegen.ps1");
  write(script, fs.readFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), "utf8"));
  const sync = path.join(recorder, "AIRecorder/Generator/SprintSync.cjs"), log = path.join(f.folder, "sync.json");
  write(sync, `require('fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));`);
  const run = (args) => spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args], { encoding: "utf8", timeout: 60000 });
  let result = run(["-Sync", "-BatchName", "Demo", "-StrictLocators"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(readJson(log).includes("--strict-locators"));
  write(path.join(recorder, "Recordings/Demo/boundaries.json"), JSON.stringify({ version: 1, cases: [] }));
  result = run(["-GenerateOnly", "-BatchName", "Demo"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  result = run(["-Sync"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /requires -BatchName/);
  result = run(["-Sync", "-BatchName", "Demo", "-SkipCSharpGeneration"]);
  assert.equal(result.status, 1);
  result = run(["-GenerateOnly", "-BatchName", "Demo", "-DryRun"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /cannot be combined/);
  result = run(["-GenerateOnly", "-BatchName", "Legacy"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Cannot read appsettings/);
});

test("PowerShell recording runs existing per-case table/generator options without extra codegen, then publishes", { skip: process.platform !== "win32" }, (t) => {
  const f = fixture(t), root = path.join(f.folder, "project"), recorder = path.join(root, "CodegenAI"), script = path.join(recorder, "StartCodegen.ps1");
  write(script, fs.readFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), "utf8"));
  write(path.join(root, "appsettings.json"), '{"Urls":{"IReport":"https://example.invalid/"}}');
  const csv = path.join(root, "cases.csv"); write(csv, "TestCaseId,Title\nTC01,Case 1\nTC02,Case 2\n");
  const log = path.join(root, "calls.jsonl"), prelude = `const fs=require('fs'),path=require('path');const args=process.argv.slice(2); const value=k=>args[args.indexOf(k)+1];const log=${JSON.stringify(log)};`;
  write(path.join(recorder, "AIRecorder/auth/SessionManager.ps1"), "function Initialize-CodegenSession {}\nfunction Test-CodegenSessionValid { return $false }\n");
  write(path.join(recorder, "AIRecorder/Generator/SessionRecorder.cjs"), prelude + `
    const real=require(${JSON.stringify(path.join(__dirname, "SessionRecorder.cjs"))});
    if(args.includes('--publish')) { fs.appendFileSync(log, JSON.stringify({stage:'publish'})+'\\n'); real.publishSession(value('--manifest-file')); }
    else {
      fs.appendFileSync(log, JSON.stringify({stage:'record',args})+'\\n');
      const file=value('--manifest-file'),folder=path.dirname(file),m=JSON.parse(fs.readFileSync(file));
      const header=${JSON.stringify(header)};let combined=header;
      for(const e of m.testCases) {
        e.status='recorded';e.recordingSessionId='fake';
        const block='test('+JSON.stringify(e.id+' - '+e.title)+', async ({ page }) => {\\n  await page.locator("#old").click();\\n});';
        fs.writeFileSync(path.join(folder,e.workFolder,'Code.ts'),header+block+'\\n');combined+=block+'\\n\\n';
      }
      fs.writeFileSync(path.join(folder,'Code.ts'),combined);fs.writeFileSync(file,JSON.stringify(m));
      fs.writeFileSync(path.join(folder,'boundaries.json'),JSON.stringify({version:1,latestSessionId:'fake',cases:[],captureSessions:[]}));
    }`);
  write(path.join(recorder, "AIRecorder/Generator/SprintMerger.cjs"), prelude + "if(!args.includes('--review-summary')) throw Error('Legacy merger must not overwrite source');");
  write(path.join(recorder, "AIRecorder/Intelligence/LiveTableLocatorEngine.cjs"), prelude + `
    fs.appendFileSync(log,JSON.stringify({stage:'table',args})+'\\n');
    const file=value('--code-file');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('#old','#fixed'));
  `);
  write(path.join(recorder, "AIRecorder/Generator/CSharpCodeGenerator.cjs"), prelude + `
    fs.appendFileSync(log,JSON.stringify({stage:'generate',args})+'\\n');
    const id=args.find(a=>a.startsWith('--case-id=')).slice(10),name=value('--class-name');
    fs.writeFileSync(value('--output-file'),'using System;\\nnamespace AutomationFrameWork.CodegenAI\\n{\\n    public sealed class '+name+'\\n    {\\n    }\\n}\\n');
    fs.writeFileSync(value('--report-file'),JSON.stringify({className:name,actionCount:1,validation:{success:true},unsupportedActions:[]}));
  `);
  for (const skip of [false, true]) {
    const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-BatchFile", csv, "-BatchName", skip ? "Offline" : "Normal", "-NoPrompt", "-StrictLocators"];
    if (skip) args.push("-SkipLiveObservation");
    fs.rmSync(log, { force: true });
    const result = spawnSync("powershell.exe", args, { encoding: "utf8", timeout: 60000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const calls = fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
    assert.deepEqual(calls.map((call) => call.stage), ["record", "table", "generate", "table", "generate", "publish"]);
    assert.equal(calls[0].args[calls[0].args.indexOf("--url") + 1], "https://example.invalid/");
    for (const call of calls.filter((call) => call.stage === "table")) assert.equal(call.args[call.args.indexOf("--skip-observation") + 1], String(skip));
    for (const call of calls.filter((call) => call.stage === "generate")) assert.ok(call.args.includes("--strict-locators"));
    const combined = fs.readFileSync(path.join(recorder, "Recordings", skip ? "Offline" : "Normal", "Code.ts"), "utf8");
    assert.equal((combined.match(/#fixed/g) || []).length, 2);
  }
  // No-boundary legacy GenerateOnly continues to use the existing offline
  // per-case engine and merger, not the persistent recorder or SprintSync.
  fs.rmSync(path.join(recorder, "Recordings/Offline/boundaries.json"));
  write(path.join(recorder, "AIRecorder/Generator/SprintMerger.cjs"), prelude + `
    if(!args.includes('--review-summary')) require(${JSON.stringify(path.join(__dirname, "SprintMerger.cjs"))}).rebuildSprint(value('--manifest-file'));
  `);
  fs.rmSync(log);
  const legacy = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
    "-BatchFile", csv, "-BatchName", "Offline", "-GenerateOnly"], { encoding: "utf8", timeout: 60000 });
  assert.equal(legacy.status, 0, legacy.stdout + legacy.stderr);
  const calls = fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(calls.map((call) => call.stage), ["table", "generate", "table", "generate"]);
  for (const call of calls.filter((call) => call.stage === "table")) assert.equal(call.args[call.args.indexOf("--skip-observation") + 1], "true");
});

test("installed CLI harmless browser smoke: live output, boundary while open, graceful stdin exit/storage", {
  skip: process.env.SESSION_RECORDER_BROWSER_SMOKE !== "1", timeout: 60000
}, async (t) => {
  const f = fixture(t, 1);
  let child;
  const result = await f.run([
    ({ input }) => input.write("\n"),
    ({ input, state }) => {
      assert.equal(child.exitCode, null);
      assert.match(fs.readFileSync(f.output, "utf8"), /page.goto/);
      assert.ok(fs.existsSync(path.join(f.folder, "boundaries.json")));
      input.write("done\n");
    }
  ], {
    url: "data:text/html,<title>Local recorder smoke</title><button>Harmless</button>",
    saveStorage: path.join(f.folder, "storage.json"), flush: { quietMs: 450, timeoutMs: 20000 }, closeTimeoutMs: 15000,
    env: { PWTEST_CLI_HEADLESS: "1" },
    spawn(exe, args, options) { child = spawn(exe, args, options); return child; }
  });
  assert.deepEqual(result.recordedIds, ["TC01"]);
  assert.equal(child.exitCode, 0);
  assert.ok(fs.existsSync(path.join(f.folder, "storage.json")));
});

// Resolve only after the real CLI writes the expected action. A quiet file alone
// is not an acknowledgement that the browser recorded the latest click.
function waitForRealCapture(file, predicate) {
  return new Promise((resolve, reject) => {
    let watcher, finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); watcher?.close();
      if (error) reject(error); else resolve(value);
    };
    const inspect = () => {
      try {
        const source = fs.readFileSync(file, "utf8"), parsed = parseCapture(source);
        if (predicate(source, parsed)) finish(null, { source, parsed });
      } catch { /* CLI may still be writing its first complete capture. */ }
    };
    const timer = setTimeout(() => finish(new Error("Real CLI did not write the expected recorded action")), 20000);
    watcher = fs.watch(path.dirname(file), (_event, name) => {
      if (!name || String(name) === path.basename(file)) inspect();
    });
    watcher.on("error", finish);
    inspect();
  });
}

test("installed Chromium: three genuine click boundaries in ONE CLI/browser child via local CDP", {
  skip: process.env.SESSION_RECORDER_BROWSER_SMOKE !== "1", timeout: 90000
}, async (t) => {
  const f = fixture(t, 3), { chromium } = require("playwright");
  const preload = path.join(f.folder, "enable-local-cdp.cjs");
  // The sole launch adaptation exposes Chromium's loopback debugging endpoint.
  // It does not replace the browser, recorder, output writer or any action.
  write(preload, `const { chromium } = require(${JSON.stringify(require.resolve("playwright-core"))});
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({ ...options, args: [...(options.args || []), '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'] });
`);
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const prompts = Array.from({ length: 4 }, deferred), endpoint = deferred();
  let child, browser, launches = 0, stderr = "";
  const endpointTimer = setTimeout(() => endpoint.reject(new Error("No local Chromium CDP endpoint")), 20000);
  t.after(() => clearTimeout(endpointTimer));
  // Attach rejection handlers immediately, including failures before CDP connects.
  endpoint.promise.catch(() => {});
  const recording = f.run(prompts.map((prompt) => () => prompt.resolve()), {
    url: "data:text/html," + encodeURIComponent('<title>Local three-boundary smoke</title>' +
      '<button onclick="document.body.dataset.last=this.textContent">First</button>' +
      '<button onclick="document.body.dataset.last=this.textContent">Second</button>' +
      '<button onclick="document.body.dataset.last=this.textContent">Third</button>'),
    saveStorage: path.join(f.folder, "storage.json"), flush: { quietMs: 450, timeoutMs: 20000 }, closeTimeoutMs: 15000,
    env: { PWTEST_CLI_HEADLESS: "1", DEBUG: "pw:browser" },
    spawn(exe, args, options) {
      launches++;
      child = spawn(exe, ["--require", preload, ...args], { ...options, stdio: ["pipe", "ignore", "pipe"] });
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-32768);
        const match = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[\w-]+)/);
        if (match) { clearTimeout(endpointTimer); endpoint.resolve(match[1]); }
      });
      child.once("error", endpoint.reject);
      child.once("close", (code) => endpoint.reject(new Error(`CLI closed before CDP connection (exit ${code})`)));
      return child;
    }
  });
  recording.catch(() => {});
  const whileRecording = (promise) => Promise.race([promise, recording.then(() => { throw new Error("CLI completed before all smoke assertions"); })]);
  try {
    const ws = await whileRecording(endpoint.promise);
    browser = await chromium.connectOverCDP(ws, { timeout: 20000 });
    assert.equal(browser.contexts().length, 1);
    const context = browser.contexts()[0];
    assert.ok(context, "CDP attaches to the CLI's existing browser context");
    const page = context.pages()[0] || await context.waitForEvent("page", { timeout: 20000 });
    await page.waitForURL(/^data:text\/html,/, { timeout: 20000 });
    assert.equal(context.pages().length, 1);
    const cdp = await context.newCDPSession(page), pid = child.pid;
    for (const [index, label] of ["First", "Second", "Third"].entries()) {
      await whileRecording(prompts[index].promise);
      assert.equal(child.pid, pid);
      assert.equal(child.exitCode, null);
      const button = page.getByRole("button", { name: label, exact: true });
      await button.waitFor({ state: "visible", timeout: 20000 });
      const box = await button.boundingBox();
      assert.ok(box);
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Trusted mouse input enters the actual injected recorder. No evaluate()
      // click, private recorder binding, fabricated output or navigation replay.
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
      await page.waitForFunction((expected) => document.body.dataset.last === expected, label, { timeout: 20000 });
      const live = await whileRecording(waitForRealCapture(f.output, (_source, parsed) =>
        parsed.statements.length === index + 2 && parsed.statements.at(-1).getText(parsed.file).includes(label)));
      assert.match(live.parsed.statements.at(-1).getText(live.parsed.file), /\.click\(\)/);
      f.input.write("\n");
      await whileRecording(prompts[index + 1].promise);
      assert.equal(child.exitCode, null, "every boundary is saved before the one browser exits");
      const capture = readJson(path.join(f.folder, "boundaries.json")).captureSessions[0];
      assert.equal(capture.boundaries.length, index + 1);
      assert.equal(capture.boundaries[index].rawEndAction, index + 2);
      const snapshot = fs.readFileSync(path.join(f.folder, capture.boundaries[index].snapshotFile), "utf8");
      assert.equal(parseCapture(snapshot).statements.length, index + 2);
      assert.equal(readJson(f.manifestFile).testCases[index].status, "recorded");
    }
    await cdp.detach();
    f.input.write("done\n");
    const result = await recording;
    assert.equal(launches, 1);
    assert.deepEqual(result.recordedIds, ["TC01", "TC02", "TC03"]);
    assert.equal(child.exitCode, 0);
    assert.equal(result.boundaries.captureSessions[0].status, "complete");
    assert.deepEqual(result.boundaries.cases.map((entry) => entry.actionCount), [2, 1, 1]);
    const combined = fs.readFileSync(f.output, "utf8");
    assert.equal((combined.match(/^test\(/gm) || []).length, 3);
    for (const [index, label] of ["First", "Second", "Third"].entries()) {
      const snippet = fs.readFileSync(path.join(f.folder, `.work/TC0${index + 1}/Code.ts`), "utf8");
      const actions = parseCapture(snippet);
      assert.ok(actions.statements.at(-1).getText(actions.file).includes(label));
      assert.equal(actions.statements.length, index === 0 ? 2 : 1);
    }
    assert.deepEqual(readJson(path.join(f.folder, "storage.json")), { cookies: [], origins: [] });
  } finally {
    // EOF makes recordSession close its own child even after a driver assertion
    // fails. Do not close the attached browser before the CLI can flush/save.
    f.input.end();
    await recording.catch(() => {});
    await browser?.close().catch(() => {});
    clearTimeout(endpointTimer);
  }
});