const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const { analyzeWithAI } = require("./DebugAIAnalyzer.cjs");
const { collectBrowserEvidence } = require("./BrowserEvidenceCollector.cjs");
const { buildDebugPoint } = require("./DebugPointBuilder.cjs");
const { classifyFailure } = require("./FailureClassifier.cjs");
const { collectFailureEvidence, resolveSessionId } = require("./FailureCollector.cjs");
const { createDebugCopy } = require("./DebugPointManager.cjs");
const { proposeFix, applyProposal, revertProposal } = require("./FixProposalEngine.cjs");
const { validateAnalysisResponse } = require("./DebugPromptBuilder.cjs");
const { appendHistory } = require("./DebugHistory.cjs");
const { validateProposal } = require("./ProposalValidator.cjs");

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

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function toNumber(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function runCommand(command, cwd) {
  if (!command) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "No test command provided.",
      durationMs: 0
    };
  }

  const startedAt = Date.now();
  const result = childProcess.spawnSync(command, {
    cwd: cwd || process.cwd(),
    shell: true,
    encoding: "utf8"
  });

  return {
    exitCode: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    durationMs: Date.now() - startedAt
  };
}

function extractSourceLocation(output, defaultFile, defaultLine) {
  const match = String(output || "").match(/([A-Za-z]:\\[^:\n]+\.cs):line\s+(\d+)/);
  if (match) {
    return {
      sourceFile: match[1],
      sourceLine: Number(match[2])
    };
  }

  return {
    sourceFile: defaultFile || null,
    sourceLine: Number(defaultLine || 1)
  };
}

function loadAnalysisResponse(analysisFilePath) {
  if (!analysisFilePath) {
    return null;
  }

  return validateAnalysisResponse(fs.readFileSync(analysisFilePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function toApprovalState(options, proposalValidation) {
  if (toBoolean(options.debugApprove) && proposalValidation && proposalValidation.valid) {
    return {
      decision: "Approved",
      approved: true,
      reason: "Approved by debug flag after proposal validation."
    };
  }

  if (toBoolean(options.debugApprove) && proposalValidation && !proposalValidation.valid) {
    return {
      decision: "Rejected",
      approved: false,
      reason: `Approval flag supplied, but proposal validation failed: ${proposalValidation.reason}`
    };
  }

  return {
    decision: "Pending",
    approved: false,
    reason: "Human approval required before modifying source files."
  };
}

function runOptionalCommand(command, cwd) {
  if (!command) {
    return {
      skipped: true,
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 0
    };
  }

  return {
    skipped: false,
    ...runCommand(command, cwd)
  };
}

function writeFinalArtifacts(baseDir, summary, totalTokenUsage, attempts) {
  const finalResult = {
    ...summary,
    totalTokenUsage,
    totalAttemptsRecorded: attempts.length
  };
  writeJson(path.join(baseDir, "final-result.json"), finalResult);
  writeJson(path.join(baseDir, "session-summary.json"), {
    finalStatus: summary.status,
    stopReason: summary.stopReason || null,
    attempts: attempts.map((item) => ({
      attempt: item.attempt,
      status: item.summary.status,
      analysisMode: item.summary.analysis ? item.summary.analysis.analysisMode : null,
      provider: item.summary.analysis ? item.summary.analysis.provider : null,
      model: item.summary.analysis ? item.summary.analysis.model : null,
      fallbackUsed: item.summary.analysis ? item.summary.analysis.fallbackUsed : null,
      tokenUsage: item.summary.tokenUsage || null
    })),
    totalTokenUsage
  });
}

function addTokenUsage(total, current) {
  const next = current || {};
  total.promptTokens += Number(next.promptTokens || 0);
  total.completionTokens += Number(next.completionTokens || 0);
  total.totalTokens += Number(next.totalTokens || 0);
  total.estimated = total.estimated || Boolean(next.estimated);
}

async function runDebugEngine(options) {
  const maxAttempts = toNumber(options.debugMaxAttempts, 2);
  const outputRoot = options.outputRoot || path.join(process.cwd(), "GeneratedOutput", "Debug");
  const previousRetryResults = [];
  const sessionId = resolveSessionId(options.sessionId);
  const sessionRoot = path.join(outputRoot, sessionId);
  const totalTokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimated: false
  };
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const execution = attempt === 1 && options.executionResult
      ? options.executionResult
      : runCommand(options.testCommand, options.cwd);

    lastResult = execution;

    if (execution.exitCode === 0) {
      const successSummary = {
        status: "passed",
        attempts: attempt,
        outputRoot,
        rerunExitCode: execution.exitCode,
        stopReason: "Test command succeeded before repair was required."
      };
      writeFinalArtifacts(sessionRoot, successSummary, totalTokenUsage, previousRetryResults);
      appendHistory(options.historyFile, {
        timestamp: new Date().toISOString(),
        status: "resolved",
        attempts: attempt,
        validationResult: successSummary,
        failureCategory: null,
        originalError: null,
        originalLocator: null,
        successfulLocator: null,
        fixType: null,
        framework: "C# Playwright",
        browser: options.browserName || "unknown",
        pageOrComponent: options.sourceFile || null
      });
      return successSummary;
    }

    const resolvedLocation = extractSourceLocation(`${execution.stdout}\n${execution.stderr}`, options.sourceFile, options.sourceLine);
    const evidenceResult = collectFailureEvidence({
      ...options,
      ...resolvedLocation,
      sessionId,
      previousRetryResults,
      outputRoot
    }, execution, attempt);

    const browserEvidence = await collectBrowserEvidence({
      sourceFile: resolvedLocation.sourceFile,
      codeFilePath: options.codeFilePath,
      recordedSourceLine: evidenceResult.failure.recordedSourceLine,
      storageStateFile: options.storageStateFile,
      inspectionDelayMs: options.inspectionDelayMs
    }).catch((error) => ({
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    }));

    evidenceResult.failure.browserEvidence = browserEvidence;
    if (!evidenceResult.failure.currentUrl && browserEvidence.pageState) {
      evidenceResult.failure.currentUrl = browserEvidence.pageState.url || null;
    }
    if (!evidenceResult.failure.pageTitle && browserEvidence.pageState) {
      evidenceResult.failure.pageTitle = browserEvidence.pageState.title || null;
    }

    writeJson(path.join(evidenceResult.sessionDir, "browser-evidence.json"), browserEvidence);
    if (!options.relevantHtml && browserEvidence.relevantHtml) {
      fs.writeFileSync(path.join(evidenceResult.sessionDir, "page.html"), browserEvidence.relevantHtml, "utf8");
    }

    const debugSourceFile = resolvedLocation.sourceFile
      ? path.join(evidenceResult.sessionDir, path.basename(resolvedLocation.sourceFile).replace(/\.cs$/i, ".debug.cs"))
      : path.join(evidenceResult.sessionDir, "Code.debug.cs");

    const debugCopy = resolvedLocation.sourceFile
      ? createDebugCopy({
          sourceFilePath: resolvedLocation.sourceFile,
          outputFilePath: debugSourceFile,
          sourceLine: resolvedLocation.sourceLine,
          noPause: toBoolean(options.debugNoPause)
        })
      : null;

    const debugPoint = buildDebugPoint(evidenceResult.failure, browserEvidence, {
      attempt,
      testCommand: options.testCommand,
      testDataReference: options.testDataReference
    });
    writeJson(path.join(evidenceResult.sessionDir, "debug-point.json"), debugPoint);

    const classification = classifyFailure(evidenceResult.failure);
    const deterministicProposal = proposeFix(evidenceResult.failure, classification, browserEvidence);
    const aiAnalysis = await analyzeWithAI({
      failure: evidenceResult.failure,
      classification,
      deterministicProposal,
      browserEvidence,
      previousFixes: previousRetryResults.map((item) => item.proposal),
      aiClient: options.aiClient,
      aiConfiguration: options.aiConfiguration,
      disableAI: toBoolean(options.disableAI)
    });
    const proposal = aiAnalysis.proposal;
    const analysis = aiAnalysis.analysis;
    const tokenUsage = aiAnalysis.tokenUsage;

    const proposalValidation = validateProposal(proposal, {
      failure: evidenceResult.failure,
      browserEvidence,
      previousRetryResults
    });
    const prompt = aiAnalysis.prompt;
    if (options.analysisFile) {
      const fileAnalysis = loadAnalysisResponse(options.analysisFile);
      analysis.classification = fileAnalysis.classification;
      analysis.rootCause = fileAnalysis.rootCause;
      analysis.proposedFix = fileAnalysis.proposedFix;
      analysis.confidence = fileAnalysis.confidence;
      analysis.validationPlan = fileAnalysis.validationPlan;
      analysis.requiresHumanApproval = fileAnalysis.requiresHumanApproval;
    }

    writeJson(path.join(evidenceResult.sessionDir, "ai-prompt.json"), prompt);
    writeJson(path.join(evidenceResult.sessionDir, "ai-analysis.json"), analysis);
    writeJson(path.join(evidenceResult.sessionDir, "proposed-fix.json"), proposal);
    writeJson(path.join(evidenceResult.sessionDir, "proposal-validation.json"), proposalValidation);
    addTokenUsage(totalTokenUsage, tokenUsage);

    const approval = toApprovalState(options, proposalValidation);
    writeJson(path.join(evidenceResult.sessionDir, "approval.json"), approval);

    if (!toBoolean(options.debugAutoFix) || !approval.approved || !proposal || !proposal.safeToApply || !proposalValidation.valid) {
      const summary = {
        status:
          approval.decision === "Rejected"
            ? "validation-rejected"
            : approval.approved
              ? "requires-human-input"
              : "pending-approval",
        attempts: attempt,
        debugPoint,
        classification,
        approval,
        analysis,
        proposal,
        proposalValidation,
        debugCopy,
        tokenUsage,
        sessionDir: evidenceResult.sessionDir,
        rerunExitCode: execution.exitCode,
        stopReason: approval.decision === "Rejected"
          ? approval.reason
          : !toBoolean(options.debugAutoFix)
            ? "Repair proposal created and waiting for explicit auto-fix approval."
            : !proposalValidation.valid
              ? proposalValidation.reason
              : "Human approval required before applying the validated proposal."
      };

      writeJson(path.join(evidenceResult.sessionDir, "validation-result.json"), summary);
      previousRetryResults.push({ attempt, proposal, summary });
      writeFinalArtifacts(sessionRoot, summary, totalTokenUsage, previousRetryResults);
      appendHistory(options.historyFile, {
        timestamp: new Date().toISOString(),
        status: summary.status,
        attempts: attempt,
        failureCategory: classification.category,
        originalError: evidenceResult.failure.exceptionMessage,
        originalLocator: evidenceResult.failure.failedLocator,
        successfulLocator: null,
        fixType: proposal ? proposal.changeType : null,
        framework: "C# Playwright",
        browser: options.browserName || "unknown",
        pageOrComponent: evidenceResult.failure.sourceFile,
        validationResult: summary
      });
      return summary;
    }

    const applyResult = applyProposal(proposal, evidenceResult.sessionDir);
    writeJson(path.join(evidenceResult.sessionDir, "patch.json"), {
      proposal,
      applyResult
    });

    const compileResult = runOptionalCommand(options.compileCommand || "", options.cwd);
    writeJson(path.join(evidenceResult.sessionDir, "compile-result.json"), compileResult);

    if (!compileResult.skipped && compileResult.exitCode !== 0) {
      const reverted = revertProposal(proposal, applyResult);
      const summary = {
        status: "failed",
        attempts: attempt,
        debugPoint,
        classification,
        approval,
        analysis,
        proposal,
        proposalValidation,
        debugCopy,
        applyResult,
        compileResult,
        reverted,
        tokenUsage,
        sessionDir: evidenceResult.sessionDir,
        rerunExitCode: execution.exitCode,
        stopReason: "Compile validation failed after applying the approved patch."
      };

      writeJson(path.join(evidenceResult.sessionDir, "validation-result.json"), summary);
      previousRetryResults.push({ attempt, proposal, summary });
      writeFinalArtifacts(sessionRoot, summary, totalTokenUsage, previousRetryResults);
      appendHistory(options.historyFile, {
        timestamp: new Date().toISOString(),
        status: summary.status,
        attempts: attempt,
        failureCategory: classification.category,
        originalError: evidenceResult.failure.exceptionMessage,
        originalLocator: evidenceResult.failure.failedLocator,
        successfulLocator: null,
        fixType: proposal.changeType,
        framework: "C# Playwright",
        browser: options.browserName || "unknown",
        pageOrComponent: evidenceResult.failure.sourceFile,
        validationResult: summary
      });
      return summary;
    }

    const rerun = runCommand(options.testCommand, options.cwd);
    writeJson(path.join(evidenceResult.sessionDir, "rerun-result.json"), rerun);
    const resolved = rerun.exitCode === 0;
    let reverted = false;

    if (!resolved) {
      reverted = revertProposal(proposal, applyResult);
    }

    const summary = {
      status: resolved ? "resolved" : attempt >= maxAttempts ? "failed" : "retrying",
      attempts: attempt,
      debugPoint,
      classification,
      approval,
      analysis,
      proposal,
      proposalValidation,
      debugCopy,
      applyResult,
      compileResult,
      rerunExitCode: rerun.exitCode,
      reverted,
      tokenUsage,
      sessionDir: evidenceResult.sessionDir,
      stopReason: resolved
        ? "Approved patch compiled and rerun passed."
        : attempt >= maxAttempts
          ? `Maximum repair attempts (${maxAttempts}) reached without a passing rerun.`
          : "Rerun still failed; another bounded attempt is allowed."
    };

    writeJson(path.join(evidenceResult.sessionDir, "validation-result.json"), summary);
    previousRetryResults.push({
      attempt,
      proposal,
      summary
    });
    writeFinalArtifacts(sessionRoot, summary, totalTokenUsage, previousRetryResults);

    appendHistory(options.historyFile, {
      timestamp: new Date().toISOString(),
      status: summary.status,
      attempts: attempt,
      failureCategory: classification.category,
      originalError: evidenceResult.failure.exceptionMessage,
      originalLocator: evidenceResult.failure.failedLocator,
      successfulLocator: resolved && proposal.newCode ? proposal.newCode : null,
      fixType: proposal.changeType,
      framework: "C# Playwright",
      browser: options.browserName || "unknown",
      pageOrComponent: evidenceResult.failure.sourceFile,
      validationResult: summary
    });

    if (resolved || attempt >= maxAttempts) {
      return summary;
    }
  }

  return {
    status: "failed",
    attempts: maxAttempts,
    rerunExitCode: lastResult ? lastResult.exitCode : 1,
    stopReason: `Maximum repair attempts (${maxAttempts}) reached without a recoverable result.`
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  runDebugEngine({
    codeFilePath: args["code-file"] || "",
    storageStateFile: args["storage-state-file"] || "",
    compileCommand: args["compile-command"] || "",
    testCommand: args["test-command"] || "",
    testFile: args["test-file"] || "",
    cwd: args.cwd || process.cwd(),
    sourceFile: args["source-file"] || "",
    sourceLine: args["source-line"] || "1",
    testName: args["test-name"] || "",
    featureName: args["feature-name"] || "",
    scenarioName: args["scenario-name"] || "",
    stepText: args["step-text"] || "",
    locator: args.locator || "",
    locatorStrategy: args["locator-strategy"] || "",
    actionType: args["action-type"] || "",
    domFile: args["dom-file"] || "",
    metadataFile: args["metadata-file"] || "",
    screenshotFile: args["screenshot-file"] || "",
    traceFile: args["trace-file"] || "",
    pageHtmlFile: args["page-html-file"] || "",
    outputRoot: args["output-root"] || "",
    analysisFile: args["analysis-file"] || "",
    browserName: args["browser-name"] || "",
    inspectionDelayMs: args["inspection-delay-ms"] || "1200",
    testDataReference: args["test-data-reference"] || "",
    disableAI: args["disable-ai"] || "false",
    aiConfiguration: {
      provider: args["ai-provider"] || process.env.DEBUG_ENGINE_AI_PROVIDER || "OpenAI",
      model: args["ai-model"] || process.env.DEBUG_ENGINE_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: Number(args["ai-temperature"] || process.env.DEBUG_ENGINE_AI_TEMPERATURE || "0.1"),
      maxTokens: Number(args["ai-max-tokens"] || process.env.DEBUG_ENGINE_AI_MAX_TOKENS || "1200")
    },
    debugAutoFix: args["debug-auto-fix"] || "false",
    debugApprove: args["debug-approve"] || "false",
    debugNoPause: args["debug-no-pause"] || "false",
    debugMaxAttempts: args["debug-max-attempts"] || "2",
    historyFile: args["history-file"] || ""
  }).then((result) => {
    console.log(`[DebugEngine] status=${result.status} attempts=${result.attempts}`);
    if (result.status === "failed") {
      process.exit(1);
    }
  }).catch((error) => {
    console.error(`[DebugEngine] Failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}

if (require.main === module) {
  runCli();
}

module.exports = {
  extractSourceLocation,
  runCommand,
  runDebugEngine
};