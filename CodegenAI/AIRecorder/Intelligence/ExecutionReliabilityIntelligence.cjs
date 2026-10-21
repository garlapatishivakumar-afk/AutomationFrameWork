const Status = {
  PASS: "PASS",
  WARNING: "WARNING",
  BLOCKED: "BLOCKED"
};

const Severity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
};

const Category = {
  NONE: "NONE",
  TIMEOUT_VISIBILITY_RACE: "TIMEOUT_VISIBILITY_RACE",
  DETACHED_OR_STALE_ELEMENT: "DETACHED_OR_STALE_ELEMENT",
  NAVIGATION_NOT_SETTLED: "NAVIGATION_NOT_SETTLED",
  POPUP_WINDOW_SYNC: "POPUP_WINDOW_SYNC",
  ASSERTION_TIMING_MISMATCH: "ASSERTION_TIMING_MISMATCH",
  NETWORK_INFRA_TRANSIENT: "NETWORK_INFRA_TRANSIENT",
  UNKNOWN_RUNTIME_FAILURE: "UNKNOWN_RUNTIME_FAILURE"
};

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  return [value];
}

function buildSearchCorpus(evidence) {
  const parts = [
    evidence.errorMessage,
    evidence.stackTrace,
    evidence.stdout,
    evidence.stderr,
    ...toArray(evidence.traceEvents),
    ...toArray(evidence.networkErrors)
  ];

  return normalizeText(parts.filter(Boolean).join("\n"));
}

function extractEvidenceLines(evidence) {
  const lines = [];

  if (evidence.errorMessage) {
    lines.push(`Error: ${evidence.errorMessage}`);
  }

  if (evidence.timeoutMs) {
    lines.push(`Timeout: ${evidence.timeoutMs} ms`);
  }

  for (const networkError of toArray(evidence.networkErrors)) {
    lines.push(`Network: ${networkError}`);
  }

  for (const traceEvent of toArray(evidence.traceEvents)) {
    lines.push(`Trace: ${traceEvent}`);
  }

  if (evidence.locator) {
    lines.push(`Locator: ${evidence.locator}`);
  }

  return lines.slice(0, 8);
}

function anyPatternMatch(corpus, patterns) {
  return patterns.some((pattern) => pattern.test(corpus));
}

function scoreResult(status, confidence) {
  if (status === Status.PASS) {
    return 100;
  }

  const base = status === Status.BLOCKED ? 35 : 72;
  return Math.max(0, Math.min(100, Math.round(base + confidence * 20)));
}

function resultFor(ruleId, category, severity, confidence, recommendation, evidence) {
  const status = severity === Severity.HIGH ? Status.BLOCKED : Status.WARNING;

  return {
    status,
    blocking: status === Status.BLOCKED,
    score: scoreResult(status, confidence),
    category,
    severity,
    confidence,
    recommendation,
    rules: [
      {
        ruleId,
        status,
        category,
        severity,
        confidence,
        recommendation,
        evidence
      }
    ],
    evidence
  };
}

function passResult() {
  return {
    status: Status.PASS,
    blocking: false,
    score: 100,
    category: Category.NONE,
    severity: Severity.LOW,
    confidence: 1,
    recommendation: "No runtime failure detected.",
    rules: [],
    evidence: []
  };
}

function hasFailureSignal(evidence) {
  if (evidence.failed === true) {
    return true;
  }

  const corpus = buildSearchCorpus(evidence);
  if (!corpus) {
    return false;
  }

  return anyPatternMatch(corpus, [
    /timeout/,
    /error/,
    /exception/,
    /failed/,
    /not visible/,
    /detached/,
    /navigation/,
    /assertion/,
    /expect\(/,
    /net::err/,
    /econnreset|etimedout|econnrefused|enotfound/
  ]);
}

function classifyExecutionReliability(evidenceInput) {
  const evidence = evidenceInput || {};

  if (!hasFailureSignal(evidence)) {
    return passResult();
  }

  const corpus = buildSearchCorpus(evidence);
  const evidenceLines = extractEvidenceLines(evidence);

  if (anyPatternMatch(corpus, [
    /waitforevent\(['\"]popup['\"]\)/,
    /popup/,
    /new page/,
    /window/,
    /no popup/
  ])) {
    return resultFor(
      "ERI004",
      Category.POPUP_WINDOW_SYNC,
      Severity.HIGH,
      0.86,
      "Review popup/window synchronization sequence and ensure event wait begins before trigger action.",
      evidenceLines
    );
  }

  if (anyPatternMatch(corpus, [
    /timeout .*waiting for/,
    /waiting for .* to be visible/,
    /element is not visible/,
    /to be visible/,
    /locator\([^\)]*\).*timeout/
  ])) {
    return resultFor(
      "ERI001",
      Category.TIMEOUT_VISIBILITY_RACE,
      Severity.HIGH,
      0.92,
      "Review synchronization and wait strategy for target visibility/readiness.",
      evidenceLines
    );
  }

  if (anyPatternMatch(corpus, [
    /element is not attached to the dom/,
    /detached from dom/,
    /stale element/
  ])) {
    return resultFor(
      "ERI002",
      Category.DETACHED_OR_STALE_ELEMENT,
      Severity.HIGH,
      0.89,
      "Re-locate the element after DOM updates and ensure state stabilization before interaction.",
      evidenceLines
    );
  }

  if (anyPatternMatch(corpus, [
    /navigation/,
    /target page, context or browser has been closed/,
    /execution context was destroyed, most likely because of a navigation/,
    /net::err_aborted/
  ])) {
    return resultFor(
      "ERI003",
      Category.NAVIGATION_NOT_SETTLED,
      Severity.HIGH,
      0.9,
      "Review navigation synchronization and wait for document/network settle points.",
      evidenceLines
    );
  }

  if (anyPatternMatch(corpus, [
    /expect\(/,
    /assertion/,
    /tohavetext|tocontaintext|tobevisible/,
    /received string|expected string/,
    /strict mode violation/
  ])) {
    return resultFor(
      "ERI005",
      Category.ASSERTION_TIMING_MISMATCH,
      Severity.MEDIUM,
      0.84,
      "Review assertion timing and expected state before asserting outcome.",
      evidenceLines
    );
  }

  if (anyPatternMatch(corpus, [
    /econnreset|etimedout|econnrefused|enotfound/,
    /net::err_/,
    /502|503|504/,
    /socket hang up/,
    /dns/,
    /connection reset/
  ])) {
    return resultFor(
      "ERI006",
      Category.NETWORK_INFRA_TRANSIENT,
      Severity.MEDIUM,
      0.81,
      "Review environment/network reliability and retry strategy for transient infrastructure failures.",
      evidenceLines
    );
  }

  return resultFor(
    "ERI007",
    Category.UNKNOWN_RUNTIME_FAILURE,
    Severity.MEDIUM,
    0.55,
    "Review runtime evidence and classify the failure with additional trace/log context.",
    evidenceLines
  );
}

class ExecutionReliabilityIntelligence {
  classifyFailure(evidence) {
    return classifyExecutionReliability(evidence);
  }
}

module.exports = {
  Status,
  Severity,
  Category,
  classifyExecutionReliability,
  ExecutionReliabilityIntelligence
};
