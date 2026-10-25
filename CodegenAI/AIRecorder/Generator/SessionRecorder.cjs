"use strict";

// The CLI owns a single browser; this process owns terminal input. No replay.
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");
const { randomUUID, createHash } = require("crypto");
const ts = require("typescript");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (text) => createHash("sha256").update(text).digest("hex");
const normalize = (text) => text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
const readJson = (file) => { const text = read(file); return text === null ? null : JSON.parse(text.replace(/^\uFEFF/, "")); };
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temp, text); fs.renameSync(temp, file); }
  finally { fs.rmSync(temp, { force: true }); }
}
function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.testCases)) throw new Error("Invalid session manifest.");
  const seen = new Set();
  for (const entry of manifest.testCases) {
    if (!/^[A-Za-z0-9_-]+$/.test(entry.id) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(entry.id) ||
      seen.has(entry.id.toLowerCase()) || entry.workFolder !== `.work/${entry.id}` ||
      typeof entry.title !== "string" || !entry.title.trim() || /[\r\n]/.test(entry.title)) throw new Error("Invalid session case identity/path.");
    seen.add(entry.id.toLowerCase());
  }
}

function parseTests(source, allowEmpty = false) {
  const file = ts.createSourceFile("Code.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) throw new Error("Incomplete or invalid TypeScript capture.");
  const blocks = [];
  for (const statement of file.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
    if (ts.isImportDeclaration(statement) || call?.expression.getText(file) === "test.use") {
      if (blocks.length) throw new Error("Headers must precede test blocks.");
      continue;
    }
    const callback = call?.arguments[1];
    if (!call || call.expression.getText(file) !== "test" || call.arguments.length !== 2 ||
      !ts.isStringLiteralLike(call.arguments[0]) || !callback || !ts.isArrowFunction(callback) ||
      !ts.isBlock(callback.body) || callback.parameters.length !== 1 ||
      !/^\{\s*page\s*\}$/.test(callback.parameters[0].name.getText(file)) ||
      !callback.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
      throw new Error("Expected ordinary async test('name', async ({ page }) => { ... }) blocks only.");
    }
    blocks.push({ title: call.arguments[0].text, statement, callback, start: statement.getStart(file), end: statement.end });
  }
  if (!blocks.length && !allowEmpty) throw new Error("No complete test block in capture.");
  return { file, blocks, header: blocks.length ? source.slice(0, blocks[0].start) : source };
}
function parseCapture(source) {
  const parsed = parseTests(source);
  if (parsed.blocks.length !== 1) throw new Error("Live capture must contain exactly one test.");
  const block = parsed.blocks[0];
  return { ...parsed, block, statements: [...block.callback.body.statements], bodyStart: block.callback.body.getStart(parsed.file) + 1 };
}
function namedBlock(entry, body) {
  const title = JSON.stringify(`${entry.id} - ${entry.title}`).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `test(${title}, async ({ page }) => {${body}\n});`;
}
function identifyBlocks(source, manifest) {
  const parsed = parseTests(source, true), byId = new Map();
  for (const block of parsed.blocks) {
    const entries = manifest.testCases.filter((entry) => `${entry.id} - ${entry.title}` === block.title);
    if (entries.length !== 1 || byId.has(entries[0].id)) throw new Error("Combined source contains unknown or duplicate named cases; no overwrite allowed.");
    byId.set(entries[0].id, block);
  }
  return { ...parsed, byId };
}

// A completed prefix is immutable. Codegen can coalesce successive fill calls;
// refusing that rewrite is safer than assigning the new value to an old case.
function checkPrefix(source, snapshot) {
  if (snapshot && !source.startsWith(snapshot.prefix)) throw new Error("Completed capture prefix changed (possibly a coalesced fill). Session blocked; boundary snapshots and raw capture retained.");
}
function crossCaseDependencies(statements, start, end) {
  const declared = new Set(), dependencies = new Set();
  const names = (node) => {
    if (ts.isIdentifier(node)) declared.add(node.text);
    else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) for (const item of node.elements) if (ts.isBindingElement(item)) names(item.name);
  };
  const collect = (node) => {
    if (ts.isVariableDeclaration(node)) names(node.name);
    ts.forEachChild(node, collect);
  };
  statements.slice(0, start).forEach(collect);
  const visit = (node) => {
    // Conservative: any reference to a variable declared in an earlier case
    // blocks isolation, including popup/download/promise variables.
    if (ts.isIdentifier(node) && declared.has(node.text) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
      !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)) dependencies.add(node.text);
    ts.forEachChild(node, visit);
  };
  statements.slice(start, end).forEach(visit);
  return [...dependencies];
}

/** Wait for a complete AST after a quiet interval longer than CLI's 250ms
 * throttle. fs.watch resets the timer; no shell sleeps or live replay. */
function stableCapture(file, { quietMs = 450, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    let debounce, watcher, finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(debounce); clearTimeout(deadline); watcher?.close(); error ? reject(error) : resolve(result);
    };
    const inspect = () => {
      try { const source = fs.readFileSync(file, "utf8"); finish(null, { source, parsed: parseCapture(source) }); }
      catch { debounce = setTimeout(inspect, quietMs); }
    };
    const schedule = () => { if (!finished) { clearTimeout(debounce); debounce = setTimeout(inspect, quietMs); } };
    const deadline = setTimeout(() => finish(new Error("Timed out waiting for a stable, complete codegen output.")), timeoutMs);
    try {
      watcher = fs.watch(path.dirname(file), (_event, name) => { if (!name || String(name) === path.basename(file)) schedule(); });
      watcher.on("error", (error) => finish(error));
      schedule();
    } catch (error) { finish(error); }
  });
}

function resolveCli() {
  try { return require.resolve("playwright/cli"); }
  catch (error) {
    if (!["ERR_PACKAGE_PATH_NOT_EXPORTED", "MODULE_NOT_FOUND"].includes(error.code)) throw error;
    const packageFile = require.resolve("playwright/package.json");
    return path.resolve(path.dirname(packageFile), require(packageFile).bin.playwright);
  }
}
function backupBatch(manifestFile, ids = []) {
  const folder = path.dirname(path.resolve(manifestFile));
  const destination = path.join(folder, ".work", "session", randomUUID());
  fs.mkdirSync(destination, { recursive: true });
  for (const name of ["Code.ts", "Code.cs", "boundaries.json", "manifest.json", "CSharpGenerationReport.json", "TableLocatorMetadata.json"]) {
    const file = path.join(folder, name);
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(destination, name));
  }
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid backup case ID.");
    const work = path.join(folder, ".work", id);
    if (fs.existsSync(work)) fs.cpSync(work, path.join(destination, "cases", id), { recursive: true });
  }
  return destination;
}

/** Resolves after graceful CLI exit and publication of named source + snippets.
 * Tests may inject spawn, input, log and flush timings, never an application replay. */
async function recordSession(options) {
  const manifestFile = path.resolve(options.manifestFile), folder = path.dirname(manifestFile);
  const manifest = readJson(manifestFile);
  validateManifest(manifest);
  const ids = options.ids?.length ? options.ids : manifest.testCases.map((entry) => entry.id);
  if (ids.some((id) => !manifest.testCases.some((entry) => entry.id === id))) throw new Error("Unknown session case ID.");
  const selected = manifest.testCases.filter((entry) => ids.includes(entry.id));
  if (!selected.length || !options.url) throw new Error("Recording requires cases and a configured URL.");
  const output = path.join(folder, "Code.ts"), oldSource = read(output);
  // Verify old identities before the child is allowed to overwrite Code.ts.
  // Selected titles may have changed in the CSV: use the pre-plan backup only
  // for identity, never stale .work text for unselected cases.
  const previousManifest = options.previousManifestFile ? readJson(options.previousManifestFile) : manifest;
  const old = oldSource?.trim() ? identifyBlocks(oldSource, previousManifest || manifest) : null;
  const unselected = old ? [...old.byId.keys()].filter((id) => !ids.includes(id)) : [];
  if (unselected.some((id) => !manifest.testCases.some((entry) => entry.id === id))) throw new Error("Existing unselected cases are absent from the plan. Use -Only or a new batch name.");
  const sessionFolder = backupBatch(manifestFile, ids), sessionId = path.basename(sessionFolder);
  const relative = (file) => path.relative(folder, file).replace(/\\/g, "/");
  const rawFile = path.join(sessionFolder, "raw.ts");
  const boundaryFile = path.join(folder, "boundaries.json");
  const previousBoundaries = readJson(boundaryFile);
  const capture = { sessionId, status: "recording", rawFile: relative(rawFile), boundaries: [] };
  const boundaries = { version: 1, latestSessionId: sessionId,
    cases: (previousBoundaries?.cases || []).filter((entry) => !ids.includes(entry.id)),
    captureSessions: [...(previousBoundaries?.captureSessions || []), capture] };
  const log = options.log || console.log;
  let child, exited = false, closing = false, closeResult, snapshot = null, current = 0, finishEmptyCase = false;
  const save = () => { write(boundaryFile, json(boundaries)); write(manifestFile, json(manifest)); };
  for (const entry of selected) {
    entry.status = "planned"; entry.recordingSessionId = sessionId; entry.recordedAtUtc = null;
    entry.actionCount = 0; entry.unsupportedActionCount = 0; entry.transformedTableActions = 0;
    entry.issues = []; entry.reviewRequired = false;
    delete entry.mergeError;
  }
  save();
  // Remove stale output so an immediate Enter can never capture an old file.
  if (fs.existsSync(output)) fs.unlinkSync(output);
  let resolveExit, rejectUnexpected;
  const exit = new Promise((resolve) => { resolveExit = resolve; });
  const unexpected = new Promise((_resolve, reject) => { rejectUnexpected = reject; });
  unexpected.catch(() => {});
  const wait = (promise) => Promise.race([promise, unexpected]);
  const close = async () => {
    if (!child || exited) return;
    closing = true;
    let timer, killTimer;
    try {
      child.stdin.write("exit\n");
      child.stdin.end();
      await Promise.race([exit, new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("CLI did not exit gracefully; raw capture retained.")), options.closeTimeoutMs ?? 15000);
      })]);
    } catch (error) {
      child.kill();
      // Await the actual close event before restoring source: a late CLI flush
      // must not overwrite the recovered named Code.ts after cleanup returns.
      await Promise.race([exit, new Promise((resolve) => { killTimer = setTimeout(resolve, 2000); })]);
      throw error;
    } finally { clearTimeout(timer); clearTimeout(killTimer); }
  };
  const prompt = () => log(current < selected.length
    ? `[Session] ${selected[current].id} - ${selected[current].title}: record actions, then Enter; done finishes early.`
    : "[Session] All boundaries saved. Enter or done closes the browser. Further actions belong to the last case.");
  const captureBoundary = (source, parsed) => {
    checkPrefix(source, snapshot);
    const start = snapshot?.count || 0, end = parsed.statements.length;
    if (end === start) return false;
    const entry = selected[current], last = parsed.statements[end - 1];
    const item = { id: entry.id, title: entry.title, rawStartAction: start + 1, rawEndAction: end,
      actionCount: end - start, rawStartLine: lineAt(source, parsed.statements[start].getStart(parsed.file)),
      rawEndLine: lineAt(source, last.end), rawEndOffset: last.end,
      boundaryEndAction: end, boundaryEndLine: lineAt(source, last.end), boundaryActionCount: end - start,
      snapshotFile: relative(path.join(sessionFolder, `${entry.id}.boundary.ts`)), rawHash: hash(source) };
    write(path.join(folder, item.snapshotFile), source);
    write(rawFile, source);
    capture.boundaries.push(item);
    snapshot = { prefix: source.slice(0, last.end), count: end };
    const body = source.slice(start ? parsed.statements[start - 1].end : parsed.bodyStart, last.end);
    write(path.join(folder, entry.workFolder, "Code.ts"), parsed.header + namedBlock(entry, body) + "\n");
    entry.status = "recorded"; entry.actionCount = end - start; entry.recordedAtUtc = new Date().toISOString();
    current++; save(); return true;
  };
  let rl;
  const interrupt = () => rejectUnexpected(new Error("Recording interrupted; raw capture and snapshots retained."));
  try {
    const args = [resolveCli(), "codegen", "--target", "playwright-test", "--output", output];
    if (options.loadStorage) args.push("--load-storage", options.loadStorage);
    if (options.saveStorage) args.push("--save-storage", options.saveStorage);
    if (options.testIdAttribute) args.push("--test-id-attribute", options.testIdAttribute);
    args.push(options.url);
    // Installed 1.58.1 gates stdin exit behind this test hook. Clear inherited
    // auto-close options; the parent, not a timeout, determines completion.
    const env = { ...process.env, ...options.env, PWTEST_CLI_IS_UNDER_TEST: "1" };
    delete env.PWTEST_CLI_EXIT_AFTER_TIMEOUT;
    child = (options.spawn || spawn)(process.execPath, args, { stdio: ["pipe", "inherit", "inherit"], env });
    child.once("error", (error) => { exited = true; resolveExit(); rejectUnexpected(error); });
    child.stdin.on("error", (error) => { if (!exited) rejectUnexpected(error); });
    child.once("close", (code, signal) => {
      exited = true; closeResult = { code, signal }; resolveExit();
      if (!closing) rejectUnexpected(new Error("Browser closed before Enter/done completed the session; capture retained, session failed."));
    });
    process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
    rl = readline.createInterface({ input: options.input || process.stdin, crlfDelay: Infinity, terminal: false });
    const lines = rl[Symbol.asyncIterator]();
    prompt();
    while (true) {
      const next = await wait(lines.next());
      if (next.done) throw new Error("Terminal input closed before done; session failed.");
      const answer = next.value.trim().toLowerCase();
      if (answer !== "" && answer !== "done") { log("Use Enter for a boundary or done to finish."); continue; }
      const { source, parsed } = await wait(stableCapture(output, options.flush));
      checkPrefix(source, snapshot);
      if (current === selected.length) break;
      const added = captureBoundary(source, parsed);
      if (answer === "done") { finishEmptyCase = !added; break; }
      if (!added) log("Empty boundary: record an action before advancing.");
      prompt();
    }
    await close();
    if (closeResult?.code !== 0 || closeResult?.signal) throw new Error("CLI exited unsuccessfully; raw capture retained.");
    const source = fs.readFileSync(output, "utf8"), parsed = parseCapture(source);
    write(rawFile, source); checkPrefix(source, snapshot);
    // Actions flushed during shutdown or after the final boundary are never
    // discarded. They extend the last case, with an explicit audit count.
    if (parsed.statements.length > (snapshot?.count || 0)) {
      if (!capture.boundaries.length || finishEmptyCase) captureBoundary(source, parsed);
      else {
        const last = capture.boundaries.at(-1), end = parsed.statements.at(-1);
        last.finalTailActionCount = parsed.statements.length - snapshot.count;
        last.rawEndAction = parsed.statements.length; last.actionCount = last.rawEndAction - last.rawStartAction + 1;
        last.rawEndLine = lineAt(source, end.end); last.rawEndOffset = end.end;
        log(`[Session] Retained ${last.finalTailActionCount} final tail action(s) in ${last.id}.`);
      }
    }
    const replacements = new Map();
    for (const item of capture.boundaries) {
      const entry = selected.find((entry) => entry.id === item.id), start = item.rawStartAction - 1;
      const end = item.rawEndAction;
      const bodyEnd = end === parsed.statements.length ? parsed.block.callback.body.end - 1 : parsed.statements[end - 1].end;
      const body = source.slice(start ? parsed.statements[start - 1].end : parsed.bodyStart, bodyEnd).trimEnd();
      const block = namedBlock(entry, body);
      replacements.set(entry.id, block);
      const dependencies = crossCaseDependencies(parsed.statements, start, end);
      item.dependencies = dependencies; entry.actionCount = item.actionCount;
      if (dependencies.length) {
        entry.status = "failed: cross-case variable dependency"; entry.reviewRequired = true;
        entry.issues = [{ severity: "error", kind: "sessionDependency", ruleId: "SESSION001", sourceLine: item.rawStartLine,
          message: "Case references variables declared in an earlier case; review boundaries before generation." }];
      }
      const work = path.join(folder, entry.workFolder);
      // Fresh recordings cannot inherit old observation or draft evidence.
      for (const name of ["LiveObservations.json", "TableLocatorMetadata.json", "CSharpGenerationReport.json", "Code.cs"]) fs.rmSync(path.join(work, name), { force: true });
      write(path.join(work, "Code.ts"), parsed.header + block + "\n");
    }
    if (old && unselected.length && normalize(old.header).trim() !== normalize(parsed.header).trim()) throw new Error("Session headers differ from preserved cases; refusing incompatible combined source.");
    const header = old && unselected.length ? old.header : parsed.header;
    let combined = header;
    const finalCases = [];
    for (const entry of manifest.testCases) {
      const block = replacements.get(entry.id) || (unselected.includes(entry.id) ? oldSource.slice(old.byId.get(entry.id).start, old.byId.get(entry.id).end) : null);
      if (!block) continue;
      const prior = boundaries.cases.find((item) => item.id === entry.id);
      const raw = capture.boundaries.find((item) => item.id === entry.id);
      const startLine = lineAt(combined, combined.length);
      combined += block;
      finalCases.push({ ...prior, ...raw, id: entry.id, title: entry.title, startLine, endLine: lineAt(combined, combined.length) });
      combined += "\n\n";
    }
    capture.status = "complete"; capture.rawHash = hash(source);
    boundaries.cases = finalCases;
    write(output, combined); save();
    return { manifest, boundaries, recordedIds: capture.boundaries.map((item) => item.id), sessionId };
  } catch (error) {
    try { await close(); } catch { /* Preserve the original failure. */ }
    const raw = read(output); if (raw !== null) write(rawFile, raw);
    capture.status = "failed";
    capture.cleanupConfirmed = !child || exited;
    // Never publish a raw single-test capture over an earlier named recording.
    // If even forced shutdown cannot be confirmed, do not race a live writer.
    // The previous named source is still safe in the session backup directory.
    if (capture.cleanupConfirmed) {
      if (oldSource !== null) write(output, oldSource); else fs.rmSync(output, { force: true });
    }
    for (const entry of selected) if (entry.status === "recorded") entry.status = "failed: session incomplete";
    save(); throw error;
  } finally {
    rl?.close(); process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
  }
}

/** Publish with the existing merger's validation/shared-locator implementation,
 * but NEVER its filtered Code.ts. Remap metadata/TLL to the full authoritative
 * source (including blocked cases) without rerunning any validator or observer. */
function publishSession(manifestFile) {
  manifestFile = path.resolve(manifestFile);
  const folder = path.dirname(manifestFile), manifest = readJson(manifestFile), boundaryFile = path.join(folder, "boundaries.json");
  validateManifest(manifest);
  const boundaries = readJson(boundaryFile);
  if (!boundaries?.latestSessionId) throw new Error("No persistent session to publish.");
  const sourceFile = path.join(folder, "Code.ts"), source = read(sourceFile), parsed = identifyBlocks(source, manifest);
  const replacements = new Map();
  for (const entry of manifest.testCases.filter((entry) => entry.recordingSessionId === boundaries.latestSessionId && parsed.byId.has(entry.id))) {
    const snippet = read(path.join(folder, entry.workFolder, "Code.ts")), local = identifyBlocks(snippet, manifest);
    if (local.blocks.length !== 1 || !local.byId.has(entry.id) || normalize(local.header).trim() !== normalize(parsed.header).trim()) throw new Error(`${entry.id}: rewritten snippet identity/header changed.`);
    replacements.set(entry.id, snippet.slice(local.blocks[0].start, local.blocks[0].end));
  }
  let combined = source;
  for (const [id, block] of [...parsed.byId].sort((a, b) => b[1].start - a[1].start)) {
    if (replacements.has(id)) combined = combined.slice(0, block.start) + replacements.get(id) + combined.slice(block.end);
  }
  const final = identifyBlocks(combined, manifest), mappings = new Map();
  const cases = manifest.testCases.map((entry) => {
    const work = path.join(folder, entry.workFolder), block = final.byId.get(entry.id);
    if (!block) return { entry };
    const item = { entry, codeTs: read(path.join(work, "Code.ts")), codeCs: read(path.join(work, "Code.cs")),
      report: readJson(path.join(work, "CSharpGenerationReport.json")), metadata: readJson(path.join(work, "TableLocatorMetadata.json")) };
    if (item.codeTs) {
      const local = identifyBlocks(item.codeTs, manifest), localBlock = local.byId.get(entry.id);
      if (local.blocks.length !== 1 || !localBlock || normalize(item.codeTs.slice(localBlock.start, localBlock.end)) !== normalize(combined.slice(block.start, block.end))) {
        throw new Error(`${entry.id}: preserved combined source differs from working evidence. Run -Sync; stale work will not replace source.`);
      }
      const start = lineAt(item.codeTs, localBlock.start), global = lineAt(combined, block.start), end = lineAt(item.codeTs, localBlock.end);
      mappings.set(entry.id, new Map(Array.from({ length: end - start + 1 }, (_, index) => [start + index, { line: global + index, relativeLine: index + 1 }])));
      if (entry.status === "failed: cross-case variable dependency") {
        const firstAction = localBlock.callback.body.statements[0];
        entry.issues = entry.issues.map((issue) => ({ ...issue,
          sourceLine: firstAction ? lineAt(combined, block.callback.body.statements[0].getStart(final.file)) : global }));
      }
    }
    return item;
  });
  const { buildSprint, mergeMetadata } = require("./SprintMerger.cjs");
  const result = buildSprint(manifest.batchId, cases);
  const included = cases.filter((item) => result.report.cases.find((entry) => entry.testCaseId === item.entry.id)?.included);
  result.metadata = mergeMetadata(manifest.batchId, included, mappings, result.report.generatedAtUtc);
  result.codeCs = result.codeCs.replace(/@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (token) => {
    if (!token.startsWith("//")) return token;
    return token.replace(/\[TLL ([A-Za-z0-9_-]+):L(\d+)\]/g, (_marker, id, line) => {
      const mapped = mappings.get(id)?.get(Number(line));
      if (!mapped) throw new Error(`${id}: TLL has no authoritative source mapping.`);
      return `[TLL ${id}:L${mapped.line}]`;
    });
  });
  for (const group of [...result.report.sharedLocators.shared, ...result.report.sharedLocators.conflicts]) {
    for (const ref of group.references) for (const key of ["actionSourceLines", "tllSourceLines"]) {
      if (ref[key]) ref[key] = ref[key].map((line) => mappings.get(ref.testCaseId)?.get(line)?.line ?? line);
    }
  }
  for (const report of result.report.cases) {
    const entry = manifest.testCases.find((entry) => entry.id === report.testCaseId);
    report.validationSourceLineScope = "case-local";
    report.issues = report.issues.map((issue) => ({ ...issue, sourceLine: mappings.get(entry.id)?.get(issue.sourceLine)?.line ?? issue.sourceLine }));
    if (entry.status === "failed: cross-case variable dependency") {
      report.issues.push(...entry.issues.filter((issue) => issue.kind === "sessionDependency")); report.reviewRequired = true;
    }
    entry.issues = report.issues; entry.reviewRequired = report.reviewRequired;
  }
  result.report.reviewRequired = result.report.cases.some((entry) => entry.reviewRequired);
  result.report.generatedCodeHash = hash(normalize(result.codeCs));
  result.report.sourceHash = hash(combined);
  result.report.sourceMap = cases.flatMap((item) => (item.report?.sourceMap || []).map((step) => ({ ...step,
    testCaseId: item.entry.id, localSourceLine: step.sourceLine,
    sourceLine: mappings.get(item.entry.id)?.get(step.sourceLine)?.line ?? null,
    localGeneratedLine: step.generatedLine, generatedLine: 0 })));
  boundaries.cases = [...final.byId].map(([id, block]) => ({ ...boundaries.cases.find((item) => item.id === id), id,
    title: manifest.testCases.find((entry) => entry.id === id).title,
    startLine: lineAt(combined, block.start), endLine: lineAt(combined, block.end) }));
  // Keep the pre-rewrite source as recovery evidence too.
  const backup = backupBatch(manifestFile);
  for (const [name, text] of Object.entries({ "Code.ts": combined, "Code.cs": result.codeCs,
    "CSharpGenerationReport.json": json(result.report), "TableLocatorMetadata.json": json(result.metadata),
    "boundaries.json": json(boundaries), "manifest.json": json(manifest) })) write(path.join(folder, name), text);
  return { ...result, codeTs: combined, backup };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2), value = (key) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
    const manifestFile = value("--manifest-file");
    if (!manifestFile) throw new Error("Required --manifest-file.");
    const ids = args.filter((arg) => arg.startsWith("--case-id=")).map((arg) => arg.slice(10));
    if (args.includes("--backup")) { console.log(backupBatch(manifestFile, ids)); return; }
    if (args.includes("--publish")) {
      const result = publishSession(manifestFile);
      console.log(`[Session] Published without replay; authoritative source retained; blocked=${result.report.codeGenerationBlocked}.`);
      if (result.errors.length) process.exitCode = 1;
      return;
    }
    await recordSession({ manifestFile, ids, url: value("--url"), loadStorage: value("--load-storage"),
      saveStorage: value("--save-storage"), testIdAttribute: value("--test-id-attribute"), previousManifestFile: value("--previous-manifest") });
  })().catch((error) => {
    // Do not print recorded action text, credentials or URL query parameters.
    console.error(`[Session] ${error.message.replace(/https?:\/\/[^\s"'<>]+/g, (url) => url.split(/[?#]/)[0])}`);
    process.exitCode = 1;
  });
}
module.exports = { recordSession, publishSession, backupBatch, parseCapture, checkPrefix, stableCapture, resolveCli, crossCaseDependencies };