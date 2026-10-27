"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const ts = require("typescript");
const { discover, lowerCase, diagnostic } = require("./BatchAst.cjs");
const { compileGeneratedCSharp, validateGeneratedCSharp } = require("./CSharpCodeGenerator.cjs");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const crlf = text => text.replace(/\r?\n/g, "\r\n");
const json = value => crlf(JSON.stringify(value, null, 2) + "\n");
function fail(message) { throw new Error(message); }
function unlinked(file) {
  for (let p = file; ; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) fail("Linked generation paths are not supported.");
    if (p === path.dirname(p)) break;
  }
}
function projectRoot(folder) {
  for (let p = folder; ; p = path.dirname(p)) {
    if (fs.existsSync(path.join(p, "appsettings.json"))) return p;
    if (p === path.dirname(p)) fail("Cannot infer project root; pass --project-root.");
  }
}
function urlsFrom(text) {
  // JSONC-aware parser; unlike regex comment stripping, quoted URLs stay intact.
  const parsed = ts.parseConfigFileTextToJson("appsettings.json", text);
  if (parsed.error) fail("Cannot parse appsettings URL configuration.");
  const urls = parsed.config?.Urls || {};
  return [...Object.entries(urls), ...Object.entries(urls.Applications || {})]
    .filter(([, value]) => typeof value === "string").map(([key, value]) => ({ key, value }));
}

function checkSnapshots(snapshots) {
  for (const [file, before] of snapshots) {
    unlinked(file);
    const now = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (before === null ? now !== null : now === null || hash(before) !== hash(now)) fail("Publication blocked: inputs or outputs changed concurrently; retry after editing/recording stops.");
  }
}

function transferOrigin(item, currentFile, result, oldBytes, metadata) {
  if (!oldBytes || !result.included || !Array.isArray(metadata?.actions)) return [];
  const old = ts.createSourceFile("old.ts", oldBytes.toString("utf8"), ts.ScriptTarget.Latest, true);
  if (old.parseDiagnostics.length) return [];
  const candidates = old.statements.filter(ts.isExpressionStatement).map(n => n.expression)
    .filter(n => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "test")
    .map(n => n.arguments[1]).filter(n => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isBlock(n.body));
  if (candidates.length !== 1) return [];
  const previous = candidates[0].body, current = item.callback.body;
  if (previous.getText(old).replace(/\r\n/g, "\n") !== current.getText(currentFile).replace(/\r\n/g, "\n")) return [];
  const delta = currentFile.getLineAndCharacterOfPosition(current.getStart(currentFile)).line - old.getLineAndCharacterOfPosition(previous.getStart(old)).line;
  const markers = [];
  for (const origin of metadata.actions) {
    const sourceLine = Number(origin.line) + delta;
    const mappings = result.sourceMap.filter(m => m.sourceLine === sourceLine);
    if (typeof origin.locator !== "string" || !origin.locator || mappings.length !== 1 ||
      !result.locatorOrigins.some(a => a.sourceLine === sourceLine && a.selector === origin.locator)) continue;
    const index = mappings[0].generatedLine - 1;
    // Exactly one statement on the line. Never attach a child marker to an if
    // or step wrapper; duplicate/ambiguous mappings intentionally lose markers.
    if (!result.body[index].endsWith(";") || markers.some(m => m.sourceLine === sourceLine)) continue;
    result.body[index] += ` // [TLL ${item.entry.id}:L${sourceLine}]`;
    markers.push({ sourceLine, evidenceStatus: "UNVERIFIED", provenance: "Exact saved table-locator origin only; no runtime validation transferred." });
  }
  return markers;
}

// Renames are atomic per file, NOT crash-atomic across two files. A cooperative
// exclusive lock serializes generators. Every caught replacement failure rolls
// back via same-volume rename; timestamp backups also support crash recovery.
function publish(folder, staging, artifacts, snapshots, hooks = {}) {
  checkSnapshots(snapshots);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID();
  const backups = [], replaced = [];
  for (const name of artifacts) {
    const target = path.join(folder, name), previous = snapshots.get(target);
    if (previous !== null) {
      const backup = `${target}.${stamp}.bak`;
      fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
      backups.push({ artifact: name, file: path.basename(backup), sha256: hash(previous) });
    }
  }
  checkSnapshots(snapshots);
  try {
    for (const name of artifacts) {
      hooks.beforeReplace?.(name);
      checkSnapshots(snapshots);
      const target = path.join(folder, name);
      fs.renameSync(path.join(staging, name), target);
      replaced.push(name);
      // Output snapshots advance only after our own atomic replacement.
      snapshots.set(target, fs.readFileSync(target));
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const name of replaced.reverse()) {
      const backup = backups.find(b => b.artifact === name), target = path.join(folder, name);
      try {
        if (!backup) fs.rmSync(target, { force: true });
        else {
          const restore = path.join(staging, `${name}.restore`);
          fs.copyFileSync(path.join(folder, backup.file), restore);
          fs.renameSync(restore, target);
        }
      } catch { rollbackErrors.push(name); }
    }
    if (rollbackErrors.length) fail(`Publication and rollback failed for ${rollbackErrors.join(", ")}; recover from timestamp .bak files.`);
    throw error;
  }
  return backups;
}

function generateBatch(manifestPath, options = {}) {
  manifestPath = path.resolve(manifestPath);
  const folder = path.dirname(manifestPath);
  unlinked(folder);
  const lock = path.join(folder, ".stage2a-generate.lock");
  let descriptor;
  try { descriptor = fs.openSync(lock, "wx"); }
  catch { fail("Generation is already locked; do not generate during another generation. A stale lock requires manual inspection."); }
  let staging;
  try {
    const snapshots = new Map();
    const read = file => {
      unlinked(file);
      const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
      snapshots.set(file, bytes); return bytes;
    };
    const readJson = (file, required = false) => {
      const bytes = read(file);
      if (!bytes) { if (required) fail(`Missing required ${path.basename(file)}.`); return null; }
      try { return JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")); }
      catch { fail(`Invalid ${path.basename(file)} JSON.`); }
    };
    const manifest = readJson(manifestPath, true), boundaries = readJson(path.join(folder, "boundaries.json"), true);
    if (boundaries.captureSessions?.some(s => s.status === "recording")) fail("Recording is active; generation must wait for recording to finish.");
    const sourcePath = path.join(folder, "Code.ts"), bytes = read(sourcePath);
    if (!bytes) fail("Missing authoritative Code.ts.");
    const source = bytes.toString("utf8"), discovered = discover(source, manifest, boundaries);
    const root = path.resolve(options.projectRoot || projectRoot(folder));
    const configPath = path.resolve(options.appSettingsPath || path.join(root, "appsettings.json"));
    const config = read(configPath);
    if (!config) fail("Missing appsettings URL configuration.");
    const urls = urlsFrom(config.toString("utf8"));
    const previous = readJson(path.join(folder, "CSharpGenerationReport.json"));
    read(path.join(folder, "Code.cs")); // Manual edits are allowed, snapshotted and backed up.
    read(path.join(folder, "TableLocatorMetadata.json"));
    const cases = [];
    for (const item of discovered.cases) {
      const work = path.join(folder, item.entry.workFolder);
      const old = read(path.join(work, "Code.ts"));
      const evidence = read(path.join(work, "LiveObservations.json"));
      const metadata = readJson(path.join(work, "TableLocatorMetadata.json"));
      read(path.join(work, "CSharpGenerationReport.json"));
      const result = lowerCase(discovered.file, item, { urls, strictLocators: Boolean(options.strictLocators) });
      result.tableLocatorOrigins = transferOrigin(item, discovered.file, result, old, metadata);
      const edited = previous?.sourceHash !== hash(bytes) || !old;
      if (edited || evidence || previous?.reviewRequired) {
        result.diagnostics.push(diagnostic("OBS001", "Runtime claims invalidated/not transferred: edited or unproven AST flow identity. No observation, repair or replay was performed.", item.startLine, "warning"));
        result.reviewRequired = true;
      }
      result.evidenceStatus = "UNVERIFIED";
      result.sourceHash = hash(item.sourceHashInput);
      cases.push(result);
    }
    const lines = ["using System.Threading.Tasks;", "using Microsoft.Playwright;", "using AutomationFrameWork.Utilities;", "", "namespace AutomationFrameWork.CodegenAI", "{"];
    const sourceMap = [];
    for (const c of cases.filter(c => c.included)) {
      if (c.reviewRequired) lines.push("    // REVIEW REQUIRED: see per-case diagnostics; no runtime verification claimed.");
      lines.push(`    public sealed class ${c.className}`, "    {", "        private readonly IPage Page;", "        private readonly ConfigReader Config;",
        `        public ${c.className}(IPage page, ConfigReader config) { Page = page; Config = config; }`, "        public async Task ReplayAsync()", "        {");
      const offset = lines.length;
      lines.push(...c.body.map(s => "            " + s));
      for (const m of c.sourceMap) sourceMap.push({ ...m, testCaseId: c.testCaseId, generatedLine: m.generatedLine + offset });
      lines.push("        }", "    }");
    }
    lines.push("}", "");
    const code = crlf(lines.join("\n"));
    const report = { generator: "STAGE2A-AST", version: 1, batchId: manifest.batchId, generatedAtUtc: new Date().toISOString(),
      sourceHash: hash(bytes), generatedCodeHash: hash(code), strictLocators: Boolean(options.strictLocators),
      reviewRequired: cases.some(c => c.reviewRequired), codeGenerationBlocked: !cases.some(c => c.included),
      sourceMap, cases: cases.map(({ body, sourceMap, locatorOrigins, ...c }) => c),
      publication: { atomicity: "Per-file atomic rename with rollback on caught failure; not cross-file crash atomic.", backupPattern: "<artifact>.<UTC timestamp>-<UUID>.bak" } };
    if (report.codeGenerationBlocked) return { exitCode: 1, report, code: "", backups: [] };
    // Reuse structural infrastructure on a literal-masked projection: its legacy
    // brace/TS-token regex must not interpret user string contents as C# code.
    const { maskCSharp } = require("./SharedLocators.cjs");
    report.validation = validateGeneratedCSharp(maskCSharp(code), []);
    if (!report.validation.success) fail("Structural C# validation failed; outputs preserved.");
    staging = fs.mkdtempSync(path.join(folder, ".stage2a-"));
    fs.writeFileSync(path.join(staging, "Code.cs"), code);
    // Dependency injection is programmatic testing only; the CLI always uses
    // the real existing compiler and never accepts a skip/unavailable outcome.
    report.compilation = (options.compile || compileGeneratedCSharp)(fs.readFileSync(path.join(staging, "Code.cs"), "utf8"), { projectRoot: root });
    if (report.compilation?.success !== true) fail("Aggregate C# compilation did not succeed; outputs preserved. " + (report.compilation?.errors || []).join(" | "));
    fs.writeFileSync(path.join(staging, "CSharpGenerationReport.json"), json(report));
    options.beforePublish?.();
    const backups = publish(folder, staging, ["Code.cs", "CSharpGenerationReport.json"], snapshots, options);
    return { exitCode: cases.every(c => c.included) ? 0 : 2, report, code, backups };
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true });
    fs.closeSync(descriptor); fs.rmSync(lock, { force: true });
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2), values = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--strict-locators") values.strictLocators = true;
      else if (["--manifest-file", "--project-root", "--appsettings-file"].includes(arg) && args[i + 1] && !args[i + 1].startsWith("--")) values[arg] = args[++i];
      else fail("Unknown/missing argument. Generation always covers all tests; --only is not supported.");
    }
    if (!values["--manifest-file"]) fail("Required: --manifest-file.");
    const result = generateBatch(values["--manifest-file"], { projectRoot: values["--project-root"], appSettingsPath: values["--appsettings-file"], strictLocators: values.strictLocators });
    for (const c of result.report.cases) {
      console.log(`[STAGE2A] ${c.testCaseId}: ${c.status}${c.titleChanged ? " (title changed; stable ID retained)" : ""}`);
      for (const d of c.diagnostics) console.log(`[STAGE2A] ${c.testCaseId} line=${d.sourceLine ?? "n/a"} ${d.code || d.ruleId || d.kind}: ${d.kind === "locatorValidation" ? "Deterministic locator finding; inspect the local per-case report." : d.message}`);
    }
    console.log(`[STAGE2A] exit=${result.exitCode}; generated=${result.report.cases.filter(c => c.included).length}; refused=${result.report.cases.filter(c => !c.included).length}; compilation=${result.report.compilation?.status || "NOT RUN"}`);
    process.exitCode = result.exitCode;
  } catch (error) {
    // Avoid echoing raw source, paths or compiler diagnostics containing inputs.
    console.log(`[STAGE2A] Publication blocked: ${/^(ID001|GEN00[12]|REC002):/.exec(error.message)?.[0] || "generation error"}. ${/concurrent|locked|Recording is active|compilation|Missing required|Missing authoritative/.exec(error.message)?.[0] || "Inspect manifest, syntax and configuration; existing outputs preserved"}`);
    process.exitCode = 1;
  }
}

module.exports = { generateBatch, checkSnapshots, urlsFrom };