const fs = require("fs");
const path = require("path");

function detectPauseTarget(source) {
  if (source.includes("_testContext.Page")) {
    return "_testContext.Page";
  }

  if (source.includes("_page")) {
    return "_page";
  }

  return "Page";
}

function createDebugCopy(options) {
  const source = fs.readFileSync(options.sourceFilePath, "utf8");
  const lines = source.split(/\r?\n/);
  let targetLineIndex = Math.max(0, Math.min(lines.length - 1, Number(options.sourceLine || 1) - 1));
  const isActionLine = (line) => /\bawait\b|Assertions\.Expect\(/.test(String(line || ""));
  if (!isActionLine(lines[targetLineIndex])) {
    for (let cursor = targetLineIndex + 1; cursor < lines.length; cursor += 1) {
      if (isActionLine(lines[cursor])) {
        targetLineIndex = cursor;
        break;
      }
    }
  }
  const pauseTarget = options.pauseTarget || detectPauseTarget(source);
  const targetLine = lines[targetLineIndex] || "";
  const indent = (targetLine.match(/^\s*/) || [""])[0];
  const pauseLine = `${indent}await ${pauseTarget}.PauseAsync(); // DebugEngine pause before failing action`;

  if (!options.noPause) {
    lines.splice(targetLineIndex, 0, pauseLine);
  }

  fs.mkdirSync(path.dirname(options.outputFilePath), { recursive: true });
  fs.writeFileSync(options.outputFilePath, lines.join("\n"), "utf8");

  return {
    created: true,
    outputFilePath: options.outputFilePath,
    pauseLine: options.noPause ? null : pauseLine,
    pauseTarget,
    insertedAtLine: options.noPause ? null : targetLineIndex + 1
  };
}

module.exports = {
  createDebugCopy,
  detectPauseTarget
};