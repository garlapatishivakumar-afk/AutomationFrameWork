"use strict";

const ts = require("typescript");

// Slice the AST receiver, never reconstruct/trim/normalize its contents. This
// includes the actor, options, quote style, casing, comments and entire chain.
// The recorder currently parses one action per line; unsupported/multiline
// actions and page-level operations intentionally have no locator provenance.
function extractOriginalLocator(raw) {
  const text = String(raw || "");
  const file = ts.createSourceFile("action.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length || file.statements.length !== 1) return null;
  const statement = file.statements[0];
  if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression)) return null;
  const call = statement.expression.expression;
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return null;
  let locator = call.expression.expression;
  if (ts.isCallExpression(locator) && ts.isIdentifier(locator.expression) && locator.expression.text === "expect") {
    if (locator.arguments.length !== 1) return null;
    locator = locator.arguments[0];
  }
  if (!ts.isCallExpression(locator)) return null;
  let root = locator;
  while (ts.isCallExpression(root) && ts.isPropertyAccessExpression(root.expression)) root = root.expression.expression;
  if (!ts.isIdentifier(root)) return null;
  return { originalExpression: text.slice(locator.getStart(file), locator.end), actor: root.text };
}

// Offset-preserving mask for the generator's ordinary/verbatim C# strings,
// character literals and comments. Replacements never inspect their contents.
function maskCSharp(text) {
  return text.replace(/@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (match) => match.replace(/[^\n]/g, " "));
}

function editsApplied(text, edits) {
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  return text;
}

function replaceLocatorReferences(text, replacements, fieldName) {
  const mask = maskCSharp(text);
  const edits = [];
  for (const match of mask.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const replacement = replacements.get(match[0]);
    if (!replacement) continue;
    const before = mask.slice(0, match.index).trimEnd();
    const after = mask.slice(match.index + match[0].length).trimStart();
    // Only receiver/argument uses emitted by the generator, not method names,
    // declarations, or members on some other object (e.g. Page.SomeName).
    const onThis = /\bthis\.$/.test(before);
    if (before.endsWith(".") && !onThis) continue;
    if (!after.startsWith(".") && !(/^[,)]/.test(after) && (onThis || /[(,]$/.test(before)))) continue;
    edits.push({ start: match.index, end: match.index + match[0].length, text: `${fieldName}.${replacement}` });
  }
  return editsApplied(text, edits);
}

function declarations(text) {
  const mask = maskCSharp(text);
  const result = new Map();
  for (const match of mask.matchAll(/^[ \t]*public\s+ILocator\b/gm)) {
    const header = /^public\s+ILocator\s+([A-Za-z_]\w*)\s*=>/.exec(mask.slice(match.index).trimStart());
    if (!header) throw new Error("Unsupported locator declaration; refusing to omit it.");
    const arrow = mask.indexOf("=>", match.index);
    const expressionStart = arrow + 2;
    const semicolon = statementEnd(mask, expressionStart);
    const name = header[1];
    if (result.has(name)) throw new Error(`Duplicate locator declaration: ${name}`);
    const lineEnd = text.indexOf("\n", semicolon);
    const end = lineEnd < 0 ? text.length : lineEnd + 1;
    if (mask.slice(semicolon + 1, end).trim()) throw new Error(`Unsupported trailing code on locator ${name}.`);
    // Move attached lineage/review comments with the property, not the actions.
    let start = match.index;
    while (start > 0) {
      const previous = text.lastIndexOf("\n", start - 2) + 1;
      if (!/^\s*\/\/\s*(?:\[TLL\b|REVIEW\b)/i.test(text.slice(previous, start))) break;
      start = previous;
    }
    result.set(name, { start, end,
      expression: text.slice(expressionStart, semicolon).trim(),
      comments: text.slice(start, match.index) + text.slice(semicolon + 1, end),
      text: text.slice(start, end) });
  }
  return result;
}

// The generated subset uses balanced expressions, including object initializers.
// A missing terminator must not consume the next member/action silently.
function statementEnd(mask, start) {
  const stack = [];
  for (let i = start; i < mask.length; i++) {
    const ch = mask[i];
    if ("({[".includes(ch)) stack.push(ch);
    else if (")}]".includes(ch)) {
      if (stack.pop() !== ({ ")": "(", "}": "{", "]": "[" })[ch]) break;
    } else if (ch === ";" && !stack.length) return i;
    if (!stack.length && !/[A-Za-z0-9_]/.test(mask[i - 1] || "") && (/^(?:public|private|return)\b/.test(mask.slice(i)) ||
      (/^await\b/.test(mask.slice(i)) && mask.slice(start, i).trim()))) break;
  }
  throw new Error("Broken locator/assignment expression; refusing to omit generated code.");
}

function bindingSite(text, className) {
  const mask = maskCSharp(text);
  const constructor = mask.indexOf(`public ${className}(IPage page, ConfigReader config)`);
  if (constructor < 0) return null;
  const open = mask.indexOf("{", constructor);
  const close = mask.indexOf("}", open);
  const assignment = /\bPage\s*=\s*page\s*\?\?\s*throw\s+new\s+ArgumentNullException\(nameof\(page\)\);/.exec(mask.slice(open, close));
  if (!assignment) return null;
  return { constructor, assignmentEnd: open + assignment.index + assignment[0].length };
}

/**
 * Pure merge transformation. cases carry entry.id, codeTs and a generator report;
 * parsed carry className/classCode from SprintMerger's validated extraction.
 * summary is JSON-safe, versioned, and uses per-case ORIGINAL action line numbers.
 * Never writes drafts or mutates inputs. No provenance => no sharing.
 */
function buildSharedLocators(cases, parsed) {
  const summary = { version: 1, sharedCount: 0, replacedPropertyCount: 0, shared: [], conflicts: [], skipped: [] };
  const candidates = [];
  const sites = parsed.map((item) => bindingSite(item.classCode, item.className));
  const decls = parsed.map((item) => declarations(item.classCode));
  cases.forEach((item, caseIndex) => {
    if (item.report?.locatorProvenanceVersion !== 1 || !Array.isArray(item.report.generatedLocators)) return;
    const sourceLines = String(item.codeTs || "").split(/\r?\n/);
    const nameCounts = new Map();
    for (const locator of item.report.generatedLocators) {
      nameCounts.set(locator?.propertyName, (nameCounts.get(locator?.propertyName) || 0) + 1);
    }
    for (const locator of item.report.generatedLocators) {
      const skip = (reason) => summary.skipped.push({ testCaseId: item.entry.id, propertyName: locator?.propertyName || null, reason });
      if (!locator || !/^[A-Za-z_]\w*$/.test(locator.propertyName) ||
          typeof locator.originalExpression !== "string" || !locator.originalExpression ||
          !Array.isArray(locator.actionSourceLines) || !locator.actionSourceLines.length) { skip("missing-provenance"); continue; }
          if (nameCounts.get(locator.propertyName) !== 1) { skip("ambiguous-property-provenance"); continue; }
      if (!locator.actionSourceLines.every((line) => {
        if (!Number.isInteger(line) || line < 1) return false;
        const original = extractOriginalLocator(sourceLines[line - 1]);
        return original?.originalExpression === locator.originalExpression && original.actor === locator.actor;
      })) { skip("source-provenance-mismatch"); continue; }
      const declaration = decls[caseIndex].get(locator.propertyName);
      if (!declaration || declaration.expression !== locator.locatorExpression || !sites[caseIndex]) {
        skip("unsupported-draft-shape"); continue;
      }
      candidates.push({ ...locator, testCaseId: item.entry.id, caseIndex, declaration });
    }
  });

  const byName = new Map();
  for (const candidate of candidates) {
    if (!byName.has(candidate.propertyName)) byName.set(candidate.propertyName, []);
    byName.get(candidate.propertyName).push(candidate);
  }
  for (const [propertyName, group] of byName) {
    if (new Set(group.map((item) => item.originalExpression)).size < 2) continue;
    summary.conflicts.push({ propertyName, reason: "same-name-different-original-expression",
      references: group.map(reference) });
  }

  const byExpression = new Map();
  for (const candidate of candidates) {
    // Name conflicts are review evidence, not selector identity. An exact pair
    // can still share when a third case uses the same name for another selector.
    if (candidate.actor !== "page" || !candidate.locatorExpression.startsWith("Page.")) {
      summary.skipped.push({ testCaseId: candidate.testCaseId, propertyName: candidate.propertyName, reason: "non-main-page-actor" });
      continue;
    }
    if (!byExpression.has(candidate.originalExpression)) byExpression.set(candidate.originalExpression, []);
    byExpression.get(candidate.originalExpression).push(candidate);
  }
  const chosen = new Map();
  const usedNames = new Set(["Page", "Locators", "SharedLocators"]);
  for (const [originalExpression, group] of byExpression) {
    if (new Set(group.map((item) => item.testCaseId)).size < 2) continue;
    // Repair/framework differences must not be overwritten by the first case.
    if (new Set(group.map((item) => item.locatorExpression)).size !== 1) {
      for (const item of group) summary.skipped.push({ testCaseId: item.testCaseId, propertyName: item.propertyName, reason: "different-generated-expression" });
      continue;
    }
    const base = group[0].propertyName;
    let propertyName = base, suffix = 2;
    while (usedNames.has(propertyName)) propertyName = `${base}${suffix++}`;
    usedNames.add(propertyName);
    for (const item of group) chosen.set(item, propertyName);
    summary.shared.push({ propertyName, originalExpression, locatorExpression: group[0].locatorExpression,
      caseIds: [...new Set(group.map((item) => item.testCaseId))], references: group.map(reference) });
  }
  summary.sharedCount = summary.shared.length;
  summary.replacedPropertyCount = chosen.size;
  return projectUnifiedLocators(cases, parsed, decls, sites, candidates, chosen, summary);
}

function renameIdentifier(text, from, to) {
  return editsApplied(text, [...maskCSharp(text).matchAll(/\b[A-Za-z_]\w*\b/g)]
    .filter((match) => match[0] === from)
    .map((match) => ({ start: match.index, end: match.index + from.length, text: to })));
}

function locatorUses(text, names) {
  const mask = maskCSharp(text);
  return [...mask.matchAll(/\b[A-Za-z_]\w*\b/g)].filter((match) => {
    if (!names.has(match[0])) return false;
    const before = mask.slice(0, match.index).trimEnd();
    const after = mask.slice(match.index + match[0].length).trimStart();
    const onThis = /\bthis\s*\.\s*$/.test(before);
    return (!before.endsWith(".") || onThis) &&
      (after.startsWith(".") || (/^[,)]/.test(after) && (onThis || /[(,]$/.test(before))));
  }).map((match) => {
    const thisPrefix = /\bthis\s*\.\s*$/.exec(mask.slice(0, match.index));
    return { name: match[0], start: thisPrefix ? thisPrefix.index : match.index, end: match.index + match[0].length };
  });
}

function methods(text) {
  const mask = maskCSharp(text);
  const result = [];
  for (const match of mask.matchAll(/^[ \t]*(?:public|private|protected|internal)\s+(?:(?:static|async)\s+)*(?:Task(?:<IPage>)?|void)\s+\w+\s*\(([^()]*)\)\s*\{/gm)) {
    const open = match.index + match[0].lastIndexOf("{");
    let depth = 1, end = open + 1;
    for (; end < mask.length && depth; end++) {
      if (mask[end] === "{") depth++;
      if (mask[end] === "}") depth--;
    }
    if (depth) throw new Error("Unbalanced generated method.");
    result.push({ open, end, parameters: [...match[1].matchAll(/\bIPage\s+([A-Za-z_]\w*)/g)].map((m) => m[1]) });
  }
  return result;
}

/** Final-output projection only. The shared* API names/summary retain their sync
 * meaning: exact cross-case main-page sharing, NOT the total unified count. */
function projectUnifiedLocators(cases, parsed, decls, sites, candidates, chosen, summary) {
  const groups = summary.shared.map((shared) => ({ shared, entries: [] }));
  const entries = [];
  parsed.forEach((item, caseIndex) => {
    for (const [propertyName, declaration] of decls[caseIndex]) {
      const root = /^(Page|_[A-Za-z_]\w*)\s*\./.exec(maskCSharp(declaration.expression));
      if (!root || (root[1] !== "Page" && !new RegExp(`\\bIPage\\s+${root[1]}\\b`).test(maskCSharp(item.classCode)))) {
        throw new Error(`${cases[caseIndex].entry.id}: unsupported locator receiver for ${propertyName}.`);
      }
      const candidate = candidates.find((c) => c.caseIndex === caseIndex && c.propertyName === propertyName);
      const entry = { caseIndex, testCaseId: cases[caseIndex].entry.id, propertyName, declaration,
        actor: root[1], candidate };
      let group = candidate && chosen.has(candidate) ? groups.find((g) => g.shared.propertyName === chosen.get(candidate)) : null;
      if (!group) { group = { entries: [] }; groups.push(group); }
      group.entries.push(entry);
      entry.group = group;
      entries.push(entry);
    }
  });
  const used = new Set(["Page", "Locators"]);
  const bases = groups.map((g) => g.shared?.propertyName || g.entries[0].propertyName);
  // Shared groups precede every unique/popup group, reserving their common
  // names first. Only the differing definitions receive case/actor suffixes.
  groups.forEach((group, index) => {
    const first = group.entries[0];
    const base = bases[index];
    const suffix = `${first.testCaseId.replace(/[^A-Za-z0-9_]/g, "_")}_${first.actor === "Page" ? "page" : first.actor.slice(1)}`;
    let name = (!group.shared && bases.filter((b) => b === base).length > 1) || used.has(base) ? `${base}_${suffix}` : base;
    let number = 2;
    while (used.has(name) || (name !== base && bases.includes(name))) name = `${base}_${suffix}_${number++}`;
    used.add(name);
    group.name = name;
    if (group.shared) {
      group.shared.emittedPropertyName = name;
      for (const ref of group.shared.references) ref.emittedPropertyName = name;
    }
  });
  for (const conflict of summary.conflicts) for (const ref of conflict.references) {
    ref.emittedPropertyName = entries.find((e) => e.testCaseId === ref.testCaseId && e.propertyName === ref.propertyName)?.group.name;
  }

  const classCodes = parsed.map((item, index) => {
    const own = entries.filter((e) => e.caseIndex === index);
    let text = item.classCode;
    if (own.length) {
      const site = sites[index];
      if (!site) throw new Error(`${cases[index].entry.id}: cannot safely bind unified locators in constructor.`);
      const identifiers = new Set(maskCSharp(text).match(/\b[A-Za-z_]\w*\b/g));
      const allocate = (base) => { let name = base, n = 2; while (identifiers.has(name)) name = `${base}${n++}`; identifiers.add(name); return name; };
      const main = allocate("_locators");
      const actors = [...new Set(own.filter((e) => e.actor !== "Page").map((e) => e.actor))];
      const fields = new Map(actors.map((actor) => [actor, allocate(`${actor}Locators`)]));
      const edits = own.map((e) => ({ start: e.declaration.start, end: e.declaration.end, text: "" }));
      edits.push({ start: site.assignmentEnd, end: site.assignmentEnd, text: `\n            ${main} = new Locators(Page);` });
      const fieldStart = text.lastIndexOf("\n", site.constructor) + 1;
      edits.push({ start: fieldStart, end: fieldStart, text: `        private readonly Locators ${main};\n` +
        [...fields.values()].map((field) => `        private Locators ${field} = default!;\n`).join("") + "\n" });
      text = editsApplied(text, edits).replace(/^[ \t]*\/\/ Locators\s*\n/gm, "");
      const uses = locatorUses(text, new Set(own.map((e) => e.propertyName)));
      const scopes = methods(text);
      const changes = [];
      const scopeBindings = new Map();
      for (const scope of scopes) {
        const activeActors = [...new Set(uses.filter((u) => u.start > scope.open && u.end < scope.end)
          .map((u) => own.find((e) => e.propertyName === u.name).actor).filter((a) => a !== "Page"))];
        const bindings = new Map();
        const remaining = new Set(scope.parameters);
        for (const actor of activeActors) {
          const parameter = scope.parameters.find((p) => p === actor.slice(1));
          if (parameter) { bindings.set(actor, parameter); remaining.delete(parameter); }
        }
        // Enterprise popup methods can receive one existing popup and open a
        // second inside the method. That second actor must use its own freshly
        // assigned field, never the incoming popupPage parameter.
        const scopeMask = maskCSharp(text.slice(scope.open + 1, scope.end));
        const unbound = activeActors.filter((actor) => !bindings.has(actor) &&
          !new RegExp(`^[ \\t]*(?:this\\.)?${actor}\\s*=(?!=)`, "m").test(scopeMask));
        if (remaining.size && unbound.length) {
          if (remaining.size !== 1 || unbound.length !== 1) throw new Error("Ambiguous popup parameter binding; refusing to use a stale popup field.");
          bindings.set(unbound[0], [...remaining][0]);
        }
        const localNames = new Set(maskCSharp(text.slice(scope.open, scope.end)).match(/\b[A-Za-z_]\w*\b/g));
        for (const parameter of scope.parameters) localNames.add(parameter);
        for (const [actor, parameter] of bindings) {
          const base = parameter === "popupPage" ? "popupLocators" : `${parameter}Locators`;
          let local = base, suffix = 2;
          while (localNames.has(local)) local = `${base}${suffix++}`;
          localNames.add(local);
          changes.push({ start: scope.open + 1, end: scope.open + 1, text: `\n            var ${local} = new Locators(${parameter});` });
          bindings.set(actor, local);
        }
        scopeBindings.set(scope, bindings);
      }
      const mask = maskCSharp(text);
      for (const actor of actors) {
        const assignments = [...mask.matchAll(new RegExp(`^([ \\t]*)(?:this\\.)?${actor}\\s*=(?!=)`, "gm"))];
        const needsField = uses.some((u) => own.find((e) => e.propertyName === u.name).actor === actor &&
          !scopeBindings.get(scopes.find((s) => u.start > s.open && u.end < s.end))?.has(actor));
        if (!assignments.length && needsField) throw new Error(`Missing popup assignment for ${actor}.`);
        for (const assignment of assignments) {
          const end = statementEnd(mask, assignment.index + assignment[0].length) + 1;
          const scope = scopes.find((s) => assignment.index > s.open && end < s.end);
          if (!scope) throw new Error(`Unsupported popup assignment for ${actor}.`);
          const before = mask.slice(scope.open + 1, assignment.index);
          const depth = [...before].reduce((n, ch) => n + (ch === "{" ? 1 : ch === "}" ? -1 : 0), 0);
          if (depth !== 0 || /\b(?:if|for|foreach|while|else)\b[^;{}]*$/.test(before)) {
            throw new Error(`Unsupported conditional popup assignment for ${actor}.`);
          }
          if (!scopeBindings.get(scope).has(actor) && !assignments.some((a) => a.index > scope.open && a.index < assignment.index) &&
              uses.some((u) => u.start > scope.open && u.start < assignment.index && own.find((e) => e.propertyName === u.name).actor === actor)) {
            throw new Error(`Popup locator used before assignment for ${actor}.`);
          }
          // Preserve an assignment's trailing review/TLL comment on that action.
          const lineEnd = text.indexOf("\n", end);
          const insert = lineEnd >= 0 && !mask.slice(end, lineEnd).trim() ? lineEnd : end;
          changes.push({ start: insert, end: insert, text: `\n${assignment[1]}${fields.get(actor)} = new Locators(${actor});` });
        }
      }
      for (const use of uses) {
        const entry = own.find((e) => e.propertyName === use.name);
        const scope = scopes.find((s) => use.start > s.open && use.end < s.end);
        if (!scope) throw new Error(`Unsupported locator use outside generated method: ${use.name}`);
        const binding = entry.actor === "Page" ? main : scopeBindings.get(scope).get(entry.actor) || fields.get(entry.actor);
        changes.push({ start: use.start, end: use.end, text: `${binding}.${entry.group.name}` });
      }
      text = editsApplied(text, changes);
    }
    const banner = ["    // =========================================================",
      `    // TEST CASE ${cases[index].entry.id}`,
      "    // ========================================================="].join("\n");
    return banner + "\n" + renameIdentifier(text, item.className, `TestCase${cases[index].entry.id.replace(/-/g, "_")}`);
  });

  const sections = new Map();
  for (const group of groups) {
    const first = group.entries[0];
    const section = group.shared ? "Shared locators" : `Case ${first.testCaseId}${first.actor === "Page" ? "" : ` popup ${first.actor.slice(1)}`}`;
    if (!sections.has(section)) sections.set(section, []);
    const expression = first.declaration.expression.replace(new RegExp(`^${first.actor}\\s*\\.`), "Page.");
    sections.get(section).push(`        public ILocator ${group.name} => ${expression};`);
  }
  const properties = [...sections.values()].flat();
  const sharedClassCode = parsed.length ? ["    public sealed class Locators", "    {",
    "        private IPage Page { get; }", "", "        public Locators(IPage page)", "        {",
    "            Page = page ?? throw new System.ArgumentNullException(nameof(page));", "        }", "", ...properties, "    }"].join("\n") : "";
  return { classCodes, sharedClassCode, summary };
}

function reference(item) {
  return { testCaseId: item.testCaseId, propertyName: item.propertyName,
    originalExpression: item.originalExpression, actor: item.actor,
    actionSourceLines: [...item.actionSourceLines],
    tllSourceLines: (Array.isArray(item.tllSourceLines) ? item.tllSourceLines : []).filter((line) => item.actionSourceLines.includes(line)) };
}

module.exports = { extractOriginalLocator, maskCSharp, replaceLocatorReferences, buildSharedLocators };