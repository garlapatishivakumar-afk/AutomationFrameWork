"use strict";

// STAGE2A: a deliberately closed AST language. No line parser, eval, replay,
// repair, or fallback draft is used. A failed lowering discards the whole case.
const ts = require("typescript");
const { LocatorValidator } = require("../Intelligence/LocatorValidator.cjs");
const { inspectRecordingGuards, collectGenerationIssues } = require("./CSharpCodeGenerator.cjs");
const parse = (source) => ts.createSourceFile("Code.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const pascal = (s) => s === "dblclick" ? "DblClick" : s[0].toUpperCase() + s.slice(1);
const quote = (s) => JSON.stringify(s).replace(/[\u0085\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const line = (file, node) => file.getLineAndCharacterOfPosition(typeof node === "number" ? node : node.getStart(file)).line + 1;
const diagnostic = (code, message, sourceLine = null, severity = "error") => ({ code, ruleId: code, message, sourceLine, severity });
const asyncBlock = n => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && !n.asteriskToken && ts.isBlock(n.body) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword);
function blocked(code, message) { const e = new Error(`${code}: ${message}`); e.code = code; throw e; }

// Scanner tokens, not regex over source: quoted/commented arrows are data.
// Mask actual annotations only to recover case boundaries; never generate them.
function annotations(source) {
  const protectedRanges = [];
  const protect = n => {
    if (ts.isStringLiteral(n) || ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isRegularExpressionLiteral(n)) {
      protectedRanges.push([n.getStart(), n.end]); return;
    }
    ts.forEachChild(n, protect);
  };
  protect(parse(source));
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  const tokens = [];
  for (let k = scanner.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = scanner.scan()) {
    tokens.push({ k, start: scanner.getTokenPos(), end: scanner.getTextPos() });
  }
  const ranges = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].k !== ts.SyntaxKind.SemicolonToken || protectedRanges.some(([a, b]) => tokens[i].start >= a && tokens[i].start < b)) continue;
    let j = i + 1;
    while (tokens[j]?.k === ts.SyntaxKind.WhitespaceTrivia) j++;
    if (tokens[j]?.k === ts.SyntaxKind.MinusToken && tokens[j + 1]?.k === ts.SyntaxKind.GreaterThanToken) {
      const start = tokens[j].start, end = source.indexOf("\n", start);
      ranges.push({ start, end: end < 0 ? source.length : end });
    }
  }
  let masked = source;
  for (const r of ranges.slice().reverse()) masked = masked.slice(0, r.start) + masked.slice(r.start, r.end).replace(/[^\r\n]/g, " ") + masked.slice(r.end);
  return { source: masked, ranges };
}

function discover(source, manifest, boundaries) {
  if (!manifest || !Array.isArray(manifest.testCases) || typeof manifest.batchId !== "string" || !manifest.batchId.trim()) blocked("ID001", "Invalid manifest.");
  const ids = new Set(), classes = new Set();
  for (const e of manifest.testCases) {
    const name = String(e?.id || "").replace(/-/g, "_");
    if (!e || typeof e.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(e.id) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(e.id) ||
      ids.has(e.id.toLowerCase()) || classes.has(name.toLowerCase()) || typeof e.title !== "string" ||
      !/^(planned|skipped|recorded|generated|failed: .+)$/.test(e.status || "") || e.workFolder !== `.work/${e.id}`) blocked("ID001", "Invalid or duplicate manifest identity/workFolder.");
    ids.add(e.id.toLowerCase()); classes.add(name.toLowerCase());
  }
  if (boundaries?.version !== 1 || !Array.isArray(boundaries.cases)) blocked("ID001", "Generation requires version 1 boundaries.json.");
  const required = new Set(manifest.testCases.filter(e => !["planned", "skipped"].includes(e.status)).map(e => e.id));
  const saved = new Set();
  for (const b of boundaries.cases) {
    if (!b || !manifest.testCases.some(e => e.id === b.id) || saved.has(b.id)) blocked("ID001", "Unknown or duplicate boundary identity.");
    saved.add(b.id); required.add(b.id);
  }
  const cleaned = annotations(source), file = parse(cleaned.source), cases = [], seen = new Set();
  for (const statement of file.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (statement.moduleSpecifier.text !== "@playwright/test" || !clause || clause.name || clause.isTypeOnly ||
        !clause.namedBindings || !ts.isNamedImports(clause.namedBindings) ||
        clause.namedBindings.elements.some(e => e.propertyName || e.isTypeOnly || !["test", "expect"].includes(e.name.text))) blocked("GEN001", "Only named Playwright test/expect imports are supported.");
      continue;
    }
    const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
    if (!call || !ts.isIdentifier(call.expression) || call.expression.text !== "test") blocked(file.parseDiagnostics.length ? "GEN002" : "GEN001", "Top-level executable setup/hooks/helpers cannot be omitted.");
    const [title, callback] = call.arguments;
    if (!title || !ts.isStringLiteral(title)) blocked("ID001", "Expected a literal ID - title test name.");
    const prefix = /^([A-Za-z0-9_-]+) - ([\s\S]*)$/.exec(title.text);
    const entry = prefix && manifest.testCases.find(e => e.id === prefix[1]);
    if (!entry || seen.has(entry.id)) blocked("ID001", "Unknown or duplicate test ID.");
    seen.add(entry.id);
    if (!asyncBlock(callback) || call.arguments.length !== 2) blocked(file.parseDiagnostics.length ? "GEN002" : "GEN001", "Expected ordinary async test block.");
    // Nested tests could be parser recovery after an unclosed preceding test.
    const nested = n => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "test") blocked("GEN002", "Nested or swallowed test boundary; syntax cannot be isolated safely.");
      ts.forEachChild(n, nested);
    };
    ts.forEachChild(callback.body, nested);
    const issues = [];
    for (const r of cleaned.ranges.filter(r => r.start >= callback.body.pos && r.start < callback.body.end)) issues.push(diagnostic("REC002", "Recorder ; -> annotation is executable text. Replace it with a comment or assertion.", line(file, r.start)));
    cases.push({ entry, title: prefix[2], titleChanged: prefix[2] !== entry.title, statement, callback, diagnostics: issues,
      startLine: line(file, statement), endLine: line(file, statement.end), sourceHashInput: source.slice(statement.getStart(file), statement.end) });
  }
  for (const id of required) if (!seen.has(id)) blocked("ID001", `Missing test block for ${id}.`);
  if (!cases.length) blocked("ID001", "No test blocks discovered.");
  // Only interior errors with independently valid remaining syntax are isolatable.
  const bad = new Set();
  for (const d of file.parseDiagnostics) {
    const item = cases.find(c => d.start > c.callback.body.getStart(file) && d.start + (d.length || 0) < c.callback.body.end - 1);
    if (!item || !/\}\s*\)\s*;?$/.test(cleaned.source.slice(item.statement.getStart(file), item.statement.end))) blocked("GEN002", "Invalid syntax crosses a test boundary; publication blocked.");
    bad.add(item);
    item.diagnostics.push(diagnostic("GEN002", "Invalid TypeScript syntax inside this test block.", line(file, d.start)));
  }
  let repaired = cleaned.source;
  for (const item of [...bad].sort((a, b) => b.callback.body.pos - a.callback.body.pos)) {
    const start = item.callback.body.getStart(file) + 1, end = item.callback.body.end - 1;
    repaired = repaired.slice(0, start) + repaired.slice(start, end).replace(/[^\r\n]/g, " ") + repaired.slice(end);
  }
  if (parse(repaired).parseDiagnostics.length) blocked("GEN002", "Syntax isolation failed.");
  if (cleaned.ranges.some(r => !cases.some(c => r.start > c.callback.body.pos && r.start < c.callback.body.end))) blocked("REC002", "Annotation outside a test block.");
  return { file, cases };
}

function lowerCase(file, item, options = {}) {
  const diagnostics = [...item.diagnostics], actions = [], sourceMap = [], rows = [];
  let serial = 0, assertionCount = 0, navigated = false;
  const fail = (n, message = "Unsupported executable syntax. For scalar text/equality logic use locator.filter({ hasText: ... }) plus a locator assertion.") => {
    const e = new Error(message); e.diagnostic = diagnostic("GEN001", message, line(file, n)); throw e;
  };
  const emit = (text, n) => { rows.push(text); if (n) sourceMap.push({ sourceLine: line(file, n), sourceStart: n.getStart(file), sourceEnd: n.end, generatedLine: rows.length }); };
  const count = (args, min, max = min, n) => { if (args.length < min || args.length > max) fail(n, "Unsupported argument signature; no arguments may be omitted."); };
  const literal = n => {
    if (n && ts.isStringLiteral(n)) return n.text;
    if (n && ts.isNumericLiteral(n)) return Number(n.text);
    if (n?.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (n?.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (n && ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -Number(n.operand.text);
    fail(n || item.callback, "Only literal arguments are supported; template strings, expressions and scalar logic are out of scope. Use locator filter hasText plus a locator assertion.");
  };
  const string = n => { const v = literal(n); if (typeof v !== "string") fail(n); return v; };
  const number = n => { const v = literal(n); if (typeof v !== "number" || !Number.isFinite(v)) fail(n); return v; };
  const integer = n => { const v = number(n); if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) fail(n); return v; };
  const object = (n, allowed) => {
    if (!n) return {};
    if (!ts.isObjectLiteralExpression(n)) fail(n);
    const result = {};
    for (const p of n.properties) {
      if (!ts.isPropertyAssignment(p) || ![ts.SyntaxKind.Identifier, ts.SyntaxKind.StringLiteral].includes(p.name.kind) ||
        !allowed.includes(p.name.text) || Object.hasOwn(result, p.name.text)) fail(p);
      result[p.name.text] = p.initializer;
    }
    return result;
  };
  const csOptions = values => Object.keys(values).length ? `, new() { ${Object.entries(values).map(([k, v]) => `${pascal(k)} = ${v}`).join(", ")} }` : "";
  const interaction = n => { if (!navigated) { const e = new Error(); e.diagnostic = diagnostic("REC001", "An initial guaranteed awaited page.goto is required before browser interaction.", line(file, n)); throw e; } };
  const record = (n, receiver, actionType, value) => {
    // Validate every locator component, including relative has filters/scopes.
    for (const component of receiver?.components || []) actions.push({ sourceLine: line(file, n), raw: `await ${receiver.raw}.click();`, actionType,
      supported: true, locator: component, value: value ?? null, targetElement: component.role || component.kind });
  };
  const resolve = (n, env) => {
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    if (ts.isIdentifier(n)) { const v = env.get(n.text); if (!v || v.kind === "uninitialized") fail(n, "Unbound/cross-case or not-yet-initialized variable; helpers and scalar values are not supported."); return v; }
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.typeArguments?.length) fail(n);
    const receiver = resolve(n.expression.expression, env), method = n.expression.name.text, args = n.arguments;
    const raw = n.getText(file), base = receiver.cs, components = [...(receiver.components || [])];
    if (!["page", "locator", "frame"].includes(receiver.kind)) fail(n);
    let cs, component;
    if (["first", "last", "nth"].includes(method) && receiver.kind === "locator") {
      count(args, method === "nth" ? 1 : 0, undefined, n);
      cs = method === "nth" ? `${base}.Nth(${integer(args[0])})` : `${base}.${pascal(method)}`;
    } else if (method === "contentFrame" && receiver.kind === "locator") {
      count(args, 0, 0, n); return { kind: "frame", cs: `${base}.ContentFrame`, raw, components };
    } else if (method === "frameLocator") {
      count(args, 1, 1, n); const value = string(args[0]);
      components.push({ kind: "locator", selector: value });
      return { kind: "frame", cs: `${base}.FrameLocator(${quote(value)})`, raw, components };
    } else if (method === "filter" && receiver.kind === "locator") {
      count(args, 1, 1, n); const opts = object(args[0], ["hasText", "has"]), values = {};
      if (!Object.keys(opts).length) fail(n);
      if (opts.hasText) values.hasText = quote(string(opts.hasText));
      if (opts.has) { const has = resolve(opts.has, env); if (has.kind !== "locator") fail(opts.has); values.has = has.cs; components.push(...has.components); }
      cs = `${base}.Filter(new() { ${Object.entries(values).map(([k, v]) => `${pascal(k)} = ${v}`).join(", ")} })`;
    } else if (method === "locator") {
      count(args, 1, 1, n); const value = string(args[0]); component = { kind: "locator", selector: value };
      cs = `${base}.Locator(${quote(value)})`;
    } else if (["getByRole", "getByText", "getByLabel", "getByPlaceholder", "getByTitle", "getByTestId", "getByAltText"].includes(method)) {
      count(args, 1, method === "getByTestId" ? 1 : 2, n);
      const value = string(args[0]), opts = object(args[1], method === "getByRole" ? ["name", "exact"] : ["exact"]), values = {};
      if (opts.name) values.name = quote(string(opts.name));
      if (opts.exact) { const b = literal(opts.exact); if (typeof b !== "boolean") fail(opts.exact); values.exact = String(b); }
      if (method === "getByRole" && !/^[a-z]+$/.test(value)) fail(args[0]);
      const kinds = { getByRole: "role", getByText: "text", getByLabel: "label", getByPlaceholder: "placeholder", getByTitle: "title", getByTestId: "testid", getByAltText: "altText" };
      component = method === "getByRole" ? { kind: "role", role: value, name: opts.name ? string(opts.name) : value } : { kind: kinds[method], text: value };
      cs = `${base}.${pascal(method)}(${method === "getByRole" ? `AriaRole.${pascal(value)}` : quote(value)}${csOptions(values)})`;
    } else fail(n);
    if (component) components.push(component);
    return { kind: "locator", cs, raw, components };
  };
  const assertion = (call, env) => {
    if (!ts.isPropertyAccessExpression(call.expression)) return null;
    let target = call.expression.expression, not = false;
    if (ts.isPropertyAccessExpression(target) && target.name.text === "not") { not = true; target = target.expression; }
    if (!ts.isCallExpression(target) || !ts.isIdentifier(target.expression) || target.expression.text !== "expect") return null;
    count(target.arguments, 1, 1, target);
    const receiver = resolve(target.arguments[0], env), method = call.expression.name.text, args = call.arguments;
    const zero = ["toBeVisible", "toBeHidden", "toBeEnabled", "toBeDisabled", "toBeEditable", "toBeChecked"];
    const one = ["toHaveText", "toContainText", "toHaveValue", "toHaveCount", "toHaveURL"];
    if (![...zero, ...one, "toHaveAttribute"].includes(method) ||
      (method === "toHaveURL" ? receiver.kind !== "page" : receiver.kind !== "locator")) fail(call);
    count(args, zero.includes(method) ? 0 : method === "toHaveAttribute" ? 2 : 1, undefined, call);
    const values = args.map(a => method === "toHaveCount" ? integer(a) : string(a));
    interaction(call); record(call, receiver, method); assertionCount++;
    return `await Assertions.Expect(${receiver.cs})${not ? ".Not" : ""}.${pascal(method)}Async(${values.map(v => typeof v === "string" ? quote(v) : v).join(", ")});`;
  };
  const statements = (nodes, env, depth = 0) => {
    const declared = new Set();
    // JS lexical bindings shadow for the entire block, including their temporal
    // dead zone. Never resolve a later/self declaration to an outer locator.
    for (const n of nodes) if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name)) env.set(d.name.text, { kind: "uninitialized" });
    }
    for (const n of nodes) {
      if (ts.isEmptyStatement(n)) { emit(";", n); continue; }
      if (ts.isBlock(n)) { emit("{", n); statements(n.statements, new Map(env), depth); emit("}"); continue; }
      if (ts.isVariableStatement(n)) {
        if (!(n.declarationList.flags & ts.NodeFlags.Const)) fail(n);
        for (const d of n.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !d.initializer || d.type || declared.has(d.name.text) || ["page", "test", "expect"].includes(d.name.text)) fail(d);
          declared.add(d.name.text);
          const init = d.initializer, name = `v${++serial}`;
          let value;
          if (ts.isAwaitExpression(init) && ts.isIdentifier(init.expression)) {
            const promise = env.get(init.expression.text);
            if (!promise || !["popupPromise", "downloadPromise"].includes(promise.kind)) fail(init);
            interaction(init); value = { kind: promise.kind === "popupPromise" ? "page" : "download", cs: name, raw: d.name.text, components: [] };
            emit(`var ${name} = await ${promise.cs};`, n);
          } else if (ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) && init.expression.name.text === "waitForEvent") {
            const actor = resolve(init.expression.expression, env); count(init.arguments, 1, 1, init);
            const event = string(init.arguments[0]); if (actor.kind !== "page" || !["popup", "download"].includes(event)) fail(init);
            interaction(init); value = { kind: `${event}Promise`, cs: name, raw: d.name.text, components: [] };
            emit(`var ${name} = ${actor.cs}.WaitFor${pascal(event)}Async();`, n);
          } else {
            value = resolve(init, env); if (!["locator", "frame"].includes(value.kind)) fail(init);
            emit(`var ${name} = ${value.cs};`, n); value = { ...value, cs: name };
          }
          env.set(d.name.text, value);
        }
        continue;
      }
      if (ts.isIfStatement(n)) {
        const unwrap = n => { while (ts.isParenthesizedExpression(n)) n = n.expression; return n; };
        let condition = unwrap(n.expression), negated = false;
        if (ts.isPrefixUnaryExpression(condition) && condition.operator === ts.SyntaxKind.ExclamationToken) { negated = true; condition = condition.operand; }
        condition = unwrap(condition);
        if (!ts.isAwaitExpression(condition)) fail(n);
        const call = unwrap(condition.expression);
        if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) fail(n);
        const method = call.expression.name.text;
        if (!["isVisible", "isChecked", "isDisabled", "isEnabled", "isEditable"].includes(method)) fail(call);
        count(call.arguments, 0, 0, call); const receiver = resolve(call.expression.expression, env); if (receiver.kind !== "locator") fail(call);
        interaction(n); record(n, receiver, method);
        emit(`if (${negated ? "!" : ""}await ${receiver.cs}.${pascal(method)}Async())`, n); emit("{");
        const before = assertionCount;
        statements(ts.isBlock(n.thenStatement) ? n.thenStatement.statements : [n.thenStatement], new Map(env), depth + 1); emit("}");
        if (n.elseStatement) { emit("else"); emit("{"); statements(ts.isBlock(n.elseStatement) ? n.elseStatement.statements : [n.elseStatement], new Map(env), depth + 1); emit("}"); }
        else if (assertionCount === before) diagnostics.push(diagnostic("GEN003", "Conditional has no else and no assertion; skipped branch is not proof of success.", line(file, n), "warning"));
        continue;
      }
      if (!ts.isExpressionStatement(n) || !ts.isAwaitExpression(n.expression) || !ts.isCallExpression(n.expression.expression)) fail(n);
      const call = n.expression.expression;
      if (call.typeArguments?.length) fail(call);
      if (ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === "test" && call.expression.name.text === "step") {
        count(call.arguments, 2, 2, call); string(call.arguments[0]); const cb = call.arguments[1];
        if (!asyncBlock(cb) || cb.parameters.length) fail(cb);
        emit("{ // test.step lexical scope only; no reporting integration", n); statements(cb.body.statements, new Map(env), depth); emit("}"); continue;
      }
      const check = assertion(call, env); if (check) { emit(check, n); continue; }
      if (!ts.isPropertyAccessExpression(call.expression)) fail(call);
      const member = call.expression, method = member.name.text, args = call.arguments;
      if (ts.isPropertyAccessExpression(member.expression) && ["keyboard", "mouse"].includes(member.expression.name.text)) {
        const device = member.expression.name.text, actor = resolve(member.expression.expression, env);
        if (actor.kind !== "page" || !(device === "keyboard" ? ["press", "type", "insertText", "down", "up"] : ["click", "dblclick", "move"]).includes(method)) fail(call);
        count(args, device === "keyboard" ? 1 : 2, undefined, call); interaction(n);
        emit(`await ${actor.cs}.${pascal(device)}.${pascal(method)}Async(${args.map(a => device === "keyboard" ? quote(string(a)) : `${number(a)}f`).join(", ")});`, n); continue;
      }
      const receiver = resolve(member.expression, env);
      if (receiver.kind === "page" && method === "goto") {
        count(args, 1, 1, call); const url = string(args[0]);
        const key = options.urls?.find(e => e.value === url)?.key;
        // Drafts consume configuration, never add source URL values to scripts.
        if (!key) fail(call, "Navigation URL has no matching appsettings Urls entry; configure it before generation.");
        if (member.expression.getText(file) === "page" && depth === 0) navigated = true; else interaction(n);
        emit(`await ${receiver.cs}.GotoAsync(Config.Urls.TryGetApplication(${quote(key)}));`, n); continue;
      }
      interaction(n);
      if (receiver.kind === "page" && method === "waitForSelector") {
        count(args, 1, 1, call); const value = string(args[0]);
        record(n, { raw: `page.locator(${quote(value)})`, components: [{ kind: "locator", selector: value }] }, method);
        emit(`await ${receiver.cs}.WaitForSelectorAsync(${quote(value)});`, n); continue;
      }
      if (receiver.kind === "download" && method === "saveAs") {
        count(args, 1, 1, call); emit(`await ${receiver.cs}.SaveAsAsync(${quote(string(args[0]))});`, n); continue;
      }
      const zero = ["click", "dblclick", "hover", "check", "uncheck", "focus", "waitFor"], one = ["fill", "press", "selectOption", "setInputFiles"];
      if (receiver.kind !== "locator" || ![...zero, ...one].includes(method)) fail(call);
      count(args, one.includes(method) ? 1 : 0, undefined, call);
      const value = args.length ? string(args[0]) : null; record(n, receiver, method, value);
      emit(`await ${receiver.cs}.${pascal(method)}Async(${value === null ? "" : quote(value)});`, n);
    }
  };
  if (!diagnostics.some(d => d.severity === "error")) try {
    const checkSyntax = n => {
      if (n.questionDotToken || n.typeArguments?.length || ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n)) fail(n);
      ts.forEachChild(n, checkSyntax);
    };
    checkSyntax(item.callback.body);
    const parameters = item.callback.parameters;
    if (parameters.length !== 1 || !ts.isObjectBindingPattern(parameters[0].name) || parameters[0].initializer || parameters[0].type ||
      parameters[0].name.elements.length !== 1 || parameters[0].name.elements[0].name.getText(file) !== "page" ||
      parameters[0].name.elements[0].propertyName || parameters[0].name.elements[0].initializer || parameters[0].name.elements[0].dotDotDotToken) fail(item.callback, "Only the unaliased { page } test fixture is supported.");
    statements(item.callback.body.statements, new Map([["page", { kind: "page", cs: "Page", raw: "page", components: [] }]]));
    if (!navigated) { const e = new Error(); e.diagnostic = diagnostic("REC001", "Test has no initial guaranteed page.goto.", item.startLine); throw e; }
  } catch (e) { if (!e.diagnostic) throw e; diagnostics.push(e.diagnostic); }
  const locatorValidation = new LocatorValidator().validateActions(actions);
  const recordingIssues = inspectRecordingGuards(item.sourceHashInput).map(d => ({ ...d, sourceLine: d.sourceLine + item.startLine - 1 }));
  diagnostics.push(...collectGenerationIssues({ locatorValidation, recordingIssues }));
  const refused = diagnostics.some(d => d.severity === "error" && d.kind !== "locatorValidation") || Boolean(options.strictLocators && locatorValidation.hasFailures);
  return { testCaseId: item.entry.id, className: `TestCase${item.entry.id.replace(/-/g, "_")}`, title: item.title,
    manifestTitle: item.entry.title, titleChanged: item.titleChanged, startLine: item.startLine, endLine: item.endLine,
    included: !refused, status: refused ? "refused" : "generated", diagnostics, issues: diagnostics,
    reviewRequired: diagnostics.length > 0 || locatorValidation.hasFailures, locatorValidation,
    body: refused ? [] : rows, sourceMap: refused ? [] : sourceMap,
    locatorOrigins: refused ? [] : actions.filter(a => a.locator?.kind === "locator").map(a => ({ sourceLine: a.sourceLine, selector: a.locator.selector })),
    limitations: ["Locator rules run on each AST locator component without runtime evidence; combined-chain uniqueness is unverified.",
      "One method per test preserves lexical scopes; test.step is a lexical block, not a reporting step.",
      "TLL markers transfer only from an exact saved case-body/selector/line match, as origin-only provenance; original metadata remains untouched."] };
}

module.exports = { discover, lowerCase, diagnostic, quote };