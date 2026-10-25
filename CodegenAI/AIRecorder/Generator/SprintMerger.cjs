const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");
const ts = require("typescript");
const { collectGenerationIssues, formatGenerationIssues, safeDiagnosticText, addReviewHeader, validateGeneratedCSharp } = require("./CSharpCodeGenerator.cjs");
const { buildSharedLocators, maskCSharp } = require("./SharedLocators.cjs");

const normalizeText = (value) => String(value || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;
const caseTitle = (entry) => `${entry.id} - ${entry.title}`;

function quoteTypeScript(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}'`;
}

function extractTestBlock(source) {
  const text = normalizeText(source);
  const file = ts.createSourceFile("Code.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length) {
    throw new Error(`Invalid TypeScript: ${ts.flattenDiagnosticMessageText(file.parseDiagnostics[0].messageText, " ")}`);
  }
  const imports = [];
  const uses = [];
  const tests = [];
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push(statement.getText(file));
      continue;
    }
    if (ts.isEmptyStatement(statement)) continue;
    const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
    if (call && ts.isPropertyAccessExpression(call.expression) && call.expression.getText(file) === "test.use") {
      uses.push(statement.getText(file));
      continue;
    }
    if (call && ts.isIdentifier(call.expression) && call.expression.text === "test") {
      const title = call.arguments[0];
      const callback = call.arguments[call.arguments.length - 1];
      if (!title || !ts.isStringLiteralLike(title) || !callback ||
          !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) || !ts.isBlock(callback.body)) {
        throw new Error("Expected test('title', async (...) => { ... }) in each work recording.");
      }
      tests.push({ statement, title });
      continue;
    }
    throw new Error("Only imports, test.use and one test() are supported in a work recording; top-level helpers/hooks must not be silently dropped.");
  }
  if (tests.length !== 1) throw new Error(`Expected exactly one test() per work recording; found ${tests.length}.`);
  if (uses.length > 1) throw new Error("Expected at most one test.use header per work recording.");
  const { statement, title } = tests[0];
  const start = statement.getStart(file);
  const end = statement.end;
  return {
    text, block: text.slice(start, end), start, end,
    startLine: lineAt(text, start), endLine: lineAt(text, end),
    titleStart: title.getStart(file) - start, titleEnd: title.end - start,
    header: [...imports, ...(uses.length ? ["", uses[0]] : [])].join("\n").trim(),
    imports, uses
  };
}

function renameTestBlock(extracted, title) {
  const replacement = quoteTypeScript(title);
  const { block, titleStart, titleEnd } = extracted;
  const renamed = block.slice(0, titleStart) + replacement + block.slice(titleEnd);
  const delta = replacement.length - (titleEnd - titleStart);
  const sourceLines = extracted.text.split("\n");
  const lineMap = new Map();
  let position = 0;
  sourceLines.forEach((line, index) => {
    const sourceLine = index + 1;
    if (sourceLine >= extracted.startLine && sourceLine <= extracted.endLine) {
      let offset = Math.max(0, position - extracted.start);
      if (offset >= titleEnd) offset += delta;
      else if (offset > titleStart) offset = titleStart;
      lineMap.set(sourceLine, {
        relativeLine: sourceLine - extracted.startLine + 1,
        outputRelativeLine: lineAt(renamed, offset)
      });
    }
    position += line.length + 1;
  });
  return { block: renamed, lineMap };
}

function mergeTypeScript(cases) {
  if (!cases.length) return { code: "", mappings: new Map() };
  const first = extractTestBlock(cases[0].codeTs);
  let code = first.header ? `${first.header}\n\n` : "";
  const mappings = new Map();
  for (const item of cases) {
    const extracted = extractTestBlock(item.codeTs);
    // Recording normally uses identical imports. Reject dependencies the first
    // header would discard, rather than producing an invalid combined module.
    if (extracted.imports.some((value) => !first.imports.includes(value))) {
      throw new Error(`${item.entry.id}: imports differ from the first included case.`);
    }
    const renamed = renameTestBlock(extracted, caseTitle(item.entry));
    const startLine = lineAt(code, code.length);
    const mapping = new Map([...renamed.lineMap].map(([sourceLine, value]) => [sourceLine, {
      relativeLine: value.relativeLine, line: startLine + value.outputRelativeLine - 1
    }]));
    mappings.set(item.entry.id, mapping);
    code += `${renamed.block}\n\n`;
  }
  return { code: code.trimEnd() + "\n", mappings };
}

function closingBrace(mask, open) {
  let depth = 0;
  for (let index = open; index < mask.length; index += 1) {
    if (mask[index] === "{") depth += 1;
    if (mask[index] === "}" && --depth === 0) return index;
  }
  throw new Error("Unbalanced generated C# braces.");
}

function extractCSharpClass(source) {
  const text = normalizeText(source);
  const mask = maskCSharp(text);
  const namespaceMatch = /\bnamespace\s+([\w.]+)\s*\{/.exec(mask);
  if (!namespaceMatch) throw new Error("Expected a block-scoped namespace in generated C#.");
  const namespaceOpen = namespaceMatch.index + namespaceMatch[0].lastIndexOf("{");
  const namespaceEnd = closingBrace(mask, namespaceOpen);
  if (mask.slice(namespaceEnd + 1).trim()) throw new Error("Unexpected code after generated namespace.");
  const prefixMask = mask.slice(0, namespaceMatch.index);
  const usingPattern = /^[ \t]*(?:global[ \t]+)?using[ \t]+[^;\n]+;/gm;
  const usings = [...prefixMask.matchAll(usingPattern)].map((match) => text.slice(match.index, match.index + match[0].length).trim());
  if (prefixMask.replace(usingPattern, "").trim()) throw new Error("Unexpected declarations before generated namespace.");
  const bodyMask = mask.slice(namespaceOpen + 1, namespaceEnd);
  const classMatch = /\bpublic\s+sealed\s+class\s+([A-Za-z_]\w*)\s*\{/.exec(bodyMask);
  if (!classMatch) throw new Error("Expected one public sealed class in generated C#.");
  const classStart = namespaceOpen + 1 + classMatch.index;
  const classOpen = classStart + classMatch[0].lastIndexOf("{");
  const classEnd = closingBrace(mask, classOpen);
  if (mask.slice(namespaceOpen + 1, classStart).trim() || mask.slice(classEnd + 1, namespaceEnd).trim()) {
    throw new Error("Expected exactly one generated class per work file.");
  }
  const comments = text.slice(0, namespaceMatch.index).split("\n")
    .filter((line) => /^\/\/ (Test case:|Source:)/.test(line));
  return {
    namespace: namespaceMatch[1], usings, className: classMatch[1],
    classCode: `${comments.map((line) => `    ${line}`).join("\n")}${comments.length ? "\n" : ""}    ${text.slice(classStart, classEnd + 1)}`
  };
}

function mergeCSharp(cases) {
  return mergeCSharpWithSharedLocators(cases).code;
}

function mergeCSharpWithSharedLocators(cases) {
  const parsed = cases.map((item) => extractCSharpClass(item.codeCs));
  if (!cases.length) return { code: "", sharedLocators: buildSharedLocators([], []).summary };
  const namespace = parsed[0].namespace;
  const names = new Set();
  for (const item of parsed) {
    if (item.namespace !== namespace) throw new Error("Cannot merge different C# namespaces.");
    if (names.has(item.className)) throw new Error(`Duplicate generated class: ${item.className}`);
    names.add(item.className);
  }
  const usings = [...new Set(parsed.flatMap((item) => item.usings))]
    .sort((left, right) => Number(right.startsWith("global ")) - Number(left.startsWith("global ")));
  const shared = buildSharedLocators(cases, parsed);
  if (names.has("Locators")) throw new Error("Generated class conflicts with Locators.");
  const emittedNames = cases.map((item) => `TestCase${item.entry.id.replace(/-/g, "_")}`);
  if (new Set(emittedNames).size !== emittedNames.length) throw new Error("Duplicate generated TestCase class.");
  const classes = [shared.sharedClassCode, ...shared.classCodes].filter(Boolean);
  return { code: `${usings.join("\n")}\n\nnamespace ${namespace}\n{\n${classes.join("\n\n")}\n}\n`, sharedLocators: shared.summary };
}

function isBlocked(report) {
  return Boolean(report && (report.codeGenerationBlocked ||
    (report.strictLocators && (report.locatorRepair?.codeGenerationBlocked || report.locatorValidation?.hasFailures)) || report.validation?.success === false ||
    report.compilation?.success === false ||
    report.dataContract?.blocking || report.methodQualityGate?.blocking));
}

function mergeReports(batchId, cases, generatedAtUtc, sharedLocators = buildSharedLocators([], []).summary) {
  const entries = cases.map((item) => {
    const report = item.report || {};
    return {
      testCaseId: item.entry.id, title: item.entry.title, status: item.entry.status,
      reviewRequired: !["planned", "skipped"].includes(item.entry.status) && Boolean(report.reviewRequired ||
        report.locatorValidation?.hasFailures || report.locatorValidation?.observationCoverage?.status === "INCOMPLETE" ||
        report.unsupportedActions?.length || report.recordingIssues?.length),
      issues: ["planned", "skipped"].includes(item.entry.status) ? [] : collectGenerationIssues(report,
        item.mergeError || (String(item.entry.status).startsWith("failed:") ? item.entry.status : "")),
      included: Boolean(item.included), className: `TestCase${item.entry.id.replace(/-/g, "_")}`,
      internalClassName: report.className || `CodegenFlow${item.entry.id.replace(/-/g, "_")}`,
      actionCount: report.actionCount || 0, unsupportedActions: report.unsupportedActions || [],
      locatorValidation: report.locatorValidation || null, locatorRepair: report.locatorRepair || null,
      dataContract: report.dataContract || null, methodQualityGate: report.methodQualityGate || null,
      codeGenerationBlocked: isBlocked(report) || String(item.entry.status).startsWith("failed:") || Boolean(item.mergeError),
      validation: item.mergeError ? { success: false, errors: [item.mergeError], warnings: [] } : report.validation || null,
      ...(item.mergeError ? { mergeError: item.mergeError } : {})
    };
  });
  for (const conflict of sharedLocators.conflicts) {
    for (const reference of conflict.references) {
      const entry = entries.find((entry) => entry.testCaseId === reference.testCaseId);
      if (!entry?.included) continue;
      entry.reviewRequired = true;
      entry.issues.push({ severity: "warning", kind: "sharedLocatorConflict", ruleId: "SL001",
        sourceLine: reference.actionSourceLines[0], locator: null,
        message: `Shared locator conflict for ${conflict.propertyName}: different original TS expressions; distinct expressions retained in Locators.` });
    }
  }
  return { batchId, generatedAtUtc, sharedLocators, reviewRequired: entries.some((entry) => entry.reviewRequired), codeGenerationBlocked: entries.some((entry) => entry.codeGenerationBlocked), cases: entries };
}

function mergeMetadata(batchId, cases, mappings, generatedAtUtc) {
  const actions = [];
  for (const item of cases) {
    for (const entry of item.metadata?.actions || []) {
      const mapped = mappings.get(item.entry.id)?.get(Number(entry.line));
      if (!mapped) throw new Error(`${item.entry.id}: metadata line ${entry.line} is outside its test block.`);
      actions.push({ ...entry, testCaseId: item.entry.id, sourceLine: Number(entry.line), ...mapped });
    }
  }
  return {
    batchId, generatedAtUtc, codeFilePath: "Code.ts",
    analyzedActions: cases.reduce((sum, item) => sum + Number(item.metadata?.analyzedActions || 0), 0),
    transformedActions: cases.reduce((sum, item) => sum + Number(item.metadata?.transformedActions || 0), 0),
    actions
  };
}

function buildSprint(batchId, cases, generatedAtUtc = new Date().toISOString()) {
  const prepared = cases.map((item) => ({ ...item, included: false }));
  const accepted = [];
  for (const item of prepared) {
    if (!["recorded", "generated"].includes(item.entry.status) || isBlocked(item.report) || !item.codeTs || !item.codeCs || !item.report) continue;
    try {
      if (item.report.validation?.success !== true) throw new Error("Case report does not confirm successful validation.");
      // Recheck actual draft text, not only the previous report, before merging.
      if (item.report.actionFidelity || item.report.compilation) {
        const structural = validateGeneratedCSharp(item.codeCs, []);
        if (!structural.success) throw new Error(structural.errors.join(" | "));
      }
      if (item.report.generatedCodeHash && createHash("sha256").update(normalizeText(item.codeCs)).digest("hex") !== item.report.generatedCodeHash) {
        throw new Error("Generated C# differs from the validated draft; regenerate before merging.");
      }
      const classInfo = extractCSharpClass(item.codeCs);
      const expectedClass = `CodegenFlow${item.entry.id.replace(/-/g, "_")}`;
      if (classInfo.className !== expectedClass || (item.report.className && item.report.className !== classInfo.className)) {
        throw new Error("Generated class identity does not match the case.");
      }
      // Validate the incremental candidate before accepting it. A bad case must
      // not discard earlier good cases or publish metadata with wrong positions.
      const next = [...accepted, item];
      const merged = mergeTypeScript(next);
      mergeCSharp(next);
      mergeMetadata(batchId, next, merged.mappings, generatedAtUtc);
      item.included = true;
      accepted.push(item);
    } catch (error) {
      item.mergeError = error.message;
    }
  }
  const merged = mergeTypeScript(accepted);
  const mergedCSharp = mergeCSharpWithSharedLocators(accepted);
  let mergedCs = mergedCSharp.code;
  const report = mergeReports(batchId, prepared, generatedAtUtc, mergedCSharp.sharedLocators);
  // Class extraction deliberately discards comments outside the class. Restore
  // review markers from report evidence immediately above each included class.
  for (const item of report.cases.filter((item) => item.included && item.reviewRequired)) {
    const name = item.className;
    const header = addReviewHeader(`    public sealed class ${name}`, item.issues);
    mergedCs = mergedCs.replace(`    public sealed class ${name}`, header);
  }
  return {
    codeTs: merged.code, codeCs: mergedCs,
    report,
    metadata: mergeMetadata(batchId, accepted, merged.mappings, generatedAtUtc),
    errors: prepared.filter((item) => item.mergeError).map((item) => `${item.entry.id}: ${item.mergeError}`)
  };
}

function readOptional(file, json = false) {
  if (!fs.existsSync(file)) return null;
  const text = normalizeText(fs.readFileSync(file, "utf8"));
  return json ? JSON.parse(text) : text;
}

function writeArtifactsAtomically(batchFolder, artifacts) {
  const staged = [];
  try {
    for (const [name, content] of Object.entries(artifacts)) {
      const target = path.join(batchFolder, name);
      const temporary = `${target}.${randomUUID()}.tmp`;
      staged.push({ target, temporary });
      fs.writeFileSync(temporary, content, "utf8");
    }
    for (const { target, temporary } of staged) fs.renameSync(temporary, target);
  } finally {
    for (const { temporary } of staged) fs.rmSync(temporary, { force: true });
  }
}

function rebuildSprint(manifestPath) {
  const manifest = readOptional(manifestPath, true);
  if (!manifest || typeof manifest.batchId !== "string" || !manifest.batchId.trim() || !Array.isArray(manifest.testCases)) throw new Error("Invalid batch manifest.");
  const batchFolder = path.dirname(path.resolve(manifestPath));
  const seen = new Set();
  const cases = manifest.testCases.map((entry) => {
    if (!entry || typeof entry.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(entry.id) ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(entry.id) || seen.has(entry.id.toLowerCase())) throw new Error("Invalid or duplicate manifest case ID.");
    seen.add(entry.id.toLowerCase());
    const expectedFolder = `.work/${entry.id}`;
    if (entry.workFolder !== expectedFolder) throw new Error(`Invalid batch manifest: ${entry.id}: expected workFolder '${expectedFolder}'. No outputs were changed.`);
    if (typeof entry.title !== "string" || !entry.title.trim() || typeof entry.status !== "string" ||
      !/^(planned|recorded|generated|skipped|failed: .+)$/.test(entry.status)) throw new Error("Invalid batch manifest case title/status. No outputs were changed.");
    const folder = path.join(batchFolder, expectedFolder);
    // Planned/skipped entries must never inherit stale diagnostics or outputs.
    if (!["recorded", "generated"].includes(entry.status) && !String(entry.status).startsWith("failed:")) return { entry };
    try {
      return {
        entry, mergeError: entry.mergeError, codeTs: readOptional(path.join(folder, "Code.ts")), codeCs: readOptional(path.join(folder, "Code.cs")),
        report: readOptional(path.join(folder, "CSharpGenerationReport.json"), true),
        metadata: readOptional(path.join(folder, "TableLocatorMetadata.json"), true)
      };
    } catch (error) {
      return { entry, mergeError: `Cannot read case artifacts: ${error.message}` };
    }
  });
  const result = buildSprint(manifest.batchId, cases);
  for (const entry of manifest.testCases) {
    const report = result.report.cases.find((item) => item.testCaseId === entry.id);
    entry.issues = report.issues;
    entry.reviewRequired = report.reviewRequired;
  }
  const safeManifest = JSON.parse(JSON.stringify(manifest), (_key, value) => typeof value === "string" ? safeDiagnosticText(value) : value);
  writeArtifactsAtomically(batchFolder, {
    "manifest.json": (JSON.stringify(safeManifest, null, 2) + "\n").replace(/\n/g, "\r\n"),
    "Code.ts": result.codeTs, "Code.cs": result.codeCs,
    "CSharpGenerationReport.json": JSON.stringify(result.report, null, 2) + "\n",
    "TableLocatorMetadata.json": JSON.stringify(result.metadata, null, 2) + "\n"
  });
  return result;
}

if (require.main === module) {
  try {
    const summaryIndex = process.argv.indexOf("--review-summary");
    if (summaryIndex >= 0) {
      const manifest = readOptional(process.argv[summaryIndex + 1], true);
      const cases = manifest.testCases.filter((entry) => entry.reviewRequired);
      console.log(`${cases.length} case(s) need review`);
      for (const entry of cases) for (const line of formatGenerationIssues(entry.id, entry.issues || [])) console.log(line);
      return;
    }
    const index = process.argv.indexOf("--manifest-file");
    if (index < 0 || !process.argv[index + 1]) throw new Error("Required argument: --manifest-file <manifest.json>");
    const result = rebuildSprint(process.argv[index + 1]);
    for (const entry of result.report.cases) {
      for (const line of formatGenerationIssues(entry.testCaseId, entry.issues)) console.log(line);
    }
    console.log(`[SprintMerger] Included ${result.report.cases.filter((entry) => entry.included).length} case(s); blocked=${result.report.codeGenerationBlocked}`);
    if (result.errors.length) {
      console.error(`[SprintMerger] ${safeDiagnosticText(result.errors.join(" | "))}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[SprintMerger] ${safeDiagnosticText(error.message)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  quoteTypeScript, extractTestBlock, renameTestBlock, mergeTypeScript,
  extractCSharpClass, mergeCSharp, mergeCSharpWithSharedLocators, mergeReports, mergeMetadata, buildSprint, rebuildSprint
};