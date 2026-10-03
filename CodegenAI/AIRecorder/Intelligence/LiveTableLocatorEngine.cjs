const fs = require("fs");
const path = require("path");
const { observeRecordedFlow } = require("./LiveObserver.cjs");
const { transformCode } = require("./TableLocatorIntelligence.cjs");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, value] = token.split("=");
    const name = key.slice(2);
    if (value !== undefined) {
      args[name] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[name] = next;
      i += 1;
    } else {
      args[name] = "true";
    }
  }

  return args;
}

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function ensureParentDirectory(filePath) {
  if (!filePath) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function log(enabled, message) {
  if (enabled) {
    console.log(`[LiveTableEngine] ${message}`);
  }
}

async function runLiveTableLocatorEngine(options) {
  const summary = {
    generatedAtUtc: new Date().toISOString(),
    codeFilePath: options.codeFilePath,
    domFilePath: options.domFilePath || "",
    metadataFilePath: options.metadataFilePath || "",
    observationExecuted: false,
    rewriteExecuted: false,
    transformedActions: 0,
    analyzedActions: 0,
    fallbackReason: ""
  };

  let observations = null;

  if (!options.skipObservation) {
    log(options.debug, "Running live DOM observation.");
    observations = await observeRecordedFlow({
      codeFilePath: options.codeFilePath,
      outputFilePath: options.domFilePath || "",
      storageStateFile: options.storageStateFile || "",
      showBrowser: options.showBrowser,
      debug: options.debug,
      waitTimeoutMs: options.waitTimeoutMs,
      resolveTimeoutMs: options.resolveTimeoutMs,
      retryIntervalMs: options.retryIntervalMs
    });

    summary.observationExecuted = true;

    if (options.domFilePath) {
      ensureParentDirectory(options.domFilePath);
      fs.writeFileSync(options.domFilePath, JSON.stringify(observations, null, 2), "utf8");
    }
  }

  if (!options.skipRewrite) {
    log(options.debug, "Running table locator rewrite.");
    const transformed = transformCode({
      codeFilePath: options.codeFilePath,
      domFilePath: options.domFilePath || "",
      metadataFilePath: options.metadataFilePath || "",
      specificRulesFilePath: options.specificRulesFilePath || "",
      tableSelector: options.tableSelector || "table",
      debug: options.debug
    });

    summary.rewriteExecuted = true;
    summary.transformedActions = transformed.metadata.transformedActions;
    summary.analyzedActions = transformed.metadata.analyzedActions;

    fs.writeFileSync(options.codeFilePath, transformed.code, "utf8");

    if (options.metadataFilePath) {
      ensureParentDirectory(options.metadataFilePath);
      fs.writeFileSync(options.metadataFilePath, JSON.stringify(transformed.metadata, null, 2), "utf8");
    }
  }

  if (!summary.observationExecuted && !summary.rewriteExecuted) {
    summary.fallbackReason = "Observation and rewrite both skipped.";
  }

  return summary;
}

async function runCli() {
  const args = parseArgs(process.argv);
  const codeFilePath = args["code-file"];

  if (!codeFilePath) {
    console.error("[LiveTableEngine] Missing required argument: --code-file");
    process.exit(2);
  }

  const result = await runLiveTableLocatorEngine({
    codeFilePath,
    domFilePath: args["dom-file"] || "",
    metadataFilePath: args["metadata-file"] || "",
    storageStateFile: args["storage-state-file"] || "",
    specificRulesFilePath: args["specific-rules-file"] || "",
    tableSelector: args["table-selector"] || "table",
    debug: toBoolean(args.debug),
    showBrowser: toBoolean(args["show-browser"]),
    skipObservation: toBoolean(args["skip-observation"]),
    skipRewrite: toBoolean(args["skip-rewrite"]),
    waitTimeoutMs: args["wait-timeout-ms"],
    resolveTimeoutMs: args["resolve-timeout-ms"],
    retryIntervalMs: args["retry-interval-ms"]
  });

  console.log(
    `[LiveTableEngine] Completed. observed=${result.observationExecuted}, rewritten=${result.rewriteExecuted}, analyzed=${result.analyzedActions}, transformed=${result.transformedActions}`
  );
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error("[LiveTableEngine] Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  runLiveTableLocatorEngine
};