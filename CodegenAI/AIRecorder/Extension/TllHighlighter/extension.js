"use strict";
const vscode = require("vscode");
const { isTransformed, findTsHighlights, findCsHighlights, buildTooltip } = require("./highlightLogic");

function activate(context) {
  const output = vscode.window.createOutputChannel("TLL Highlighter");
  const decoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true, backgroundColor: "rgba(255,235,59,0.35)",
    overviewRulerColor: "rgba(255,235,59,0.85)", overviewRulerLane: vscode.OverviewRulerLane.Right
  });
  const generations = new WeakMap();
  let timer, disposed = false;
  async function readMetadata(document) {
    const folder = vscode.Uri.joinPath(document.uri, "..");
    const paths = [vscode.Uri.joinPath(folder, "TableLocatorMetadata.json")];
    if (folder.path.split("/").pop()?.toLowerCase() === "codegenai")
      paths.push(vscode.Uri.joinPath(folder, "AIRecorder", "TableLocatorMetadata.json"));
    for (let i = 0; i < paths.length; i++) {
      try {
        const open = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === paths[i].toString());
        const text = open ? open.getText() : Buffer.from(await vscode.workspace.fs.readFile(paths[i])).toString("utf8");
        const metadata = JSON.parse(text.replace(/^\uFEFF/, ""));
        if (!Array.isArray(metadata?.actions)) throw new Error("Invalid metadata shape");
        return metadata;
      } catch (error) {
        if (error.code !== "FileNotFound" || i === paths.length - 1) throw error;
      }
    }
  }
  async function update(editor) {
    const document = editor.document, name = document.uri.path.split("/").pop();
    const generation = (generations.get(editor) || 0) + 1, version = document.version;
    generations.set(editor, generation);
    const patterns = vscode.workspace.getConfiguration("tllHighlighter", document.uri).get("filePatterns", ["Code.ts", "Code.cs"]);
    const matches = Array.isArray(patterns) && patterns.some((pattern) => typeof pattern === "string" &&
      new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i").test(name));
    let highlights = [];
    try {
      if (matches && /\.(ts|cs)$/i.test(name)) {
        const metadata = await readMetadata(document), lines = document.getText().split(/\r?\n/);
        const workCase = /\/\.work\/([A-Za-z0-9_-]+)\//.exec(document.uri.path)?.[1];
        const entries = /\.ts$/i.test(name) ? findTsHighlights(metadata, lines)
          : findCsHighlights(lines).map((hit) => ({ line: hit.line, entry: {
            ...(metadata.actions.find((entry) => isTransformed(entry) &&
              (entry.sourceLine ?? entry.line) === hit.sourceLine &&
              (!entry.testCaseId || entry.testCaseId === hit.caseId)) || {}),
            testCaseId: hit.caseId || workCase, sourceLine: hit.sourceLine
          } }));
        highlights = entries.map(({ line, entry }) => {
          const hoverMessage = new vscode.MarkdownString(buildTooltip({ ...entry, testCaseId: entry.testCaseId || workCase }));
          hoverMessage.isTrusted = false;
          hoverMessage.supportHtml = false;
          return { range: document.lineAt(line - 1).range, hoverMessage };
        });
      }
    } catch (error) {
      output.appendLine(`${name}: metadata unavailable (${error.code || error.name || "read error"}); highlights cleared.`);
    }
    if (!disposed && !document.isClosed && document.version === version && generations.get(editor) === generation)
      editor.setDecorations(decoration, highlights);
  }
  const refresh = () => vscode.window.visibleTextEditors.forEach((editor) => { void update(editor); });
  const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 120); };
  const watcher = vscode.workspace.createFileSystemWatcher("**/TableLocatorMetadata.json");
  context.subscriptions.push(output, decoration, watcher,
    vscode.window.onDidChangeActiveTextEditor(refresh), vscode.window.onDidChangeVisibleTextEditors(refresh),
    vscode.workspace.onDidChangeTextDocument(schedule),
    vscode.workspace.onDidChangeConfiguration((event) => { if (event.affectsConfiguration("tllHighlighter")) refresh(); }),
    watcher.onDidCreate(schedule), watcher.onDidChange(schedule), watcher.onDidDelete(schedule),
    { dispose: () => { disposed = true; clearTimeout(timer); } });
  refresh();
}

module.exports = { activate };