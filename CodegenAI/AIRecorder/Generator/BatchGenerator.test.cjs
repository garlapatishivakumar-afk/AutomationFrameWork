"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { discover, lowerCase } = require("./BatchAst.cjs");
const { generateBatch } = require("./BatchGenerator.cjs");
const { compileGeneratedCSharp } = require("./CSharpCodeGenerator.cjs");
const root = path.resolve(__dirname, "../../..");
const url = "https://example.invalid/deals";
const urls = [{ key: "Deals", value: url }];
const goto = `await page.goto('${url}');`;
const wrap = (body, id = "TC01", title = "Deals") => `test('${id} - ${title}', async ({ page }) => {\n${body}\n});\n`;
const manifest = (ids = ["TC01"]) => ({ batchId: "Deals", testCases: ids.map(id => ({ id, title: "Deals", status: "recorded", workFolder: `.work/${id}` })) });
const boundaries = ids => ({ version: 1, cases: ids.map(id => ({ id, title: "Deals" })) });
function lower(body, options = {}) {
  const found = discover(wrap(body), manifest(), boundaries(["TC01"]));
  return lowerCase(found.file, found.cases[0], { urls, ...options });
}
function fixture(t, bodies = [goto, `${goto}\nconst text = await page.locator('#status').innerText();`]) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "stage2a-deals-"));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const ids = bodies.map((_, i) => `TC0${i + 1}`);
  const write = (name, data) => fs.writeFileSync(path.join(folder, name), data);
  write("manifest.json", JSON.stringify(manifest(ids))); write("boundaries.json", JSON.stringify(boundaries(ids)));
  write("Code.ts", "\uFEFFimport { test, expect } from '@playwright/test';\r\n" + bodies.map((b, i) => wrap(b, ids[i]).replace(/\n/g, "\r\n")).join("\r\n"));
  write("appsettings.json", JSON.stringify({ Urls: { Applications: { Deals: url } } }));
  write("Code.cs", "// manually edited prior draft\r\n"); write("CSharpGenerationReport.json", '{"previous":true}\r\n');
  const options = { projectRoot: root, appSettingsPath: path.join(folder, "appsettings.json"), compile: () => ({ success: true, status: "TEST_DOUBLE" }) };
  const run = more => generateBatch(path.join(folder, "manifest.json"), { ...options, ...more });
  const read = name => fs.readFileSync(path.join(folder, name));
  return { folder, read, write, run, options };
}

const matchers = { toBeVisible: "", toBeHidden: "", toBeEnabled: "", toBeDisabled: "", toBeEditable: "", toBeChecked: "",
  toHaveText: "'Ready'", toContainText: "'Ready'", toHaveValue: "'Ready'", toHaveAttribute: "'data-status', 'Ready'", toHaveCount: "1", toHaveURL: `'${url}'` };
for (const [matcher, args] of Object.entries(matchers)) for (const not of [false, true]) {
  test(`AST assertion ${not ? "not " : ""}${matcher}`, () => {
    const c = lower(`${goto}\nawait expect(${matcher === "toHaveURL" ? "page" : "page.locator('#status')"})${not ? ".not" : ""}.${matcher}(${args});`);
    assert.equal(c.included, true, JSON.stringify(c.diagnostics));
    assert.match(c.body.join("\n"), new RegExp(`Assertions.Expect\\(.+\\)${not ? "\\.Not" : ""}\\.${matcher[0].toUpperCase() + matcher.slice(1)}Async`));
  });
}
for (const predicate of ["isVisible", "isChecked", "isDisabled", "isEnabled", "isEditable"]) for (const not of [false, true]) {
  test(`AST branch ${not ? "!" : ""}${predicate}, rows/has/positions/step`, () => {
    const c = lower(`${goto}
const row = page.getByRole('row').filter({ hasText: 'Deal A', has: page.getByRole('cell', { name: 'Active' }) }).nth(0);
if (${not ? "!" : ""}await row.isVisible()) { await row.getByRole('button', { name: 'Open' }).click(); }
if (${not ? "!" : ""}await row.${predicate}()) {
  await test.step('Check row', async () => { const status = row.locator('.status').first(); await expect(status).toHaveText('Active'); });
} else { await expect(row.locator('.status').last()).not.toContainText('Active'); }`);
    assert.equal(c.included, true, JSON.stringify(c.diagnostics));
    assert.ok(c.diagnostics.some(d => d.code === "GEN003"));
    assert.match(c.body.join("\n"), /Filter\(new\(\).*HasText = "Deal A".*Has = Page.GetByRole/);
    assert.match(c.body.join("\n"), /test.step lexical scope only/);
    assert.match(c.body.join("\n"), /else\n\{/);
  });
}

for (const body of [
  "const text = await page.locator('#status').innerText();",
  "if ((await page.locator('#status').innerText()) === 'Ready') { await page.locator('#ok').click(); }",
  "for (const x of [1]) { await page.locator('#ok').click(); }",
  "function helper() {}", "try { await page.locator('#ok').click(); } catch {}",
  "await page.evaluate(() => 1);", "await page.locator(`#status`).click();",
  "await page.locator('#status').click({ force: true });", "page.locator('#ok').click();",
  "return;", "console.log('unhandled');", "const value = 42;", "await expect(page.locator('#a')).toHaveText('x', { timeout: 1 });"
]) test(`whole refusal: ${body.split(" ").slice(0, 3).join(" ")}`, () => {
  const c = lower(`${goto}\n${body}\nawait page.locator('#after').click();`);
  assert.equal(c.included, false); assert.deepEqual(c.body, []); assert.deepEqual(c.sourceMap, []);
  assert.ok(c.diagnostics.some(d => d.code === "GEN001"));
});

test("navigation guarantee is not borrowed from conditional/other tests; literal arrows are data", () => {
  for (const body of ["await page.locator('#a').click();", `if (await page.locator('#a').isVisible()) { ${goto} }`, "const p = page.waitForEvent('popup');"]) {
    assert.ok(lower(body).diagnostics.some(d => d.code === "REC001"));
  }
  const valid = lower(`${goto}\n// ; -> comment\n/* ; -> comment */\nawait page.getByText('a; -> b').fill('x; -> y');`);
  assert.equal(valid.included, true, JSON.stringify(valid.diagnostics));
  const bad = lower(`${goto}\nawait page.locator('#a').click(); -> expected ready\nawait page.locator('#b').click();`);
  assert.equal(bad.included, false); assert.ok(bad.diagnostics.some(d => d.code === "REC002"));
  for (const expression of ["`before ${1} ; -> after`", "/; ->/"]) {
    const c = lower(`${goto}\nconst unsupported = ${expression};`);
    assert.ok(c.diagnostics.some(d => d.code === "GEN001"));
    assert.ok(!c.diagnostics.some(d => d.code === "REC002"));
  }
});

test("lexical shadowing and parenthesized negation preserve scope; optional execution is refused", () => {
  const c = lower(`${goto}\nconst row = page.locator('#outer');\nawait test.step('inner', async () => { const row = page.locator('#inner'); if (!(await row.isVisible())) { await expect(row).toBeHidden(); } });\nawait row.click();`);
  assert.equal(c.included, true, JSON.stringify(c.diagnostics));
  assert.match(c.body.join("\n"), /var v1 = Page.Locator\("#outer"\)/);
  assert.match(c.body.join("\n"), /var v2 = Page.Locator\("#inner"\)/);
  assert.equal(c.body.at(-1), "await v1.ClickAsync();");
  assert.equal(lower(`${goto}\nawait page.locator('#x')?.click();`).included, false);
  for (const body of [
    "const row = page.locator('#outer'); { await row.click(); const row = page.locator('#inner'); }",
    "const row = page.locator('#outer'); { const row = row.locator('#inner'); }",
    "await page.locator('#x').nth(1.5).click();", "await expect(page.locator('#x')).toHaveCount(1.5);"
  ]) assert.equal(lower(`${goto}\n${body}`).included, false);
});

test("stable ID permits title changes; unknown, duplicate, missing and colliding identities block", () => {
  const c = discover(wrap(goto, "TC01", "Renamed title"), manifest(), boundaries(["TC01"])).cases[0];
  assert.equal(c.titleChanged, true);
  for (const source of [wrap(goto, "UNKNOWN"), wrap(goto) + wrap(goto), ""]) assert.throws(() => discover(source, manifest(), boundaries(["TC01"])), /ID001/);
  assert.throws(() => discover(wrap(goto), manifest(["TC-1", "TC_1"]), boundaries([])), /ID001/);
});

test("async function test/step callbacks and grouped predicates retain their bodies", () => {
  const source = `test('TC01 - Deals', async function ({ page }) { ${goto}\nawait test.step('Check', async function () { if (await (page.locator('#x').isVisible())) { await expect(page.locator('#x')).toBeVisible(); } }); });`;
  const d = discover(source, manifest(), boundaries(['TC01']));
  const c = lowerCase(d.file, d.cases[0], { urls });
  assert.equal(c.included, true, JSON.stringify(c.diagnostics));
  assert.ok(c.body.some(s => s.includes('ToBeVisibleAsync')));
});

test("interior syntax refusal continues; uncertain boundary syntax blocks publication", () => {
  const source = wrap(`${goto}\nconst broken = ;`) + wrap(goto, "TC02");
  const d = discover(source, manifest(["TC01", "TC02"]), boundaries(["TC01", "TC02"]));
  assert.equal(lowerCase(d.file, d.cases[0], { urls }).included, false);
  assert.ok(d.cases[0].diagnostics.some(d => d.code === "GEN002"));
  assert.equal(lowerCase(d.file, d.cases[1], { urls }).included, true);
  assert.throws(() => discover(`test('TC01 - Deals', async ({page}) => {\n${goto}\n` + wrap(goto, "TC02"), manifest(["TC01", "TC02"]), boundaries(["TC01", "TC02"])), /GEN002|ID001/);
});

test("existing deterministic validator failures retain tiered vs strict policy", () => {
  const body = `${goto}\nawait page.locator('/html/body/div[1]').click();`;
  const tiered = lower(body), strict = lower(body, { strictLocators: true });
  assert.equal(tiered.locatorValidation.hasFailures, true);
  assert.equal(tiered.included, true); assert.equal(tiered.reviewRequired, true);
  assert.deepEqual(strict.locatorValidation, tiered.locatorValidation); assert.equal(strict.included, false);
});

test("partial publication backs up manual C# and report; source/identity artifacts remain byte-identical", t => {
  const f = fixture(t), before = new Map(["Code.ts", "manifest.json", "boundaries.json", "Code.cs", "CSharpGenerationReport.json"].map(n => [n, f.read(n)]));
  const r = f.run(); assert.equal(r.exitCode, 2);
  assert.equal(r.report.cases[1].status, "refused"); assert.ok(!r.code.includes("TestCaseTC02")); assert.ok(!r.code.includes("NotSupportedException"));
  assert.equal(r.backups.length, 2);
  for (const b of r.backups) { assert.match(b.file, /\.\d{4}-.*\.bak$/); assert.deepEqual(f.read(b.file), before.get(b.artifact)); }
  for (const n of ["Code.ts", "manifest.json", "boundaries.json"]) assert.deepEqual(f.read(n), before.get(n));
  assert.ok(r.report.cases.every(c => c.evidenceStatus === "UNVERIFIED"));
  for (const m of r.report.sourceMap) assert.ok(r.code.split(/\r?\n/)[m.generatedLine - 1].trim());
});

test("all refused and failed/unavailable compile preserve both prior artifacts", t => {
  const f = fixture(t), before = [f.read("Code.cs"), f.read("CSharpGenerationReport.json")];
  for (const compilation of [{ success: false, errors: ["fixture failure"] }, { success: null }, {}]) {
    assert.throws(() => f.run({ compile: () => compilation }), /compilation/);
    assert.deepEqual(f.read("Code.cs"), before[0]); assert.deepEqual(f.read("CSharpGenerationReport.json"), before[1]);
  }
  f.write("Code.ts", wrap("const text = 42;") + wrap("const text = 42;", "TC02"));
  assert.equal(f.run().exitCode, 1);
  assert.deepEqual(f.read("Code.cs"), before[0]); assert.deepEqual(f.read("CSharpGenerationReport.json"), before[1]);
});

test("concurrent source, manifest, boundary, configuration and manual C# edits block publication", t => {
  for (const name of ["Code.ts", "manifest.json", "boundaries.json", "appsettings.json", "Code.cs", "CSharpGenerationReport.json"]) {
    const f = fixture(t), previous = f.read(name), code = f.read("Code.cs"), report = f.read("CSharpGenerationReport.json");
    assert.throws(() => f.run({ beforePublish: () => f.write(name, Buffer.concat([previous, Buffer.from(" ")])) }), /concurrent/);
    if (name !== "Code.cs") assert.deepEqual(f.read("Code.cs"), code);
    if (name !== "CSharpGenerationReport.json") assert.deepEqual(f.read("CSharpGenerationReport.json"), report);
  }
});

test("second-artifact replacement failure rolls back first; lock prevents simultaneous generation", t => {
  const f = fixture(t), code = f.read("Code.cs"), report = f.read("CSharpGenerationReport.json");
  assert.throws(() => f.run({ beforeReplace: name => { if (name.endsWith(".json")) throw new Error("fixture rename failure"); } }), /fixture rename/);
  assert.deepEqual(f.read("Code.cs"), code); assert.deepEqual(f.read("CSharpGenerationReport.json"), report);
  f.write(".stage2a-generate.lock", ""); assert.throws(() => f.run(), /locked/);
  fs.rmSync(path.join(f.folder, ".stage2a-generate.lock"));
  const b = JSON.parse(f.read("boundaries.json")); b.captureSessions = [{ status: "recording" }]; f.write("boundaries.json", JSON.stringify(b));
  assert.throws(() => f.run(), /Recording is active/);
});

test("TLL transfers exact origin only; edited bodies lose markers and invalidate runtime claims", t => {
  const body = `${goto}\nawait page.locator('//tr[@data-id="deal"]').click();`, f = fixture(t, [body]);
  const work = path.join(f.folder, '.work/TC01'); fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(work, 'Code.ts'), wrap(body));
  fs.writeFileSync(path.join(work, 'TableLocatorMetadata.json'), JSON.stringify({ actions: [{ line: 3, locator: '//tr[@data-id="deal"]', uniqueMatch: true }] }));
  fs.writeFileSync(path.join(work, 'LiveObservations.json'), JSON.stringify({ actions: [{ line: 3, matchCount: 1 }] }));
  const before = fs.readFileSync(path.join(work, 'TableLocatorMetadata.json'));
  const r = f.run(); assert.equal(r.exitCode, 0); assert.match(r.code, /\[TLL TC01:L4\]/);
  assert.equal(r.report.cases[0].tableLocatorOrigins[0].evidenceStatus, 'UNVERIFIED');
  assert.equal(r.report.cases[0].locatorValidation.observationCoverage.status, 'UNAVAILABLE');
  f.write('Code.ts', f.read('Code.ts').toString().replace('data-id="deal"', 'data-id="other"'));
  const changed = f.run(); assert.ok(!changed.code.includes('[TLL'));
  assert.ok(changed.report.cases[0].diagnostics.some(d => d.code === 'OBS001'));
  assert.deepEqual(fs.readFileSync(path.join(work, 'TableLocatorMetadata.json')), before);
});

const fullSupportedBody = `${goto}
const row = page.getByRole('row').filter({ hasText: 'Deal A', has: page.getByRole('cell', { name: 'Active' }) }).nth(0);
await test.step('Deal review', async () => { const status = row.locator('.status'); await expect(status).toHaveText('Active'); });
${Object.entries(matchers).flatMap(([m, a]) => [false, true].map(not => `await expect(${m === "toHaveURL" ? "page" : "row"})${not ? ".not" : ""}.${m}(${a});`)).join("\n")}
${["isVisible", "isChecked", "isDisabled", "isEnabled", "isEditable"].map(p => `if (!await row.${p}()) { await row.click(); } else { await expect(row).toBeVisible(); }`).join("\n")}
const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Open' }).click();
const popup = await popupPromise;
await popup.frameLocator('#outer').frameLocator('#inner').getByAltText('Logo').click();
await popup.locator('iframe').contentFrame().locator('#field').fill('value');
const downloadPromise = popup.waitForEvent('download');
await popup.getByText('Export').click();
const download = await downloadPromise;
await download.saveAs('report.csv');
await page.keyboard.press('Enter'); await page.keyboard.type('value'); await page.keyboard.insertText('value'); await page.keyboard.down('Shift'); await page.keyboard.up('Shift');
await page.mouse.click(10.5, 20.25); await page.mouse.dblclick(10, 20); await page.mouse.move(10, 20);
await page.waitForSelector('#ready');
${["click", "dblclick", "hover", "check", "uncheck", "focus", "waitFor"].map(m => `await row.${m}();`).join("\n")}
${["fill", "press", "selectOption", "setInputFiles"].map(m => `await row.${m}('value');`).join("\n")}`;

test("real aggregate compile: Deals-like supported + innerText-refused exit2 with verified backups", { timeout: 240000 }, t => {
  const f = fixture(t, [fullSupportedBody, `${goto}\nconst value = await page.locator('#status').innerText();`]);
  const source = f.read("Code.ts"), code = f.read("Code.cs"), report = f.read("CSharpGenerationReport.json");
  const r = f.run({ compile: compileGeneratedCSharp });
  assert.equal(r.exitCode, 2); assert.equal(r.report.compilation.success, true);
  assert.equal(r.report.compilation.status, "PASSED");
  assert.deepEqual(f.read("Code.ts"), source);
  assert.deepEqual(f.read(r.backups.find(b => b.artifact === "Code.cs").file), code);
  assert.deepEqual(f.read(r.backups.find(b => b.artifact.endsWith(".json")).file), report);
  const cli = spawnSync(process.execPath, [path.join(__dirname, "BatchGenerator.cjs"), "--manifest-file", path.join(f.folder, "manifest.json"), "--project-root", root, "--appsettings-file", path.join(f.folder, "appsettings.json")], { encoding: "utf8", timeout: 180000 });
  assert.equal(cli.status, 2, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /compilation=PASSED/);
  assert.deepEqual(f.read("Code.ts"), source);
  t.diagnostic(`Real compile PASSED; exit2; ${r.report.sourceMap.length} source mappings; two timestamp backups verified; TS byte-identical.`);
});

test("real failed compile leaves old artifacts intact", { timeout: 240000 }, t => {
  const f = fixture(t, [goto]), code = f.read("Code.cs"), report = f.read("CSharpGenerationReport.json");
  assert.throws(() => f.run({ compile: (draft, options) => compileGeneratedCSharp(draft + "\ninvalid CSharp", options) }), /compilation/);
  assert.deepEqual(f.read("Code.cs"), code); assert.deepEqual(f.read("CSharpGenerationReport.json"), report);
});

test("CLI exit0/exit2 and aliases route to AST before auth/config/CSV; Only rejected", { skip: process.platform !== "win32", timeout: 240000 }, t => {
  const f = fixture(t, [goto]);
  const cli = spawnSync(process.execPath, [path.join(__dirname, "BatchGenerator.cjs"), "--manifest-file", path.join(f.folder, "manifest.json"), "--project-root", root, "--appsettings-file", path.join(f.folder, "appsettings.json")], { encoding: "utf8", timeout: 180000 });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  const recorder = path.join(f.folder, "CodegenAI"), tools = path.join(recorder, "AIRecorder/Generator"), batch = path.join(recorder, "Recordings/Deals");
  fs.mkdirSync(tools, { recursive: true }); fs.mkdirSync(batch, { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, "../../StartCodegen.ps1"), path.join(recorder, "StartCodegen.ps1"));
  fs.writeFileSync(path.join(batch, "boundaries.json"), "{}");
  fs.writeFileSync(path.join(tools, "BatchGenerator.cjs"), "console.log('AST ROUTE');process.exitCode=2;");
  fs.writeFileSync(path.join(tools, "SprintSync.cjs"), "throw new Error('OLD SYNC MUST NOT RUN');");
  const run = flags => spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(recorder, "StartCodegen.ps1"), "-BatchName", "Deals", "-TargetUrl", " ", ...flags], { encoding: "utf8", timeout: 60000 });
  for (const mode of ["-Generate", "-GenerateOnly", "-Sync"]) {
    const r = run([mode]); assert.equal(r.status, 2, r.stdout + r.stderr); assert.match(r.stdout, /AST ROUTE/);
    if (mode !== "-Generate") assert.match(r.stdout, /Migration/);
    assert.equal(run([mode, "-Only", "TC01"]).status, 1);
  }
});