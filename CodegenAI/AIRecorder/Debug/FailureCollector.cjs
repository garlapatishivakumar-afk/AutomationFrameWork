const fs = require("fs");
const path = require("path");

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function safeReadJson(filePath) {
  try {
    const text = safeRead(filePath).trim();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function findGenerationReportPath(sourceFile) {
  if (!sourceFile) {
    return "";
  }

  const sibling = path.join(path.dirname(sourceFile), "CSharpGenerationReport.json");
  return fs.existsSync(sibling) ? sibling : "";
}

function copyIfExists(sourceFilePath, targetFilePath) {
  if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
    return false;
  }

  fs.copyFileSync(sourceFilePath, targetFilePath);
  return true;
}

function extractSourceExcerpt(source, sourceLine) {
  const lines = String(source || "").split(/\r?\n/);
  const index = normalizeActionLineIndex(lines, Math.max(0, Number(sourceLine || 1) - 1));
  return lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join("\n");
}

function normalizeActionLineIndex(lines, index) {
  let resolvedIndex = Math.max(0, Math.min(lines.length - 1, index));
  const isActionLine = (line) => /\bawait\b|Assertions\.Expect\(/.test(String(line || ""));

  if (!isActionLine(lines[resolvedIndex])) {
    for (let cursor = resolvedIndex + 1; cursor < lines.length; cursor += 1) {
      if (isActionLine(lines[cursor])) {
        resolvedIndex = cursor;
        break;
      }
    }
  }

  return resolvedIndex;
}

function extractSourceLine(source, sourceLine) {
  const lines = String(source || "").split(/\r?\n/);
  const index = normalizeActionLineIndex(lines, Math.max(0, Number(sourceLine || 1) - 1));
  return lines[index] || "";
}

function extractRecordedSourceLine(source, sourceLine) {
  const lines = String(source || "").split(/\r?\n/);
  const index = normalizeActionLineIndex(lines, Math.max(0, Math.min(lines.length - 1, Number(sourceLine || 1) - 1)));
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const match = lines[cursor].match(/Source:\s+Code\.ts\s+line\s+(\d+)/i);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function extractRecordedSourceLineFromReport(sourceFile, sourceLine) {
  const reportPath = findGenerationReportPath(sourceFile);
  if (!reportPath) {
    return null;
  }

  const report = safeReadJson(reportPath);
  const sourceMap = Array.isArray(report.sourceMap) ? report.sourceMap : [];
  const mapped = sourceMap.find((entry) => Number(entry.generatedLine) === Number(sourceLine));
  if (mapped) {
    return Number(mapped.sourceLine);
  }

  const fallback = sourceMap
    .filter((entry) => Number(entry.generatedLine) <= Number(sourceLine))
    .sort((left, right) => Number(right.generatedLine) - Number(left.generatedLine))[0];

  return fallback ? Number(fallback.sourceLine) : null;
}

function inferLocatorFromSourceLine(sourceLineText) {
  const locatorMatch = String(sourceLineText || "").match(/Locator\("([\s\S]*?)"\)/);
  if (locatorMatch) {
    return locatorMatch[1];
  }

  const roleMatch = String(sourceLineText || "").match(/GetByRole\(AriaRole\.([A-Za-z]+),\s+new\(\)\s+\{\s+Name\s+=\s+"([^"]+)"/);
  if (roleMatch) {
    return `${roleMatch[1]}:${roleMatch[2]}`;
  }

  const textMatch = String(sourceLineText || "").match(/GetByText\("([^"]+)"/);
  return textMatch ? textMatch[1] : "";
}

function timestampId() {
  const now = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${pad(now.getMilliseconds(), 3)}`;
}

function resolveSessionId(value) {
  return value || timestampId();
}

function collectFailureEvidence(options, execution, attempt) {
  const outputRoot = options.outputRoot || path.join(process.cwd(), "GeneratedOutput", "Debug");
  const sessionId = resolveSessionId(options.sessionId);
  const sessionDir = path.join(outputRoot, sessionId, `attempt-${attempt}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const source = options.sourceFile ? safeRead(options.sourceFile) : "";
  const sourceLine = Number(options.sourceLine || 1);
  const sourceLineText = extractSourceLine(source, sourceLine);
  const recordedSourceLine = extractRecordedSourceLine(source, sourceLine)
    ?? extractRecordedSourceLineFromReport(options.sourceFile, sourceLine);

  const observations = safeReadJson(options.domFile);
  const observationAction = Array.isArray(observations.actions)
    ? observations.actions.find((item) => Number(item.line) === Number(recordedSourceLine)) || null
    : null;

  const metadata = safeReadJson(options.metadataFile);
  const metadataAction = Array.isArray(metadata.actions)
    ? metadata.actions.find((item) => Number(item.line) === Number(recordedSourceLine)) || null
    : null;

  const failure = {
    testName: options.testName || options.failedTestName || "UnknownTest",
    testFile: options.testFile || null,
    testCommand: options.testCommand || null,
    featureName: options.featureName || null,
    scenarioName: options.scenarioName || null,
    stepText: options.stepText || null,
    sourceFile: options.sourceFile || null,
    sourceLine,
    sourceExcerpt: extractSourceExcerpt(source, sourceLine),
    sourceLineText,
    recordedSourceLine,
    exceptionMessage: options.exceptionMessage || execution.stderr || execution.stdout || "Unknown failure",
    stackTrace: execution.stderr || execution.stdout || "",
    executionOutput: [execution.stdout, execution.stderr].filter(Boolean).join("\n"),
    currentUrl: options.currentUrl || (observationAction && observationAction.debug ? observationAction.debug.currentUrl : null),
    pageTitle: options.pageTitle || (observationAction && observationAction.debug ? observationAction.debug.pageTitle : null),
    browserName: options.browserName || "unknown",
    browserVersion: options.browserVersion || null,
    failedLocator: options.locator || inferLocatorFromSourceLine(sourceLineText) || (observationAction && observationAction.originalLocator) || (metadataAction && metadataAction.locator) || null,
    locatorStrategy: options.locatorStrategy || (metadataAction && metadataAction.strategy) || null,
    actionType: options.actionType || (metadataAction && metadataAction.action) || null,
    inputValueType: options.inputValueType || null,
    frameInformation: observationAction && observationAction.debug ? observationAction.debug.frames || [] : [],
    popupInformation: options.popupInformation || null,
    timingInformation: {
      attempt,
      durationMs: execution.durationMs,
      exitCode: execution.exitCode
    },
    previousRetryResults: options.previousRetryResults || [],
    tableEvidence: metadataAction || null,
    observationEvidence: observationAction || null
  };

  fs.writeFileSync(path.join(sessionDir, "failure.json"), JSON.stringify(failure, null, 2), "utf8");
  fs.writeFileSync(path.join(sessionDir, "console.log"), failure.executionOutput || "", "utf8");
  fs.writeFileSync(path.join(sessionDir, "network.log"), options.networkLogText || "", "utf8");

  if (options.relevantHtml) {
    fs.writeFileSync(path.join(sessionDir, "page.html"), options.relevantHtml, "utf8");
  } else if (options.pageHtmlFile) {
    copyIfExists(options.pageHtmlFile, path.join(sessionDir, "page.html"));
  }

  copyIfExists(options.screenshotFile, path.join(sessionDir, "screenshot.png"));
  copyIfExists(options.traceFile, path.join(sessionDir, "trace.zip"));

  if (options.domFile && fs.existsSync(options.domFile)) {
    copyIfExists(options.domFile, path.join(sessionDir, "dom.json"));
  }

  return {
    sessionDir,
    failure
  };
}

module.exports = {
  collectFailureEvidence,
  extractRecordedSourceLine,
  extractRecordedSourceLineFromReport,
  inferLocatorFromSourceLine,
  resolveSessionId
};