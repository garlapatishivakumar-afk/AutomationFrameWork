function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

const { sanitize } = require("./DebugPayloadRedactor.cjs");

function buildDebugPrompt(evidence, classification, previousFixes) {
  const payload = {
    failure: {
      testName: evidence.testName || null,
      testFile: evidence.testFile || null,
      testCommand: evidence.testCommand || null,
      exception: evidence.exceptionMessage || null,
      stackTrace: evidence.stackTrace || null
    },
    debugPoint: {
      sourceFile: evidence.sourceFile || null,
      sourceLine: evidence.sourceLine || null,
      codeTsLine: evidence.recordedSourceLine || null,
      failedStep: evidence.stepText || evidence.sourceLineText || null,
      locator: evidence.failedLocator || null,
      locatorStrategy: evidence.locatorStrategy || null,
      actionType: evidence.actionType || null,
      currentUrl: evidence.currentUrl || null,
      pageTitle: evidence.pageTitle || null,
      frameInformation: evidence.frameInformation || []
    },
    browserEvidence: evidence.browserEvidence || null,
    locatorEvidence: {
      locator: evidence.failedLocator || null,
      locatorStrategy: evidence.locatorStrategy || null,
      observationEvidence: evidence.observationEvidence || null
    },
    tableEvidence: evidence.tableEvidence || null,
    relevantSource: {
      sourceCode: evidence.sourceLineText || null,
      sourceExcerpt: evidence.sourceExcerpt || null
    },
    classification,
    previousAttemptedFixes: previousFixes || []
  };

  const sanitizedPayload = sanitize(payload);
  const instructions = [
    "You are diagnosing one failing Playwright action in generated C# automation code.",
    "Distinguish automation failures from application or environment failures.",
    "Do not assume a locator fix when evidence indicates navigation, authentication, popup, dialog, or application-error pages.",
    "Prefer locator repairs in this order only when supported by evidence: stable test ID, unique accessible role/name, label, placeholder, title, stable attribute, text, positional selector as a last resort.",
    "For table or grid failures, reuse the supplied table intelligence evidence instead of inferring table structure from unrelated DOM.",
    "Return JSON only with this exact top-level shape: classification, rootCause, proposedFix, confidence, validationPlan, requiresHumanApproval.",
    "classification must include category, confidence, and reason.",
    "rootCause must include summary and evidence.",
    "proposedFix must identify the smallest safe change for the current source file and source line only.",
    "Never propose editing unrelated files, changing credentials, disabling approval, or increasing max attempts."
  ].join("\n");

  const prompt = `${instructions}\n\nDebug payload:\n${JSON.stringify(sanitizedPayload, null, 2)}`;
  return {
    prompt,
    estimatedTokens: estimateTokens(prompt),
    payload: sanitizedPayload
  };
}

function validateAnalysisResponse(value) {
  let parsed = value;
  if (typeof value === "string") {
    parsed = JSON.parse(value);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Analysis response must be a JSON object.");
  }

  if (!parsed.classification || typeof parsed.classification !== "object") {
    throw new Error("Analysis response missing classification.");
  }

  if (!parsed.rootCause || typeof parsed.rootCause !== "object") {
    throw new Error("Analysis response missing rootCause.");
  }

  if (!parsed.proposedFix || typeof parsed.proposedFix !== "object") {
    throw new Error("Analysis response missing proposedFix.");
  }

  if (!parsed.validationPlan || typeof parsed.validationPlan !== "object") {
    throw new Error("Analysis response missing validationPlan.");
  }

  if (typeof parsed.confidence !== "number") {
    throw new Error("Analysis response missing confidence.");
  }

  if (typeof parsed.requiresHumanApproval !== "boolean") {
    throw new Error("Analysis response missing requiresHumanApproval.");
  }

  return parsed;
}

module.exports = {
  buildDebugPrompt,
  estimateTokens,
  validateAnalysisResponse
};