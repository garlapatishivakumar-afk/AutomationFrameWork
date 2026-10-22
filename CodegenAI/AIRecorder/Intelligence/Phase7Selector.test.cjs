const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  selectPhase7Candidate,
  formatSelectionSummary
} = require("./Phase7Selector.cjs");

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase7-selector-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function makeGenerationReport(overrides = {}) {
  return {
    generatedAtUtc: "2026-10-08T00:00:00.000Z",
    failureTriage: {
      status: "PASS",
      category: "NONE"
    },
    locatorValidation: {
      hasFailures: false,
      warningLocators: 0,
      failedLocators: 0,
      results: []
    },
    methodQualityGate: {
      rules: []
    },
    executionReliability: {
      status: "PASS",
      blocking: false,
      category: "NONE",
      severity: "LOW",
      confidence: 1,
      recommendation: "No runtime failure detected.",
      rules: [],
      evidence: []
    },
    ...overrides
  };
}

function testRecommendsSelfHealingWhenTransientFailuresDominate() {
  withTempDir((tempDir) => {
    writeJson(path.join(tempDir, "GeneratedOutput", "CSharpGenerationReport-1.json"), makeGenerationReport({
      executionReliability: {
        status: "BLOCKED",
        blocking: true,
        category: "TIMEOUT_VISIBILITY_RACE",
        severity: "HIGH",
        confidence: 0.92,
        recommendation: "Review wait strategy.",
        rules: [{ ruleId: "ERI001" }],
        evidence: []
      }
    }));

    writeJson(path.join(tempDir, "GeneratedOutput", "CSharpGenerationReport-2.json"), makeGenerationReport({
      executionReliability: {
        status: "WARNING",
        blocking: false,
        category: "NETWORK_INFRA_TRANSIENT",
        severity: "MEDIUM",
        confidence: 0.81,
        recommendation: "Review infra transient.",
        rules: [{ ruleId: "ERI006" }],
        evidence: []
      }
    }));

    const result = selectPhase7Candidate({
      generationReportInputs: [tempDir]
    });

    assert.strictEqual(result.recommendedCandidate.candidate, "SELF_HEALING_RETRY_POLICY");
    assert.ok(result.recommendedCandidate.priorityScore > 0);
    assert.ok(result.reason.includes("transient"));
  });
}

function testRecommendsDriftWhenLocatorFailuresPersist() {
  withTempDir((tempDir) => {
    writeJson(path.join(tempDir, "GeneratedOutput", "CSharpGenerationReport-A.json"), makeGenerationReport({
      failureTriage: { status: "BLOCKED", category: "LOCATOR_VALIDATION" },
      locatorValidation: {
        hasFailures: true,
        warningLocators: 1,
        failedLocators: 3,
        results: []
      },
      executionReliability: {
        status: "WARNING",
        blocking: false,
        category: "DETACHED_OR_STALE_ELEMENT",
        severity: "HIGH",
        confidence: 0.89,
        recommendation: "Re-locate element.",
        rules: [{ ruleId: "ERI002" }],
        evidence: []
      }
    }));

    writeJson(path.join(tempDir, "GeneratedOutput", "CSharpGenerationReport-B.json"), makeGenerationReport({
      failureTriage: { status: "BLOCKED", category: "LOCATOR_REPAIR_FAILED" },
      locatorValidation: {
        hasFailures: true,
        warningLocators: 0,
        failedLocators: 2,
        results: []
      },
      executionReliability: {
        status: "WARNING",
        blocking: false,
        category: "UNKNOWN_RUNTIME_FAILURE",
        severity: "MEDIUM",
        confidence: 0.55,
        recommendation: "Review runtime.",
        rules: [{ ruleId: "ERI007" }],
        evidence: []
      }
    }));

    writeJson(path.join(tempDir, "runtime-execution-summary.json"), {
      rerun: {
        attempted: true,
        succeeded: false
      },
      diagnosisMinutes: 48
    });

    const result = selectPhase7Candidate({
      generationReportInputs: [tempDir],
      runtimeReportInputs: [tempDir]
    });

    assert.strictEqual(result.recommendedCandidate.candidate, "MAINTAINABILITY_DRIFT");
    assert.ok(result.recommendedCandidate.diagnosisEffortScore >= 60);
  });
}

function testSummaryFormattingIncludesPriorityScore() {
  withTempDir((tempDir) => {
    writeJson(path.join(tempDir, "GeneratedOutput", "CSharpGenerationReport-1.json"), makeGenerationReport({
      executionReliability: {
        status: "BLOCKED",
        blocking: true,
        category: "TIMEOUT_VISIBILITY_RACE",
        severity: "HIGH",
        confidence: 0.92,
        recommendation: "Review wait strategy.",
        rules: [{ ruleId: "ERI001" }],
        evidence: []
      }
    }));

    const result = selectPhase7Candidate({
      generationReportInputs: [tempDir]
    });

    const summary = formatSelectionSummary(result);
    assert.ok(summary.includes("Phase 7 Recommendation"));
    assert.ok(summary.includes("Priority Score:"));
    assert.ok(summary.includes("Failure frequency:"));
  });
}

function runAllTests() {
  testRecommendsSelfHealingWhenTransientFailuresDominate();
  testRecommendsDriftWhenLocatorFailuresPersist();
  testSummaryFormattingIncludesPriorityScore();
  console.log("Phase7Selector tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
