const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { generateCSharpCode } = require("./CSharpCodeGenerator.cjs");

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, inlineValue] = token.split("=");
    const name = key.slice(2);
    if (inlineValue !== undefined) {
      args[name] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[name] = next;
      index += 1;
    } else {
      args[name] = "true";
    }
  }

  return args;
}

function toNumber(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackValue;
}

function createHash(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function createLogger(enabled) {
  return (message) => {
    if (enabled !== false) {
      console.log(`[LiveCSharp] ${message}`);
    }
  };
}

function buildDefaultReportPath(outputFilePath) {
  return path.join(path.dirname(outputFilePath), "CSharpGenerationReport.json");
}

function startLiveSync(options) {
  const codeFilePath = path.resolve(options.codeFilePath);
  const outputFilePath = path.resolve(options.outputFilePath);
  const appSettingsPath = path.resolve(options.appSettingsPath);
  const reportFilePath = path.resolve(options.reportFilePath || buildDefaultReportPath(outputFilePath));
  const stopSignalFile = options.stopSignalFile ? path.resolve(options.stopSignalFile) : null;
  const debounceMs = toNumber(options.debounceMs, 350);
  const logger = createLogger(options.log !== false);
  const codeFileName = path.basename(codeFilePath);
  const stopFileName = stopSignalFile ? path.basename(stopSignalFile) : null;
  const watchDir = path.dirname(codeFilePath);

  let watcher = null;
  let debounceTimer = null;
  let closed = false;
  let running = false;
  let queuedReason = null;
  let lastSourceHash = "";
  let generationCount = 0;
  let idleResolver = null;
  let idlePromise = Promise.resolve();

  function setPendingWork() {
    idlePromise = new Promise((resolve) => {
      idleResolver = resolve;
    });
  }

  function resolveIdle() {
    if (idleResolver) {
      const resolver = idleResolver;
      idleResolver = null;
      resolver();
    }
  }

  async function generate(reason, force) {
    if (closed) {
      resolveIdle();
      return null;
    }

    const source = safeRead(codeFilePath);
    if (!source.trim()) {
      logger(`Skipped generation for ${reason}: Code.ts is empty or unavailable.`);
      resolveIdle();
      return null;
    }

    const sourceHash = createHash(source);
    if (!force && sourceHash === lastSourceHash) {
      logger(`Skipped generation for ${reason}: content unchanged.`);
      resolveIdle();
      return null;
    }

    running = true;
    logger(`Generating Code.cs (${reason})`);
    try {
      const result = generateCSharpCode({
        codeFilePath,
        outputFilePath,
        reportFilePath,
        appSettingsPath
      });
      lastSourceHash = sourceHash;
      generationCount += 1;
      logger(`Code.cs updated. actions=${result.actions.length}, unsupported=${result.unsupportedActions.length}`);
      return result;
    } catch (error) {
      logger(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      running = false;
      if (queuedReason) {
        const nextReason = queuedReason;
        queuedReason = null;
        setPendingWork();
        void triggerGeneration(nextReason, false);
      } else {
        resolveIdle();
      }
    }
  }

  async function triggerGeneration(reason, force) {
    if (closed) {
      return null;
    }

    if (running) {
      queuedReason = reason;
      logger(`Queued generation while another run is active (${reason}).`);
      return null;
    }

    return generate(reason, force);
  }

  function schedule(reason, force = false) {
    if (closed) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    setPendingWork();
    debounceTimer = setTimeout(async () => {
      debounceTimer = null;
      await sleep(50);
      await triggerGeneration(reason, force);
    }, debounceMs);
  }

  function close() {
    if (closed) {
      return idlePromise;
    }

    closed = true;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (watcher) {
      watcher.close();
      watcher = null;
    }

    logger("Watcher stopped.");
    resolveIdle();
    return idlePromise;
  }

  watcher = fs.watch(watchDir, { persistent: true }, (eventType, fileName) => {
    const name = fileName ? String(fileName) : "";
    if (name === codeFileName) {
      logger(`Code.ts changed (${eventType}).`);
      schedule(`change:${eventType}`);
      return;
    }

    if (stopFileName && name === stopFileName && fs.existsSync(stopSignalFile)) {
      logger("Stop signal detected.");
      void close();
    }
  });

  logger(`Watching ${codeFilePath}`);
  if (fs.existsSync(codeFilePath)) {
    schedule("initial", true);
  }

  if (stopSignalFile && fs.existsSync(stopSignalFile)) {
    fs.unlinkSync(stopSignalFile);
  }

  return {
    close,
    getState() {
      return {
        closed,
        running,
        generationCount,
        outputFilePath,
        codeFilePath,
        reportFilePath
      };
    },
    whenIdle() {
      return idlePromise;
    }
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  const codeFilePath = args["code-file"];
  const outputFilePath = args["output-file"];

  if (!codeFilePath || !outputFilePath) {
    console.error("[LiveCSharp] Missing required arguments --code-file and --output-file");
    process.exit(2);
  }

  const liveSync = startLiveSync({
    codeFilePath,
    outputFilePath,
    reportFilePath: args["report-file"] || "",
    appSettingsPath: args["appsettings-file"] || path.join(process.cwd(), "appsettings.json"),
    stopSignalFile: args["stop-signal-file"] || "",
    debounceMs: args["debounce-ms"] || "350",
    log: String(args.log || "true").toLowerCase() !== "false"
  });

  const stopAndExit = async () => {
    await liveSync.close();
    process.exit(0);
  };

  process.on("SIGINT", stopAndExit);
  process.on("SIGTERM", stopAndExit);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  startLiveSync
};