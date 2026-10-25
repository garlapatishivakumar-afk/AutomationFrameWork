"use strict";

// Offline, transactional projection of the user's combined Code.ts. Never run
// a recorder, observer, table engine or repair provider from this module.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createHash, randomUUID } = require("crypto");
const ts = require("typescript");
const { generateCSharpCode, parseRecordedActions, compileGeneratedCSharp,
  validateGeneratedCSharp, collectGenerationIssues, addReviewHeader, safeDiagnosticText } = require("./CSharpCodeGenerator.cjs");
const { buildSprint, mergeMetadata } = require("./SprintMerger.cjs");
const { extractOriginalLocator, maskCSharp } = require("./SharedLocators.cjs");

const normalize = (value) => String(value).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
// Capture snippets may retain extra final newlines that AST extraction omits.
// Compare the rest exactly: selector/input whitespace and source-line positions
// must not be normalized away when deciding whether saved evidence is stale.
const evidenceSource = (value) => value === null ? null : value.replace(/(?:\r?\n)+$/, "");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const draftHash = (value) => hash(normalize(value));
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const titleOf = (entry) => `${entry.id} - ${entry.title}`;
const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;
const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const canonical = (text) => {
  const file = ts.createSourceFile("step.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return printer.printFile(file).trim();
};

function fail(message) {
  const error = new Error(message);
  error.code = "SPRINT_SYNC_BLOCKED";
  throw error;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest.batchId !== "string" || !manifest.batchId.trim() || !Array.isArray(manifest.testCases)) fail("Invalid batch manifest.");
  const ids = new Set(), classes = new Set();
  for (const entry of manifest.testCases) {
    if (!entry || typeof entry.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(entry.id) ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(entry.id) || ids.has(entry.id.toLowerCase())) fail("Invalid or duplicate manifest case ID.");
    const className = `CodegenFlow${entry.id.replace(/-/g, "_")}`;
    if (classes.has(className)) fail("Manifest case IDs produce duplicate C# classes.");
    ids.add(entry.id.toLowerCase()); classes.add(className);
    if (entry.workFolder !== `.work/${entry.id}` || typeof entry.title !== "string" || !entry.title.trim() ||
      !/^(planned|skipped|recorded|generated|failed: .+)$/.test(entry.status)) fail(`${entry.id}: invalid manifest title, status or workFolder.`);
  }
}

/** Named AST blocks are identity; saved line numbers are never used to slice. */
function extractCases(source, manifest, boundaries = null) {
  validateManifest(manifest);
  const byId = new Map(manifest.testCases.map((entry) => [entry.id, entry]));
  const required = new Set(manifest.testCases.filter((entry) => !["planned", "skipped"].includes(entry.status)).map((entry) => entry.id));
  if (boundaries !== null) {
    if (boundaries.version !== 1 || !Array.isArray(boundaries.cases)) fail("Expected boundaries.json version 1 with cases[].");
    const seen = new Set();
    for (const item of boundaries.cases) {
      if (!item || !byId.has(item.id) || seen.has(item.id) || item.title !== byId.get(item.id).title) fail("Unknown, duplicate or mismatched case in saved boundaries.");
      seen.add(item.id); required.add(item.id);
    }
  }
  const file = ts.createSourceFile("Code.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) fail(`Invalid combined TypeScript: ${ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, " ")}`);
  const blocks = [];
  let useCount = 0;
  for (const statement of file.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
    if (ts.isImportDeclaration(statement) || call?.expression.getText(file) === "test.use") {
      if (blocks.length) fail("Imports and test.use must precede all test blocks.");
      if (call && ++useCount > 1) fail("Multiple test.use headers are ambiguous.");
      continue;
    }
    if (!call || !ts.isIdentifier(call.expression) || call.expression.text !== "test") fail("Only imports, test.use and ordinary test() blocks are supported; helpers/hooks cannot be silently dropped.");
    const title = call.arguments[0], callback = call.arguments[call.arguments.length - 1];
    if (!title || !ts.isStringLiteralLike(title) || !callback ||
      !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) || !ts.isBlock(callback.body)) fail("Expected a literal named test with a block callback.");
    // Full merger-format names take precedence. Legacy manifest titles are
    // accepted only when uniquely identifiable; 'test' is not an identity.
    let matches = manifest.testCases.filter((entry) => titleOf(entry) === title.text);
    if (!matches.length) matches = manifest.testCases.filter((entry) => entry.title === title.text);
    if (matches.length !== 1) fail(`Unknown or ambiguous test title: ${safeDiagnosticText(title.text)}`);
    const entry = matches[0];
    if (blocks.some((item) => item.entry.id === entry.id)) fail(`${entry.id}: duplicate test block.`);
    if (entry.status === "skipped") fail(`${entry.id}: skipped manifest case has a test block.`);
    blocks.push({ entry, statement, callback, start: statement.getStart(file), end: statement.end });
  }
  for (const id of required) if (!blocks.some((item) => item.entry.id === id)) fail(`${id}: missing test block. No outputs were changed.`);
  if (!blocks.length) fail("Combined Code.ts contains no cases to sync.");
  const header = source.slice(0, blocks[0].start);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return blocks.map(({ entry, start, end, callback }) => {
    const codeTs = header + source.slice(start, end) + newline;
    const startLine = lineAt(source, start), endLine = lineAt(source, end);
    const localStart = lineAt(header, header.length);
    const mapping = new Map();
    for (let line = localStart; line <= localStart + endLine - startLine; line++) {
      mapping.set(line, { line: startLine + line - localStart, relativeLine: line - localStart + 1 });
    }
    // The underlying generator is line-oriented. Explicitly refuse AST
    // statements it would omit (e.g. several actions on one physical line).
    const actions = parseRecordedActions(codeTs);
    const bodyStatements = callback.body.statements.filter((node) => !ts.isEmptyStatement(node));
    const positions = bodyStatements.map((node) => lineAt(source, node.getStart(file)) - startLine + localStart);
    if (bodyStatements.some((node) => lineAt(source, node.getStart(file)) !== lineAt(source, node.end)) ||
      new Set(positions).size !== positions.length || positions.some((line) => !actions.some((action) => action.sourceLine === line)) ||
      actions.some((action) => !mapping.has(action.sourceLine))) fail(`${entry.id}: action layout cannot be represented faithfully by the line-oriented generator; keep one complete action per line.`);
    return { entry, codeTs, actions, mapping, startLine, endLine };
  });
}

function describeSteps(code, caseId, saved = []) {
  return parseRecordedActions(code || "").map((action, index) => {
    const original = extractOriginalLocator(action.raw);
    const raw = canonical(action.raw);
    // Shape deliberately excludes the selector. Order and AST statements,
    // never an old-selector lookup, establish edited-step correspondence.
    const shape = original ? `${action.locator?.kind || "unknown"}:${canonical(action.raw.replace(original.originalExpression, "__locator__"))}` : action.actionType;
    return { id: saved.find((step) => step.sourceLine === action.sourceLine)?.id || `${caseId}:S${index + 1}`,
      sourceLine: action.sourceLine, actionType: action.actionType, raw, shape,
      originalExpression: original?.originalExpression || null };
  });
}

/** Match exact AST anchors first, then compatible edits within ordered gaps.
 * Unresolved deleted/inserted steps receive no inherited evidence or names.
 */
function matchSteps(oldSteps, newSteps, nextNumber = 1) {
  const matches = new Map(), used = new Set();
  const pair = (oldIndex, newIndex) => { matches.set(oldIndex, newIndex); used.add(newIndex); };
  const keys = new Set(oldSteps.map((step) => step.raw));
  for (const key of keys) {
    const before = oldSteps.map((step, i) => step.raw === key ? i : -1).filter((i) => i >= 0);
    const after = newSteps.map((step, i) => step.raw === key ? i : -1).filter((i) => i >= 0);
    if (before.length === after.length) before.forEach((index, i) => pair(index, after[i]));
  }
  // Ordered anchors delimit edits even when the file gains/deletes lines.
  const anchors = [...matches].sort((a, b) => a[0] - b[0]);
  if (anchors.every((item, i) => i === 0 || item[1] > anchors[i - 1][1])) {
    const ends = [[-1, -1], ...anchors, [oldSteps.length, newSteps.length]];
    for (let i = 1; i < ends.length; i++) {
      const [leftOld, leftNew] = ends[i - 1], [rightOld, rightNew] = ends[i];
      if (rightOld - leftOld !== rightNew - leftNew) continue;
      for (let delta = 1; delta < rightOld - leftOld; delta++) {
        const oi = leftOld + delta, ni = leftNew + delta;
        if (oldSteps[oi].actionType === newSteps[ni].actionType) pair(oi, ni);
      }
    }
  }
  // A single remaining shape is safe even if an unrelated action was added.
  for (let oi = 0; oi < oldSteps.length; oi++) {
    if (matches.has(oi)) continue;
    const candidates = newSteps.map((step, ni) => !used.has(ni) && step.shape === oldSteps[oi].shape ? ni : -1).filter((ni) => ni >= 0);
    const peers = oldSteps.filter((step, index) => !matches.has(index) && step.shape === oldSteps[oi].shape);
    if (candidates.length === 1 && peers.length === 1) pair(oi, candidates[0]);
  }
  const previousIds = new Set(oldSteps.map((step) => step.id));
  const assigned = new Set();
  for (const [oi, ni] of matches) { newSteps[ni].id = oldSteps[oi].id; assigned.add(ni); }
  for (let ni = 0; ni < newSteps.length; ni++) {
    if (assigned.has(ni)) continue;
    const prefix = newSteps[ni].id.split(":S")[0];
    let id;
    do { id = `${prefix}:S${nextNumber++}`; } while (previousIds.has(id));
    newSteps[ni].id = id; previousIds.add(id);
  }
  return { matches, nextNumber };
}

function remapMetadata(metadata, oldSteps, newSteps, actions, matches, caseId, invalidated) {
  const entries = [];
  for (const entry of metadata?.actions || []) {
    const oldIndex = oldSteps.findIndex((step) => step.sourceLine === Number(entry.line));
    if (oldIndex < 0) fail(`${caseId}: table provenance has no corresponding prior AST step.`);
    if (!matches.has(oldIndex)) {
      const ambiguous = newSteps.some((step, index) => ![...matches.values()].includes(index) && step.shape === oldSteps[oldIndex].shape);
      if (ambiguous) fail(`${caseId}: ambiguous edited table step; cannot safely transfer provenance.`);
      continue; // A genuinely deleted step has no marker in the new draft.
    }
    const step = newSteps[matches.get(oldIndex)];
    const action = actions.find((item) => item.sourceLine === step.sourceLine);
    if (!action?.locator || action.locator.kind !== "locator" || typeof action.locator.selector !== "string") continue;
    const origin = invalidated
      ? { provenance: "table-engine-origin; manually maintained during offline sync", evidenceStatus: "UNVERIFIED" }
      : { ...entry };
    entries.push({ ...origin, line: step.sourceLine, action: action.actionType,
      locator: action.locator.selector, testCaseId: caseId, syncStepId: step.id });
  }
  return { ...(invalidated ? {} : metadata || {}), codeFilePath: "Code.ts",
    analyzedActions: actions.length, transformedActions: entries.length, actions: entries,
    ...(invalidated ? { evidenceStatus: "UNVERIFIED", notes: "Origin only; stale DOM/uniqueness/validation claims removed. No table engine or replay was run." } : {}) };
}

// A narrow local post-projection avoids modifying the shared generator. Rename
// only generated property declarations and their unqualified/this references,
// never string literals, comments, framework members, method names or selectors.
function preserveLocatorNames(code, report, previous, oldSteps, newSteps) {
  const oldByStep = new Map();
  for (const binding of previous?.generatedLocators || []) {
    for (const line of binding.actionSourceLines || []) {
      const step = oldSteps.find((item) => item.sourceLine === line);
      if (step) oldByStep.set(step.id, binding.propertyName);
    }
  }
  const bindings = report.generatedLocators || [];
  const desired = bindings.map((binding) => (binding.actionSourceLines || [])
    .map((line) => newSteps.find((step) => step.sourceLine === line)?.id)
    .map((id) => oldByStep.get(id)).find((name) => /^[A-Za-z_]\w*$/.test(name || "")));
  const used = new Set([report.className, "Page", "Config", "SharedLocators"]);
  for (const match of maskCSharp(code).matchAll(/\b(?:public|private|protected|internal)\s+(?:async\s+)?[\w<>]+\s+(\w+)\s*\(/g)) used.add(match[1]);
  const replacements = new Map();
  // Reserve old names before allocating names for genuinely new properties.
  const order = bindings.map((_, index) => index).sort((a, b) => Number(Boolean(desired[b])) - Number(Boolean(desired[a])));
  for (const index of order) {
    const binding = bindings[index], base = desired[index] || binding.propertyName;
    let name = base, suffix = 2;
    while (used.has(name)) name = `${base}${suffix++}`;
    used.add(name); replacements.set(binding.propertyName, name);
    binding.propertyName = name; binding.expression = name;
  }
  const mask = maskCSharp(code), edits = [];
  for (const match of mask.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const name = replacements.get(match[0]);
    if (!name || name === match[0]) continue;
    const before = mask.slice(0, match.index).trimEnd(), after = mask.slice(match.index + match[0].length).trimStart();
    if (/\bpublic\s+ILocator$/.test(before) ||
      ((!before.endsWith(".") || /\bthis\.$/.test(before)) &&
        (after.startsWith(".") || /^[,)]/.test(after) && /[(,]$/.test(before)))) edits.push({ start: match.index, end: match.index + match[0].length, name });
  }
  for (const edit of edits.reverse()) code = code.slice(0, edit.start) + edit.name + code.slice(edit.end);
  return code;
}

function inferProjectRoot(batchFolder, explicit) {
  if (explicit) {
    const root = path.resolve(explicit);
    if (!fs.existsSync(path.join(root, "appsettings.json"))) fail("projectRoot must contain appsettings.json.");
    return root;
  }
  let folder = batchFolder;
  while (true) {
    if (fs.existsSync(path.join(folder, "appsettings.json"))) return folder;
    const parent = path.dirname(folder);
    if (parent === folder) fail("Cannot infer project root: no ancestor appsettings.json.");
    folder = parent;
  }
}

function checkDraft(code, report, label) {
  if (code !== null && report?.generatedCodeHash && draftHash(code) !== report.generatedCodeHash) fail(`${label}: generated C# differs from its saved draft hash; refusing to overwrite manual C# edits.`);
}

function remapTllMarkers(code, mappings) {
  // Scan strings/comments before matching markers: selector string contents
  // resembling a marker are user data, not provenance comments.
  return code.replace(/@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) => {
    if (!token.startsWith("//")) return token;
    return token.replace(/\[TLL ([A-Za-z0-9_-]+):L(\d+)\]/g, (_marker, id, line) => {
      const mapped = mappings.get(id)?.get(Number(line));
      if (!mapped) fail(`${id}: TLL marker has no combined source mapping.`);
      return `[TLL ${id}:L${mapped.line}]`;
    });
  });
}

function summarize(cases, previousShared, shared, previousOrder = []) {
  const summary = { changed: 0, added: 0, removed: 0, moved: 0,
    movedCases: 0, shared: { count: shared.sharedCount, added: 0, removed: 0, moved: 0 }, affectedIds: [], locatorChanges: [] };
  const affected = new Set();
  const bindingsByCase = new Map();
  const detail = (caseId, stepId, binding, category) => {
    if (binding) summary.locatorChanges.push({ caseId, propertyName: binding.propertyName, stepId, category });
  };
  cases.forEach((item, index) => {
    const oldIndex = previousOrder.indexOf(item.entry.id);
    if (oldIndex >= 0 && oldIndex !== index) { summary.moved++; summary.movedCases++; affected.add(item.entry.id); }
  });
  for (const item of cases) {
    const old = item.oldSteps, current = item.steps;
    const oldBindings = new Map(), newBindings = new Map();
    for (const [steps, report, map] of [[old, item.previous, oldBindings], [current, item.report, newBindings]]) {
      for (const binding of report?.generatedLocators || []) for (const line of binding.actionSourceLines || []) {
        const step = steps.find((step) => step.sourceLine === line);
        if (step) map.set(step.id, binding);
      }
    }
    bindingsByCase.set(item.entry.id, { before: oldBindings, after: newBindings });
    let changed = false;
    for (let index = 0; index < current.length; index++) {
      const step = current[index], oldIndex = old.findIndex((prior) => prior.id === step.id);
      const before = oldBindings.get(step.id), after = newBindings.get(step.id);
      if (!before && after) detail(item.entry.id, step.id, after, "added");
      if (before && !after) detail(item.entry.id, step.id, before, "removed");
      if (oldIndex < 0) { summary.added++; changed = true; continue; }
      if (oldBindings.has(step.id) && newBindings.has(step.id)
        ? before.originalExpression !== after.originalExpression || old[oldIndex].shape !== step.shape
        : old[oldIndex].raw !== step.raw) { summary.changed++; changed = true; }
      if (before && after && (before.originalExpression !== after.originalExpression ||
        before.propertyName !== after.propertyName || old[oldIndex].shape !== step.shape)) detail(item.entry.id, step.id, after, "changed");
      const previousLine = item.previous?.sync?.lineMapping?.find((entry) => entry.sourceLine === old[oldIndex].sourceLine)?.combinedLine;
      const currentLine = item.mapping.get(step.sourceLine)?.line;
      if (index !== oldIndex || previousLine !== undefined && previousLine !== currentLine) {
        summary.moved++; changed = true; detail(item.entry.id, step.id, after, "moved");
      }
    }
    for (const step of old) if (!current.some((entry) => entry.id === step.id)) {
      summary.removed++; changed = true; detail(item.entry.id, step.id, oldBindings.get(step.id), "removed");
    }
    if (changed) affected.add(item.entry.id);
  }
  const memberships = (value) => new Map((value?.shared || []).flatMap((binding) => binding.references.map((ref) =>
    [`${ref.testCaseId}:${ref.propertyName}`, { id: ref.testCaseId, propertyName: ref.propertyName }])));
  const before = memberships(previousShared), after = memberships(shared);
  const sharedDetails = (entry, side, category) => {
    for (const [stepId, binding] of bindingsByCase.get(entry.id)?.[side] || []) {
      if (binding.propertyName === entry.propertyName) detail(entry.id, stepId, binding, category);
    }
  };
  for (const [key, entry] of after) if (!before.has(key)) {
    summary.shared.added++; affected.add(entry.id); sharedDetails(entry, "after", "movedToSharedLocators");
  }
  for (const [key, entry] of before) if (!after.has(key)) {
    summary.shared.removed++; affected.add(entry.id); sharedDetails(entry, "before", "movedFromSharedLocators");
  }
  summary.shared.moved = summary.shared.added + summary.shared.removed;
  for (const entry of summary.locatorChanges) affected.add(entry.caseId);
  summary.affectedIds = [...affected].sort();
  summary.text = `changed=${summary.changed} added=${summary.added} removed=${summary.removed} moved=${summary.moved} shared=${summary.shared.count} (moves=${summary.shared.moved}); affected=${summary.affectedIds.join(",") || "none"}`;
  return summary;
}

// Stage every file before replacing any. Roll back already replaced files if a
// filesystem operation fails. Like the merger, this is not crash-atomic across
// multiple files; no validation/generation blocker publishes a partial sprint.
function publish(artifacts, snapshots) {
  for (const [file, expected] of snapshots) {
    const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (expected === null ? current !== null : current === null || !expected.equals(current)) fail("Sync inputs changed concurrently; retry after recording/editing stops.");
  }
  const staged = [], replaced = [];
  try {
    for (const [target, content] of artifacts) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      const previous = fs.existsSync(target) ? fs.readFileSync(target) : null;
      staged.push({ target, temporary, previous });
      fs.writeFileSync(temporary, content);
    }
    for (const item of staged) { fs.renameSync(item.temporary, item.target); replaced.push(item); }
  } catch (error) {
    for (const item of replaced.reverse()) {
      if (item.previous === null) fs.rmSync(item.target, { force: true });
      else fs.writeFileSync(item.target, item.previous);
    }
    throw error;
  } finally {
    for (const item of staged) fs.rmSync(item.temporary, { force: true });
  }
}

/**
 * syncSprint(manifestPath, { projectRoot?, strictLocators? } = {})
 * Synchronous; throws SPRINT_SYNC_BLOCKED (or an I/O error) before publication
 * on blockers. Returns { codeCs, report, metadata, boundaries, summary, errors }.
 * Code.ts is read-only, byte-for-byte. .work inputs are historical evidence,
 * NEVER generation inputs. Only newly extracted combined-file text is generated.
 */
function syncSprint(manifestPath, options = {}) {
  manifestPath = path.resolve(manifestPath);
  const batchFolder = path.dirname(manifestPath), snapshots = new Map();
  const read = (file, asJson = false) => {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) fail("Sync artifacts must not be symbolic links.");
    const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    snapshots.set(file, bytes);
    return bytes === null ? null : asJson ? JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")) : bytes.toString("utf8");
  };
  const manifest = read(manifestPath, true);
  validateManifest(manifest);
  const sourcePath = path.join(batchFolder, "Code.ts"), source = read(sourcePath);
  if (source === null) fail("Combined Code.ts is missing; stale .work recordings cannot be used to sync.");
  const boundaryPath = path.join(batchFolder, "boundaries.json"), savedBoundaries = read(boundaryPath, true);
  const extracted = extractCases(source, manifest, savedBoundaries);
  const projectRoot = inferProjectRoot(batchFolder, options.projectRoot);
  const previousReport = read(path.join(batchFolder, "CSharpGenerationReport.json"), true);
  checkDraft(read(path.join(batchFolder, "Code.cs")), previousReport, "Combined draft");
  read(path.join(batchFolder, "TableLocatorMetadata.json"));
  const cases = [];
  // All input/identity validation precedes even temporary generation.
  for (const item of extracted) {
    const folder = path.join(batchFolder, item.entry.workFolder);
    for (const dir of [path.join(batchFolder, ".work"), folder]) if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) fail("Work folders must not be symbolic links.");
    const previous = read(path.join(folder, "CSharpGenerationReport.json"), true);
    const oldCode = read(path.join(folder, "Code.ts"));
    checkDraft(read(path.join(folder, "Code.cs")), previous, item.entry.id);
    const oldMetadata = read(path.join(folder, "TableLocatorMetadata.json"), true);
    const observations = read(path.join(folder, "LiveObservations.json"), true);
    const oldSteps = previous?.sync?.version === 1 && Array.isArray(previous.sync.steps)
      ? previous.sync.steps : describeSteps(oldCode, item.entry.id);
    const steps = describeSteps(item.codeTs, item.entry.id);
    const { matches, nextNumber } = matchSteps(oldSteps, steps, previous?.sync?.nextStepNumber || oldSteps.length + 1);
    const knownAbsent = !observations && previous?.locatorValidation?.observationCoverage?.status === "UNAVAILABLE";
    const invalidated = evidenceSource(oldCode) !== evidenceSource(item.codeTs) ||
      previous?.sync?.evidenceInvalidated === true || !observations && !knownAbsent;
    const metadata = remapMetadata(oldMetadata, oldSteps, steps, item.actions, matches, item.entry.id, invalidated);
    const live = invalidated ? { replayVersion: 2, evidenceStatus: "UNVERIFIED", actions: item.actions.map((action) => ({
      line: action.sourceLine, observationStatus: "unverified", executionStatus: "skipped",
      error: "Offline sync: DOM evidence is absent or stale after source changes. No replay performed."
    })) } : observations;
    cases.push({ ...item, folder, previous, oldSteps, steps, nextNumber, invalidated, metadata, live });
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-sync-"));
  const artifacts = new Map();
  try {
    for (const item of cases) {
      const folder = path.join(staging, item.entry.id);
      fs.mkdirSync(folder);
      const codeFilePath = path.join(folder, "Code.ts"), outputFilePath = path.join(folder, "Code.cs"), reportFilePath = path.join(folder, "CSharpGenerationReport.json");
      const tableMetadataPath = path.join(folder, "TableLocatorMetadata.json"), domObservationPath = path.join(folder, "LiveObservations.json");
      fs.writeFileSync(codeFilePath, item.codeTs); fs.writeFileSync(tableMetadataPath, json(item.metadata));
      if (item.live) fs.writeFileSync(domObservationPath, json(item.live));
      const generated = generateCSharpCode({ projectRoot, appSettingsPath: path.join(projectRoot, "appsettings.json"),
        codeFilePath, outputFilePath, reportFilePath, tableMetadataPath, domObservationPath,
        caseId: item.entry.id, caseTitle: item.entry.title, className: `CodegenFlow${item.entry.id.replace(/-/g, "_")}`,
        enterpriseMode: true, enableRepair: false, strictLocators: options.strictLocators ?? item.previous?.strictLocators ?? false });
      if (generated.codeGenerationBlocked || !generated.validation?.success) fail(`${item.entry.id}: generation blocked: ${(generated.validation?.errors || []).join(" | ")}`);
      const report = JSON.parse(fs.readFileSync(reportFilePath, "utf8"));
      let codeCs = preserveLocatorNames(generated.code, report, item.previous, item.oldSteps, item.steps);
      // Preserve policy review disposition without carrying stale DOM rule
      // results/claims forward. Current deterministic rules are always rerun.
      report.reviewRequired = Boolean(report.reviewRequired || item.previous?.reviewRequired || item.invalidated);
      report.sync = { version: 1, sourceHash: hash(item.codeTs), combinedSourceHash: hash(source),
        evidenceInvalidated: item.invalidated, evidenceStatus: item.invalidated ? "UNVERIFIED" : item.live ? "SAVED" : "UNAVAILABLE",
        previousReviewRequired: Boolean(item.previous?.reviewRequired), steps: item.steps, nextStepNumber: item.nextNumber,
        lineMapping: [...item.mapping].map(([sourceLine, mapped]) => ({ sourceLine, combinedLine: mapped.line })) };
      report.issues = collectGenerationIssues(report);
      if (item.invalidated) report.issues.push({ severity: "warning", kind: "offlineSync", ruleId: "SYNC001",
        sourceLine: null, locator: null, message: "Prior review disposition preserved; offline generation is not runtime verification." });
      if (report.reviewRequired) codeCs = addReviewHeader(codeCs, report.issues);
      const addedLines = codeCs.split("\n").length - generated.code.split("\n").length;
      for (const entry of report.sourceMap) if (entry.generatedLine > 0) entry.generatedLine += addedLines;
      const validation = validateGeneratedCSharp(codeCs, []);
      if (!validation.success) fail(`${item.entry.id}: stabilized draft failed structural validation: ${validation.errors.join(" | ")}`);
      report.generatedCodeHash = draftHash(codeCs);
      report.codeFilePath = path.join(item.folder, "Code.ts"); report.outputFilePath = path.join(item.folder, "Code.cs");
      item.report = report; item.codeCs = codeCs; item.entry = { ...item.entry, status: "generated" };
      for (const [name, content] of Object.entries({ "Code.ts": item.codeTs, "Code.cs": codeCs,
        "CSharpGenerationReport.json": json(report), "TableLocatorMetadata.json": json(item.metadata),
        ...(item.live ? { "LiveObservations.json": json(item.live) } : {}) })) artifacts.set(path.join(item.folder, name), content);
    }
    const inactive = manifest.testCases.filter((entry) => !cases.some((item) => item.entry.id === entry.id)).map((entry) => ({ entry }));
    const result = buildSprint(manifest.batchId, [...cases, ...inactive]);
    if (result.errors.length || result.report.codeGenerationBlocked || result.report.cases.some((item) => !item.included && !["planned", "skipped"].includes(item.status))) fail(`Sprint merge blocked: ${result.errors.join(" | ") || "not all cases passed merge validation"}`);
    // The merger recollects deterministic issues and drops sync-only issues.
    // Restore these locally, including review for cases with no locators.
    for (const entry of result.report.cases.filter((entry) => entry.included)) {
      const item = cases.find((item) => item.entry.id === entry.testCaseId);
      entry.reviewRequired = Boolean(entry.reviewRequired || item.report.reviewRequired || item.invalidated);
      const offlineIssues = item.report.issues.filter((issue) => issue.kind === "offlineSync");
      entry.issues.push(...offlineIssues);
      if (offlineIssues.length) {
        const declaration = `    public sealed class ${entry.className}`;
        result.codeCs = result.codeCs.replace(new RegExp(`(?:[ \\t]*// REVIEW REQUIRED:[^\\r\\n]*\\r?\\n)?${declaration}\\b`),
          () => addReviewHeader(declaration, entry.issues));
      }
    }
    result.report.reviewRequired = result.report.cases.some((entry) => entry.reviewRequired);
    const mappings = new Map(cases.map((item) => [item.entry.id, item.mapping]));
    result.codeCs = remapTllMarkers(result.codeCs, mappings);
    result.metadata = mergeMetadata(manifest.batchId, cases, mappings, result.report.generatedAtUtc);
    const compilation = compileGeneratedCSharp(result.codeCs, { projectRoot });
    if (compilation.success === false) fail(`Combined C# compilation blocked: ${compilation.errors.join(" | ")}`);
    result.report.compilation = compilation;
    result.report.generatedCodeHash = draftHash(result.codeCs);
    result.report.sourceHash = hash(source);
    result.report.syncVersion = 1;
    result.report.sourceMap = cases.flatMap((item) => item.report.sourceMap.map((step) => ({ ...step,
      testCaseId: item.entry.id, localSourceLine: step.sourceLine, sourceLine: item.mapping.get(step.sourceLine)?.line,
      localGeneratedLine: step.generatedLine, generatedLine: 0 })));
    result.summary = summarize(cases, previousReport?.sharedLocators, result.report.sharedLocators,
      savedBoundaries?.cases.map((item) => item.id) || previousReport?.cases.filter((item) => item.included).map((item) => item.testCaseId));
    result.report.syncSummary = result.summary;
    // Shared reports advertise combined positions; local reports remain local.
    for (const group of [...result.report.sharedLocators.shared, ...result.report.sharedLocators.conflicts]) {
      for (const ref of group.references) for (const key of ["actionSourceLines", "tllSourceLines"]) {
        if (ref[key]) ref[key] = ref[key].map((line) => mappings.get(ref.testCaseId).get(line).line);
      }
    }
    for (const entry of result.report.cases) {
      if (!entry.included) continue;
      entry.validationSourceLineScope = "case-local; see combined report sourceMap";
      entry.issues = entry.issues.map((issue) => ({ ...issue, sourceLine: issue.sourceLine == null ? null : mappings.get(entry.testCaseId).get(issue.sourceLine)?.line ?? issue.sourceLine }));
      const target = manifest.testCases.find((item) => item.id === entry.testCaseId);
      target.status = "generated"; target.reviewRequired = entry.reviewRequired; target.issues = entry.issues;
      const item = cases.find((item) => item.entry.id === entry.testCaseId);
      target.actionCount = item.report.actionCount ?? 0;
      target.unsupportedActionCount = item.report.unsupportedActionCount ?? item.report.unsupportedActions?.length ?? 0;
      target.transformedTableActions = item.metadata.transformedActions ?? 0;
    }
    result.boundaries = { ...savedBoundaries, version: 1, cases: cases.map((item) => ({
      id: item.entry.id, title: item.entry.title, startLine: item.startLine, endLine: item.endLine
    })) };
    delete result.codeTs; // The merger's normalized/reordered TS must NEVER escape as authoritative output.
    for (const [name, content] of Object.entries({ "Code.cs": result.codeCs, "CSharpGenerationReport.json": json(result.report),
      "TableLocatorMetadata.json": json(result.metadata), "boundaries.json": json(result.boundaries) })) artifacts.set(path.join(batchFolder, name), content);
    artifacts.set(manifestPath, json(manifest));
    publish(artifacts, snapshots);
    return result;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2), index = args.indexOf("--manifest-file");
    if (index < 0 || !args[index + 1] || args[index + 1].startsWith("--")) fail("Required argument: --manifest-file <manifest.json>");
    const result = syncSprint(args[index + 1], args.includes("--strict-locators") ? { strictLocators: true } : {});
    console.log(`[SprintSync] ${result.summary.text}; reviewRequired=${result.report.reviewRequired}; compilation=${result.report.compilation.status}`);
    const details = result.summary.locatorChanges, limit = 20;
    if (!details.length) console.log("[SprintSync] locator changes: none");
    // Explicit identifiers only: never serialize bindings, selectors or action values.
    const identifier = (value) => String(value).replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120);
    for (const row of details.slice(0, limit)) console.log(`[SprintSync] caseId=${identifier(row.caseId)} propertyName=${identifier(row.propertyName)} stepId=${identifier(row.stepId)} category=${row.category}`);
    if (details.length > limit) console.log(`[SprintSync] ${details.length - limit} more locator change row(s); see report syncSummary.locatorChanges.`);
  } catch (error) {
    console.error(`[SprintSync] ${safeDiagnosticText(error.message)}`);
    process.exitCode = 1;
  }
}

module.exports = { syncSprint, extractCases, describeSteps, matchSteps, remapMetadata, preserveLocatorNames };