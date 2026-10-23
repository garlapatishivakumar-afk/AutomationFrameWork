const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const logic = require("./highlightLogic.js");

function host() {
  const events = {}, logs = [], files = new Map();
  const disposable = { dispose() {} };
  const listen = (name) => (fn) => { events[name] = fn; return disposable; };
  const uri = (value) => ({ path: value, toString() { return this.path; } });
  const open = (name, value) => {
    const document = { uri: uri(name), version: 1, isClosed: false, getText: () => value,
      lineAt: (line) => { assert.ok(line >= 0 && line < value.split("\n").length); return { range: line }; },
      edit: (text) => { value = text; document.version++; } };
    const editor = { document, highlights: [], setDecorations: (_, values) => { editor.highlights = Array.from(values); } };
    return editor;
  };
  const ts = open("/project/Code.ts", 'await page.locator("#target").click();');
  const cs = open("/project/Code.cs", 'await Target.ClickAsync(); // [TLL TC01:L1]');
  let patterns = ["Code.ts", "Code.cs"], pending;
  const api = {
    Uri: { joinPath: (base, ...parts) => uri(path.posix.join(base.path, ...parts)) },
    MarkdownString: class { constructor(value) { this.value = value; } },
    OverviewRulerLane: { Right: 4 },
    window: { visibleTextEditors: [ts, cs],
      createOutputChannel: () => ({ ...disposable, appendLine: (message) => logs.push(message) }),
      createTextEditorDecorationType: (options) => {
        assert.equal(options.isWholeLine, true);
        assert.equal(options.backgroundColor, "rgba(255,235,59,0.35)");
        assert.equal(options.overviewRulerLane, 4); assert.ok(options.overviewRulerColor);
        return disposable;
      }, onDidChangeActiveTextEditor: listen("active"), onDidChangeVisibleTextEditors: listen("visible") },
    workspace: { textDocuments: [], getConfiguration: () => ({ get: () => patterns }),
      onDidChangeTextDocument: listen("text"), onDidChangeConfiguration: listen("config"),
      fs: { readFile: async (location) => {
        if (!files.has(location.path)) throw Object.assign(new Error("missing"), { code: "FileNotFound" });
        return Buffer.from(files.get(location.path));
      } }, createFileSystemWatcher: () => ({ ...disposable,
        onDidCreate: listen("create"), onDidChange: listen("change"), onDidDelete: listen("delete") }) }
  };
  const sandbox = { module: { exports: {} }, Buffer,
    setTimeout: (fn) => { pending = fn; return 1; }, clearTimeout: () => { pending = null; },
    require: (name) => name === "vscode" ? api : logic };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "extension.js"), "utf8"), sandbox);
  const metadata = JSON.stringify({ actions: [{ line: 1, locator: "#target", confidence: 0.5 }] });
  files.set("/project/TableLocatorMetadata.json", metadata);
  const context = { subscriptions: [] };
  sandbox.module.exports.activate(context);
  return { events, files, ts, cs, api, logs, metadata, context,
    flush: () => { const callback = pending; pending = null; callback?.(); },
    configure: (value) => { patterns = value; events.config({ affectsConfiguration: () => true }); } };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const ranges = (editor) => editor.highlights.map((hit) => hit.range);

test("read-only decorations, hover details, debounce and settings refresh", async () => {
  const h = host();
  await settle();
  assert.deepEqual(ranges(h.ts), [0]); assert.deepEqual(ranges(h.cs), [0]);
  const hover = h.cs.highlights[0].hoverMessage;
  assert.match(hover.value, /Case: TC01/); assert.match(hover.value, /NOT LIVE-VALIDATED/);
  assert.equal(hover.isTrusted, false); assert.equal(hover.supportHtml, false);
  h.ts.document.edit('// inserted\nawait page.locator("#target").click();');
  h.events.text(); h.events.text();
  assert.deepEqual(ranges(h.ts), [0], "text events must be debounced");
  h.flush(); await settle(); assert.deepEqual(ranges(h.ts), [1]);
  h.configure(["Other.*"]); await settle();
  assert.deepEqual(ranges(h.ts), []); assert.deepEqual(ranges(h.cs), []);
  h.configure(["Code.??"]); await settle(); assert.deepEqual(ranges(h.cs), [0]);
});

test("invalid/missing metadata clears both editors and logs without leaking contents", async () => {
  const h = host(); await settle();
  for (const value of ['{"private":"SENSITIVE",', '{}', null]) {
    if (value === null) h.files.delete("/project/TableLocatorMetadata.json");
    else h.files.set("/project/TableLocatorMetadata.json", value);
    h.events.change(); h.flush(); await settle();
    assert.deepEqual(ranges(h.ts), []); assert.deepEqual(ranges(h.cs), []);
    assert.ok(h.logs.some((message) => message.includes("highlights cleared")));
    assert.ok(h.logs.every((message) => !message.includes("SENSITIVE")));
  }
  h.files.set("/project/TableLocatorMetadata.json", h.metadata);
  h.events.create(); h.flush(); await settle(); assert.deepEqual(ranges(h.ts), [0]);
  h.files.delete("/project/TableLocatorMetadata.json");
  h.events.delete(); h.flush(); await settle(); assert.deepEqual(ranges(h.ts), []);
});

test("legacy metadata fallback, unsaved metadata, and permission error", async () => {
  const h = host(); await settle();
  h.ts.document.uri.path = "/project/CodegenAI/Code.ts";
  h.files.set("/project/CodegenAI/AIRecorder/TableLocatorMetadata.json", h.metadata);
  h.events.active(); await settle(); assert.deepEqual(ranges(h.ts), [0]);
  h.api.workspace.textDocuments = [{ uri: { toString: () => "/project/CodegenAI/AIRecorder/TableLocatorMetadata.json" }, getText: () => '{"actions":[]}' }];
  h.events.text(); h.flush(); await settle(); assert.deepEqual(ranges(h.ts), []);
  h.api.workspace.fs.readFile = async () => { throw Object.assign(new Error("private details"), { code: "NoPermissions" }); };
  h.events.active(); await settle(); assert.deepEqual(ranges(h.ts), []);
  assert.ok(h.logs.some((message) => message.includes("NoPermissions")));
  assert.ok(h.logs.every((message) => !message.includes("private details")));
});

test("outdated asynchronous reads and disposal cannot reapply stale highlights", async () => {
  const h = host(); await settle();
  h.api.window.visibleTextEditors = [h.ts];
  const pending = [];
  h.api.workspace.fs.readFile = () => new Promise((resolve) => pending.push(resolve));
  h.events.active();
  h.ts.document.edit('await page.locator("#other").click();');
  h.events.text(); h.flush();
  pending[1](Buffer.from(h.metadata)); await settle(); assert.deepEqual(ranges(h.ts), []);
  pending[0](Buffer.from(h.metadata)); await settle(); assert.deepEqual(ranges(h.ts), []);
  h.ts.document.edit('await page.locator("#target").click();');
  h.events.active();
  h.context.subscriptions.forEach((item) => item.dispose());
  pending[2](Buffer.from(h.metadata)); await settle(); assert.deepEqual(ranges(h.ts), []);
});