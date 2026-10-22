const fs = require("fs");
const path = require("path");

const Candidate = {
  SELF_HEALING_RETRY_POLICY: "SELF_HEALING_RETRY_POLICY",
  MAINTAINABILITY_DRIFT: "MAINTAINABILITY_DRIFT",
  COST_STABILITY_OPTIMIZER: "COST_STABILITY_OPTIMIZER"
};

const CandidateLabel = {
  [Candidate.SELF_HEALING_RETRY_POLICY]: "Self-Healing Retry Policy Intelligence",
  [Candidate.MAINTAINABILITY_DRIFT]: "Maintainability Drift Intelligence",
  [Candidate.COST_STABILITY_OPTIMIZER]: "Execution Cost & Stability Optimizer"
};

function safeReadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function listJsonFilesRecursively(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    return [];
  }

  const stats = fs.statSync(resolved);
  if (stats.isFile()) {
    return resolved.toLowerCase().endsWith(".json") ? [resolved] : [];
  }

  const files = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    const full = path.join(resolved, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursively(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      files.push(full);
    }
  }

  return files;
}

function collectGenerationReports(inputs) {
  const items = Array.isArray(inputs) ? inputs : [inputs];
  const files = [];

  for (const item of items.filter(Boolean)) {
    for (const jsonFile of listJsonFilesRecursively(item)) {
      if (path.basename(jsonFile).toLowerCase().includes("csharpgenerationreport")) {
        files.push(jsonFile);
      }
    }
  }

  const unique = [...new Set(files)];
  return unique
    .map((filePath) => ({ filePath, payload: safeReadJson(filePath) }))
    .filter((entry) => entry.payload && typeof entry.payload === "object");
}

function collectRuntimeRunReports(inputs) {
  const items = Array.isArray(inputs) ? inputs : [inputs];
  const files = [];

  for (const item of items.filter(Boolean)) {
    for (const jsonFile of listJsonFilesRecursively(item)) {
      const name = path.basename(jsonFile).toLowerCase();
      if (name.includes("runtime") || name.includes("execution") || name.includes("playwright")) {
        files.push(jsonFile);
      }
    }
  }

  const unique = [...new Set(files)];
  return unique
    .map((filePath) => ({ filePath, payload: safeReadJson(filePath) }))
    .filter((entry) => entry.payload && typeof entry.payload === "object");
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toSeverityScore(severity) {
  if (severity === "HIGH") {
    return 1;
  }

  if (severity === "MEDIUM") {
    return 0.65;
  }

  if (severity === "LOW") {
    return 0.35;
  }

  return 0;
}

function average(values, fallback = 0) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }

  const total = values.reduce((sum, item) => sum + (Number(item) || 0), 0);
  return total / values.length;
}

function scoreToBand(score) {
  if (score >= 75) {
    return "High";
  }

  if (score >= 45) {
    return "Medium";
  }

  return "Low";
}

function buildRunSignals(generationReports) {
  return generationReports.map((entry) => {
    const report = entry.payload || {};
    const execution = report.executionReliability || {};
    const locatorValidation = report.locatorValidation || {};
    const triage = report.failureTriage || {};
    const methodGate = report.methodQualityGate || {};

    const category = String(execution.category || "NONE");
    const severity = String(execution.severity || "LOW");
    const blocked = execution.blocking === true || triage.status === "BLOCKED";

    const retrySignal = [
      "TIMEOUT_VISIBILITY_RACE",
      "NAVIGATION_NOT_SETTLED",
      "POPUP_WINDOW_SYNC",
      "ASSERTION_TIMING_MISMATCH",
      "NETWORK_INFRA_TRANSIENT"
    ].includes(category);

    const driftSignal = Boolean(
      locatorValidation.hasFailures ||
      triage.category === "LOCATOR_VALIDATION" ||
      triage.category === "LOCATOR_REPAIR_FAILED" ||
      category === "DETACHED_OR_STALE_ELEMENT"
    );

    const costSignal = Boolean(
      category === "ASSERTION_TIMING_MISMATCH" ||
      category === "TIMEOUT_VISIBILITY_RACE" ||
      (Array.isArray(methodGate.rules) && methodGate.rules.some((rule) => rule.ruleId === "MQG010" || rule.ruleId === "MQG013"))
    );

    return {
      filePath: entry.filePath,
      category,
      severity,
      blocked,
      retrySignal,
      driftSignal,
      costSignal,
      confidence: Number(execution.confidence) || 0,
      rerunSuccess: null,
      diagnosisMinutes: null
    };
  });
}

function mergeRuntimeEvidenceSignals(runSignals, runtimeReports) {
  if (!Array.isArray(runtimeReports) || runtimeReports.length === 0) {
    return runSignals;
  }

  const runtimeRows = runtimeReports.map((entry) => entry.payload || {});
  const rerunValues = runtimeRows
    .map((row) => {
      const rerun = row.rerun || {};
      if (typeof rerun.succeeded === "boolean") {
        return rerun.succeeded ? 1 : 0;
      }
      return null;
    })
    .filter((x) => x !== null);

  const diagnosisValues = runtimeRows
    .map((row) => {
      if (typeof row.diagnosisMinutes === "number") {
        return row.diagnosisMinutes;
      }
      const diagnosis = row.diagnosis || {};
      if (typeof diagnosis.minutes === "number") {
        return diagnosis.minutes;
      }
      return null;
    })
    .filter((x) => x !== null);

  const fallbackRerun = rerunValues.length > 0 ? average(rerunValues, 0.5) : null;
  const fallbackDiagnosis = diagnosisValues.length > 0 ? average(diagnosisValues, 25) : null;

  return runSignals.map((signal) => ({
    ...signal,
    rerunSuccess: signal.rerunSuccess === null ? fallbackRerun : signal.rerunSuccess,
    diagnosisMinutes: signal.diagnosisMinutes === null ? fallbackDiagnosis : signal.diagnosisMinutes
  }));
}

function estimateRerunSuccessForCandidate(candidate, matchingSignals) {
  const explicit = matchingSignals
    .map((x) => x.rerunSuccess)
    .filter((x) => typeof x === "number");

  if (explicit.length > 0) {
    return clamp01(average(explicit, 0.5));
  }

  if (candidate === Candidate.SELF_HEALING_RETRY_POLICY) {
    return 0.68;
  }

  if (candidate === Candidate.MAINTAINABILITY_DRIFT) {
    return 0.22;
  }

  return 0.45;
}

function estimateDiagnosisEffort(candidate, matchingSignals) {
  const explicitMinutes = matchingSignals
    .map((x) => x.diagnosisMinutes)
    .filter((x) => typeof x === "number");

  if (explicitMinutes.length > 0) {
    const avgMinutes = average(explicitMinutes, 20);
    return clamp01(avgMinutes / 60);
  }

  const severityAverage = average(matchingSignals.map((x) => toSeverityScore(x.severity)), 0.5);

  if (candidate === Candidate.SELF_HEALING_RETRY_POLICY) {
    return clamp01(0.55 + severityAverage * 0.35);
  }

  if (candidate === Candidate.MAINTAINABILITY_DRIFT) {
    return clamp01(0.65 + severityAverage * 0.3);
  }

  return clamp01(0.45 + severityAverage * 0.25);
}

function scoreCandidate(candidate, allSignals, predicate) {
  const totalRuns = allSignals.length;
  const matchingSignals = allSignals.filter(predicate);
  const frequency = totalRuns === 0 ? 0 : matchingSignals.length / totalRuns;

  const impact = average(
    matchingSignals.map((x) => {
      const severityScore = toSeverityScore(x.severity);
      const blockBoost = x.blocked ? 0.2 : 0;
      return clamp01(severityScore + blockBoost);
    }),
    0
  );

  const rerunSuccess = estimateRerunSuccessForCandidate(candidate, matchingSignals);
  const diagnosisEffort = estimateDiagnosisEffort(candidate, matchingSignals);

  let rerunFactor = rerunSuccess;
  if (candidate === Candidate.MAINTAINABILITY_DRIFT) {
    rerunFactor = 1 - rerunSuccess;
  } else if (candidate === Candidate.COST_STABILITY_OPTIMIZER) {
    rerunFactor = clamp01(0.5 + (0.5 - Math.abs(rerunSuccess - 0.5)) * 0.3);
  }

  const priority = Math.round(
    100 * (
      0.4 * frequency +
      0.3 * impact +
      0.2 * rerunFactor +
      0.1 * diagnosisEffort
    )
  );

  return {
    candidate,
    candidateLabel: CandidateLabel[candidate],
    failureFrequencyPct: Math.round(frequency * 100),
    impactBand: scoreToBand(impact * 100),
    impactScore: Math.round(impact * 100),
    rerunSuccessPct: Math.round(rerunSuccess * 100),
    diagnosisEffortBand: scoreToBand(diagnosisEffort * 100),
    diagnosisEffortScore: Math.round(diagnosisEffort * 100),
    priorityScore: priority,
    matchedRuns: matchingSignals.length,
    totalRuns
  };
}

function summarizeReason(top) {
  if (!top) {
    return "Insufficient evidence to recommend a Phase 7 candidate.";
  }

  if (top.candidate === Candidate.SELF_HEALING_RETRY_POLICY) {
    return "Runtime failures show high transient/recoverable patterns, making deterministic retry policy the highest-value next capability.";
  }

  if (top.candidate === Candidate.MAINTAINABILITY_DRIFT) {
    return "Failure patterns indicate persistent locator/drift behavior with low rerun recovery, so maintainability drift intelligence is the highest-value next capability.";
  }

  return "Failure patterns indicate stability/cost inefficiency pressure, so execution cost and stability optimization is the highest-value next capability.";
}

function selectPhase7Candidate(options = {}) {
  const generationReports = collectGenerationReports(options.generationReportInputs || []);
  const runtimeReports = collectRuntimeRunReports(options.runtimeReportInputs || []);

  const initialSignals = buildRunSignals(generationReports);
  const runSignals = mergeRuntimeEvidenceSignals(initialSignals, runtimeReports);

  const scorecards = [
    scoreCandidate(Candidate.SELF_HEALING_RETRY_POLICY, runSignals, (x) => x.retrySignal),
    scoreCandidate(Candidate.MAINTAINABILITY_DRIFT, runSignals, (x) => x.driftSignal),
    scoreCandidate(Candidate.COST_STABILITY_OPTIMIZER, runSignals, (x) => x.costSignal)
  ].sort((a, b) => b.priorityScore - a.priorityScore);

  const recommended = scorecards[0] || null;

  return {
    generatedAtUtc: new Date().toISOString(),
    inputCounts: {
      generationReports: generationReports.length,
      runtimeReports: runtimeReports.length,
      runsAnalyzed: runSignals.length
    },
    recommendedCandidate: recommended,
    reason: summarizeReason(recommended),
    scorecards
  };
}

function formatSelectionSummary(result) {
  const top = result.recommendedCandidate;
  if (!top) {
    return [
      "Phase 7 Recommendation",
      "----------------------",
      "No recommendation available (insufficient data)."
    ].join("\n");
  }

  return [
    "Phase 7 Recommendation",
    "----------------------",
    "",
    `Candidate: ${top.candidateLabel}`,
    "",
    `Failure frequency: ${top.failureFrequencyPct}%`,
    `Impact: ${top.impactBand} (${top.impactScore}/100)`,
    `Rerun success: ${top.rerunSuccessPct}%`,
    `Diagnosis effort: ${top.diagnosisEffortBand} (${top.diagnosisEffortScore}/100)`,
    "",
    `Priority Score: ${top.priorityScore}/100`,
    "",
    "Reason:",
    summarizeReason(top)
  ].join("\n");
}

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

function toInputList(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function runCli() {
  const args = parseArgs(process.argv);
  const generationInputs = toInputList(args["generation-reports"]);
  const runtimeInputs = toInputList(args["runtime-reports"]);

  if (generationInputs.length === 0) {
    generationInputs.push(path.resolve(process.cwd(), "GeneratedOutput"));
  }

  const result = selectPhase7Candidate({
    generationReportInputs: generationInputs,
    runtimeReportInputs: runtimeInputs
  });

  if (args["output-file"]) {
    const outputFile = path.resolve(args["output-file"]);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), "utf8");
  }

  console.log(formatSelectionSummary(result));
}

if (require.main === module) {
  runCli();
}

module.exports = {
  Candidate,
  CandidateLabel,
  collectGenerationReports,
  collectRuntimeRunReports,
  selectPhase7Candidate,
  formatSelectionSummary
};
