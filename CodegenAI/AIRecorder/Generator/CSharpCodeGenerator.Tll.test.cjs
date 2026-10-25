const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { generateCSharpCode } = require("./CSharpCodeGenerator.cjs");
const { buildSprint } = require("./SprintMerger.cjs");

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tll-codegen-"));
  const codeFilePath = path.join(root, "Code.ts");
  const metadataPath = path.join(root, "TableLocatorMetadata.json");
  const options = { codeFilePath, projectRoot: root, enableRepair: false,
    outputFilePath: path.join(root, "Code.cs"), reportFilePath: path.join(root, "report.json"),
    className: "CodegenFlowTC01", caseId: "TC01", caseTitle: "Synthetic table flow" };
  const generate = (body, metadata, extra = {}) => {
    const source = `import { test } from '@playwright/test';\ntest('recording', async ({ page }) => {\n${body.join("\n")}\n});\n`;
    fs.writeFileSync(codeFilePath, source);
    if (metadata === undefined) fs.rmSync(metadataPath, { force: true });
    else fs.writeFileSync(metadataPath, typeof metadata === "string" ? metadata : JSON.stringify(metadata));
    const result = generateCSharpCode({ ...options, ...extra });
    assert.equal(fs.readFileSync(codeFilePath, "utf8"), source, "TypeScript must remain byte-identical");
    assert.equal(result.validation.success, true, result.validation.errors.join("; "));
    assert.equal(result.actionFidelity.success, true);
    return result;
  };
  try { run({ root, metadataPath, options, generate }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("both render paths mark matched properties/actions, not other uses of a shared property", () => fixture(({ generate }) => {
  for (const enterpriseMode of [false, true]) {
    const result = generate([
      'await page.locator("#target").click();',
      'await page.locator("#target").fill("synthetic");',
      'await page.locator("#other").click();'
    ], { actions: [{ line: 4, locator: "#target" }, { line: 5, locator: "" }] }, { enterpriseMode });
    assert.match(result.code, /public ILocator Target => Page\.Locator\("#target"\); \/\/ \[TLL TC01:L4\]/);
    assert.match(result.code, /await Target\.FillAsync\("synthetic"\); \/\/ \[TLL TC01:L4\]/);
    assert.doesNotMatch(result.code, /Target\.ClickAsync\(\); \/\/ \[TLL/);
    assert.doesNotMatch(result.code, /Other.*\/\/ \[TLL/);
  }
}));

test("missing, malformed, empty, stale and invalid metadata produce no markers", () => fixture(({ generate }) => {
  for (const metadata of [undefined, "{", { actions: {} }, { actions: [null, { line: 3, locator: " " }] },
    { actions: [{ line: 4, locator: "#target" }] }, { actions: [{ line: 3, locator: "#different" }] }]) {
    assert.doesNotMatch(generate(['await page.locator("#target").click();'], metadata).code, /\[TLL/);
  }
}));

test("explicit metadata path and BOM are supported; missing explicit file does not use stale sibling", () => fixture(({ root, generate }) => {
  const explicit = path.join(root, "custom.json");
  fs.writeFileSync(explicit, '\uFEFF' + JSON.stringify({ actions: [{ line: 3, locator: "#target" }] }));
  const body = ['await page.locator("#target").click();'];
  assert.match(generate(body, undefined, { tableMetadataPath: explicit }).code, /\[TLL TC01:L3\]/);
  assert.doesNotMatch(generate(body, { actions: [{ line: 3, locator: "#target" }] },
    { tableMetadataPath: path.join(root, "missing.json") }).code, /\[TLL/);
}));

test("enterprise popup parameterized fills and framed locators retain markers", () => fixture(({ generate }) => {
  const result = generate([
    "const page1Promise = page.waitForEvent('popup');",
    "await page.getByRole('button', { name: 'Open' }).click();",
    "const page1 = await page1Promise;",
    'await page1.frameLocator("#frame").locator("#target").fill("synthetic");'
  ], { actions: [{ line: 6, locator: "#target" }] }, { enterpriseMode: true });
  assert.match(result.code, /await FillInputAsync\([^\n]+; \/\/ \[TLL TC01:L6\]/);
  assert.match(result.code, /public ILocator [^\n]+FrameLocator[^\n]+; \/\/ \[TLL TC01:L6\]/);
}));

test("download trigger markers survive grouping and sprint merge hash validation", () => fixture(({ generate, options }) => {
  const metadata = { actions: [{ line: 4, locator: "#export" }] };
  const result = generate([
    "const downloadPromise = page.waitForEvent('download');",
    'await page.locator("#export").click();',
    "const download = await downloadPromise;"
  ], metadata);
  assert.match(result.code, /await Export\.ClickAsync\(\); \/\/ \[TLL TC01:L4\]/);
  assert.equal(result.code.split("\n").filter((line) => line.includes("[TLL")).length, 2, "Only property and trigger; not wrapper/closing lines");
  const merged = buildSprint("Synthetic", [{ entry: { id: "TC01", title: "Synthetic", status: "generated" },
    codeTs: fs.readFileSync(options.codeFilePath, "utf8"), codeCs: result.code,
    report: JSON.parse(fs.readFileSync(options.reportFilePath, "utf8")), metadata }]);
  assert.match(merged.codeCs, /await _locators.Export\.ClickAsync\(\); \/\/ \[TLL TC01:L4\]/);
  assert.doesNotMatch(merged.codeTs, /\[TLL/);
}));

test("a changed locator scope or position does not inherit rewrite provenance", () => fixture(({ generate }) => {
  for (const suffix of [".first()", ".filter({ hasText: 'changed' })", ".getByText('changed')"]) {
    const result = generate([`await page.locator("#target")${suffix}.click();`],
      { actions: [{ line: 3, locator: "#target" }] });
    assert.doesNotMatch(result.code, /\[TLL/);
  }
}));

test("marked draft compiles against the real framework without executing the flow", () => fixture(({ generate, root }) => {
  const result = generate(['await page.locator("#syntheticTllTarget").click();'],
    { actions: [{ line: 3, locator: "#syntheticTllTarget" }] }, {
      projectRoot: path.resolve(__dirname, "../../.."),
      domObservationPath: path.join(root, "absent-observations.json")
    });
  assert.equal(result.compilation.success, true, JSON.stringify(result.compilation));
  assert.match(result.code, /\[TLL TC01:L3\]/);
}));

test("legacy marker, case/action isolation, and one warning per unreadable metadata file", () => fixture(({ generate, root }) => {
  const body = ['await page.locator("#target").click();'];
  const metadata = { actions: [{ line: 3, locator: "#target" }] };
  assert.match(generate(body, metadata, { caseId: undefined }).code, /\/\/ \[TLL L3\]/);
  for (const entry of [{ ...metadata.actions[0], testCaseId: "TC02" }, { ...metadata.actions[0], action: "fill" }])
    assert.doesNotMatch(generate(body, { actions: [entry] }).code, /\[TLL/);
  const original = console.log;
  try {
    for (const input of [undefined, "{", { actions: {} }, "directory"]) {
      const messages = [];
      console.log = (message) => messages.push(String(message));
      const result = generate(body, input, input === "directory" ? { tableMetadataPath: root } : {});
      assert.equal(messages.filter((message) => message.startsWith("[TLL] Warning:")).length, 1);
      assert.doesNotMatch(result.code, /\[TLL/);
    }
  } finally { console.log = original; }
}));

test("two-case merge keeps provenance only in the rewritten case", () => fixture(({ generate, options }) => {
  const cases = [];
  for (const id of ["TC01", "TC02"]) {
    const metadata = { analyzedActions: 1, transformedActions: id === "TC01" ? 1 : 0,
      actions: [{ line: 3, action: "click", locator: id === "TC01" ? "#target" : "" }] };
    const result = generate(['await page.locator("#target").click();'], metadata,
      { caseId: id, className: `CodegenFlow${id}` });
    cases.push({ entry: { id, title: "Synthetic", status: "generated" },
      codeTs: fs.readFileSync(options.codeFilePath, "utf8"), codeCs: result.code,
      report: JSON.parse(fs.readFileSync(options.reportFilePath, "utf8")), metadata });
  }
  const merged = buildSprint("Synthetic", cases);
  assert.match(merged.codeCs, /\[TLL TC01:L3\]/);
  assert.doesNotMatch(merged.codeCs, /\[TLL TC02:/);
  assert.doesNotMatch(merged.codeTs, /\[TLL/);
  assert.equal(merged.metadata.transformedActions, 1);
}));

test("rewrite markers do not change strict/default validation or blocking policy", () => fixture(({ root, options, metadataPath }) => {
  const { sprint8Fixture } = require("./CSharpCodeGenerator.Diagnostics.test.cjs");
  const fixture = sprint8Fixture();
  fs.writeFileSync(options.codeFilePath, fixture.source);
  const domObservationPath = path.join(root, "observations.json");
  fs.writeFileSync(domObservationPath, JSON.stringify(fixture.observations));
  for (const strictLocators of [false, true]) {
    fs.writeFileSync(metadataPath, JSON.stringify({ actions: [] }));
    const baseline = generateCSharpCode({ ...options, domObservationPath, strictLocators });
    fs.writeFileSync(metadataPath, JSON.stringify({ actions: [{ line: 13, locator: "#loan-type-arrow" }] }));
    const marked = generateCSharpCode({ ...options, domObservationPath, strictLocators });
    assert.equal(marked.codeGenerationBlocked, baseline.codeGenerationBlocked);
    assert.equal(marked.codeGenerationBlocked, strictLocators);
    assert.equal(marked.reviewRequired, baseline.reviewRequired);
    assert.deepEqual(marked.locatorValidation, baseline.locatorValidation);
    assert.deepEqual(marked.validation, baseline.validation);
    assert.match(marked.code, /\[TLL TC01:L13\]/);
  }
}));