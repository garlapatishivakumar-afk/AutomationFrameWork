const Status = {
  PASS: "PASS",
  WARNING: "WARNING"
};

const Severity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH"
};

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toRuns(history) {
  const runs = history && Array.isArray(history.runs) ? history.runs : [];
  return runs.map((run) => ({
    timestampUtc: String(run.timestampUtc || ""),
    testName: String(run.testName || ""),
    failed: run.failed === true,
    executionReliability: run.executionReliability || {},
    locatorChanges: Array.isArray(run.locatorChanges) ? run.locatorChanges : []
  }));
}

function countBy(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function topEntries(map, topN = 3) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({ key, count }));
}

function buildMetrics(runs) {
  const totalRuns = runs.length;
  const failedRuns = runs.filter((run) => run.failed);

  const locatorChangeEvents = runs.flatMap((run) => run.locatorChanges.map((change) => ({
    key: String(change.key || change.locatorKey || "UnknownLocator"),
    run: run.timestampUtc || "unknown"
  })));

  const categorySignals = runs
    .map((run) => String((run.executionReliability || {}).category || "NONE"))
    .filter((category) => category !== "NONE");

  const failureRateOverall = totalRuns === 0 ? 0 : failedRuns.length / totalRuns;

  const midpoint = Math.floor(totalRuns / 2);
  const firstWindow = runs.slice(0, midpoint);
  const secondWindow = runs.slice(midpoint);

  const firstRate = firstWindow.length === 0
    ? 0
    : firstWindow.filter((run) => run.failed).length / firstWindow.length;
  const secondRate = secondWindow.length === 0
    ? 0
    : secondWindow.filter((run) => run.failed).length / secondWindow.length;

  const failureTrendIncrease = clamp01(secondRate - firstRate);

  const locatorByKey = countBy(locatorChangeEvents, (x) => x.key);
  const categoryByKey = countBy(categorySignals, (x) => x);

  const maxLocatorChangesForOneKey = Math.max(0, ...locatorByKey.values());
  const maxCategoryRepeat = Math.max(0, ...categoryByKey.values());

  return {
    totalRuns,
    failedRuns: failedRuns.length,
    failureRateOverall,
    failureTrendIncrease,
    locatorChangeCount: locatorChangeEvents.length,
    uniqueLocatorsChanged: locatorByKey.size,
    maxLocatorChangesForOneKey,
    maxCategoryRepeat,
    topLocatorHotspots: topEntries(locatorByKey, 5),
    topExecutionCategories: topEntries(categoryByKey, 5)
  };
}

function computeDriftScore(metrics) {
  const locatorChurnScore = clamp01(metrics.maxLocatorChangesForOneKey / 3);
  const categoryRepeatScore = clamp01(metrics.maxCategoryRepeat / 5);
  const failureTrendScore = clamp01(metrics.failureTrendIncrease / 0.5);
  const failureRateScore = clamp01(metrics.failureRateOverall / 0.6);

  const score = Math.round(
    locatorChurnScore * 35 +
    categoryRepeatScore * 30 +
    failureTrendScore * 20 +
    failureRateScore * 15
  );

  return {
    score,
    locatorChurnScore,
    categoryRepeatScore,
    failureTrendScore,
    failureRateScore
  };
}

function severityFromScore(score) {
  if (score >= 75) {
    return Severity.HIGH;
  }

  if (score >= 35) {
    return Severity.MEDIUM;
  }

  return Severity.LOW;
}

function createRule(ruleId, status, message, evidence) {
  return {
    ruleId,
    status,
    message,
    evidence: Array.isArray(evidence) ? evidence : []
  };
}

function analyzeMaintainabilityDrift(historyInput, options = {}) {
  const runs = toRuns(historyInput || {});
  const minimumRuns = Number(options.minimumRuns) > 0 ? Number(options.minimumRuns) : 3;

  const metrics = buildMetrics(runs);

  const rules = [];
  const recommendations = [];

  if (metrics.totalRuns < minimumRuns) {
    rules.push(createRule(
      "MDI000",
      Status.WARNING,
      `Insufficient history for confident drift analysis. Runs=${metrics.totalRuns}, minimum=${minimumRuns}.`,
      []
    ));

    return {
      status: Status.WARNING,
      severity: Severity.LOW,
      driftDetected: false,
      driftScore: 0,
      blocking: false,
      metrics,
      hotspots: [],
      rules,
      recommendations: ["Collect more run history before using drift score for prioritization."]
    };
  }

  const scoreBundle = computeDriftScore(metrics);
  const driftScore = scoreBundle.score;
  const severity = severityFromScore(driftScore);

  if (metrics.maxLocatorChangesForOneKey >= 3) {
    rules.push(createRule(
      "MDI001",
      Status.WARNING,
      "Locator key changed repeatedly across runs.",
      metrics.topLocatorHotspots.map((x) => `${x.key}: ${x.count} change(s)`).slice(0, 3)
    ));
    recommendations.push("Prioritize locator refactoring for top hotspot keys.");
  }

  if (metrics.maxCategoryRepeat >= 4) {
    rules.push(createRule(
      "MDI002",
      Status.WARNING,
      "Same runtime failure category repeats across runs.",
      metrics.topExecutionCategories.map((x) => `${x.key}: ${x.count} run(s)`).slice(0, 3)
    ));
    recommendations.push("Investigate recurring execution category and stabilize related test flow.");
  }

  if (metrics.failureTrendIncrease >= 0.2) {
    rules.push(createRule(
      "MDI003",
      Status.WARNING,
      "Failure rate is increasing over time.",
      [
        `Failure rate overall: ${Math.round(metrics.failureRateOverall * 100)}%`,
        `Trend increase: ${Math.round(metrics.failureTrendIncrease * 100)}%`
      ]
    ));
    recommendations.push("Schedule maintenance for scenarios with rising failure trend.");
  }

  if (metrics.failureRateOverall >= 0.5) {
    rules.push(createRule(
      "MDI004",
      Status.WARNING,
      "Overall failure rate indicates maintainability risk.",
      [`Failed runs: ${metrics.failedRuns}/${metrics.totalRuns}`]
    ));
    recommendations.push("Prioritize this test suite for near-term maintenance before new feature work.");
  }

  if (rules.length === 0) {
    rules.push(createRule(
      "MDI005",
      Status.PASS,
      "No significant maintainability drift signal detected.",
      []
    ));
  }

  const dedupRecommendations = [...new Set(recommendations)];
  const hotspots = metrics.topLocatorHotspots.map((item) => ({
    key: item.key,
    locatorChanges: item.count
  }));

  const driftDetected = driftScore >= 35;

  return {
    status: driftDetected ? Status.WARNING : Status.PASS,
    severity,
    driftDetected,
    driftScore,
    blocking: false,
    metrics: {
      ...metrics,
      scoreComponents: {
        locatorChurnScore: Math.round(scoreBundle.locatorChurnScore * 100),
        categoryRepeatScore: Math.round(scoreBundle.categoryRepeatScore * 100),
        failureTrendScore: Math.round(scoreBundle.failureTrendScore * 100),
        failureRateScore: Math.round(scoreBundle.failureRateScore * 100)
      }
    },
    hotspots,
    rules,
    recommendations: dedupRecommendations.length > 0
      ? dedupRecommendations
      : ["Continue monitoring drift indicators over subsequent runs."]
  };
}

class MaintainabilityDriftIntelligence {
  analyze(history, options) {
    return analyzeMaintainabilityDrift(history, options);
  }
}

module.exports = {
  Status,
  Severity,
  analyzeMaintainabilityDrift,
  MaintainabilityDriftIntelligence
};
