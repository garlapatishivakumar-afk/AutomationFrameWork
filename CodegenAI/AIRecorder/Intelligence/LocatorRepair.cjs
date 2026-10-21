const fs = require("fs");

function safeReadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function normalizeAttributeName(value) {
  return String(value || "").trim().toLowerCase();
}

function getLocatorText(action) {
  if (!action || !action.locator) {
    return "";
  }

  const locator = action.locator;
  if (locator.kind === "locator" || locator.kind === "frameLocator") {
    return String(locator.selector || "");
  }

  if (locator.kind === "expression") {
    return String(locator.expression || "");
  }

  if (locator.kind === "role" || locator.kind === "scopedRole" || locator.kind === "frameRole" || locator.kind === "frameScopedRole") {
    return String(locator.name || "");
  }

  if (locator.kind === "text" || locator.kind === "scopedText" || locator.kind === "frameText" || locator.kind === "frameScopedText" || locator.kind === "label" || locator.kind === "placeholder" || locator.kind === "title" || locator.kind === "testid") {
    return String(locator.text || "");
  }

  return "";
}

function cloneAction(action) {
  return JSON.parse(JSON.stringify(action));
}

function buildStableAttributes(domAction) {
  if (!domAction || !domAction.target) {
    return [];
  }

  const target = domAction.target;
  const attributes = [];

  if (target.id) {
    attributes.push({ name: "id", value: String(target.id) });
  }

  if (target.testId) {
    attributes.push({ name: "data-testid", value: String(target.testId) });
  }

  if (target.name) {
    attributes.push({ name: "name", value: String(target.name) });
  }

  if (target.ariaLabel) {
    attributes.push({ name: "aria-label", value: String(target.ariaLabel) });
  }

  if (target.attributes && typeof target.attributes === "object") {
    for (const [name, value] of Object.entries(target.attributes)) {
      if (typeof value === "string" && value.trim().length > 0) {
        attributes.push({ name, value });
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of attributes) {
    const key = `${normalizeAttributeName(item.name)}=${item.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function buildSuggestedLocator(targetTag, stableAttributes) {
  const preferredOrder = ["id", "data-testid", "name", "aria-label"];
  const tag = String(targetTag || "*").trim().toLowerCase() || "*";

  for (const attributeName of preferredOrder) {
    const match = stableAttributes.find((item) => normalizeAttributeName(item.name) === attributeName && String(item.value || "").trim().length > 0);
    if (!match) {
      continue;
    }

    const escapedValue = String(match.value).replace(/'/g, "''");
    return `//${tag}[@${match.name}='${escapedValue}']`;
  }

  const stableDataAttribute = stableAttributes.find((item) => {
    const name = normalizeAttributeName(item.name);
    return name.startsWith("data-") && name !== "data-testid" && String(item.value || "").trim().length > 0;
  });

  if (stableDataAttribute) {
    const escapedValue = String(stableDataAttribute.value).replace(/'/g, "''");
    return `//${tag}[@${stableDataAttribute.name}='${escapedValue}']`;
  }

  return "";
}

function applyRepairedLocator(action, repairedLocator) {
  const updated = cloneAction(action);
  updated.locator = {
    kind: "locator",
    actor: action.locator && action.locator.actor ? action.locator.actor : "page",
    selector: repairedLocator,
    first: false,
    position: null
  };
  updated.locatorStrategy = "REPAIRED_XPATH";
  return updated;
}

class LocatorRepair {
  constructor(options = {}) {
    this.options = options;
    this.maxAttempts = Number.isFinite(Number(options.maxAttempts)) ? Number(options.maxAttempts) : 1;
    this.domByLine = new Map();

    const domObservations = safeReadJson(options.domObservationPath || "");
    const domActions = Array.isArray(domObservations.actions) ? domObservations.actions : [];
    for (const action of domActions) {
      const line = Number(action && action.line);
      if (Number.isFinite(line)) {
        this.domByLine.set(line, action);
      }
    }
  }

  repair(actions, locatorValidation) {
    const result = {
      attempts: 0,
      repairStatus: "SKIPPED",
      repairedAny: false,
      codeGenerationBlocked: Boolean(locatorValidation && locatorValidation.hasFailures),
      items: [],
      actions
    };

    if (!locatorValidation || !locatorValidation.hasFailures) {
      return result;
    }

    if (this.maxAttempts <= 0) {
      result.repairStatus = "FAILED";
      return result;
    }

    result.attempts = 1;

    const nextActions = actions.map((action) => cloneAction(action));
    const bySourceLine = new Map();
    for (let index = 0; index < nextActions.length; index += 1) {
      bySourceLine.set(Number(nextActions[index].sourceLine), index);
    }

    for (const failed of locatorValidation.results.filter((x) => x.severity === "FAIL")) {
      const sourceLine = Number(failed.sourceLine);
      const actionIndex = bySourceLine.get(sourceLine);
      const action = actionIndex === undefined ? null : nextActions[actionIndex];
      const domAction = this.domByLine.get(sourceLine) || null;
      const stableAttributes = buildStableAttributes(domAction);
      const targetTag = domAction && domAction.target ? String(domAction.target.tagName || "") : "";
      const failedRuleIds = failed.rules.filter((rule) => rule.status === "FAIL").map((rule) => rule.ruleId);
      const originalLocator = action ? getLocatorText(action) : String(failed.locator || "");

      const minimalContext = {
        originalLocator,
        failedRuleIds,
        stableAttributes,
        targetTag,
        suggestedLocator: failed.suggestedLocator || ""
      };

      let repairedLocator = "";
      let provider = "deterministic";

      if (typeof this.options.repairProvider === "function") {
        const candidate = this.options.repairProvider(minimalContext);
        if (typeof candidate === "string") {
          repairedLocator = candidate.trim();
          provider = "provider";
        }
      }

      if (!repairedLocator && minimalContext.suggestedLocator) {
        repairedLocator = minimalContext.suggestedLocator;
      }

      if (!repairedLocator && stableAttributes.length > 0) {
        repairedLocator = buildSuggestedLocator(targetTag || "*", stableAttributes);
      }

      if (!repairedLocator) {
        result.items.push({
          sourceLine,
          originalLocator,
          repairedLocator: "",
          attempts: 1,
          repairStatus: "FAILED",
          reason: "No stable replacement candidate could be produced from minimal context.",
          failedRuleIds,
          stableAttributes,
          targetTag,
          suggestedLocator: minimalContext.suggestedLocator || "",
          provider,
          codeGenerationBlocked: true
        });
        continue;
      }

      if (action) {
        nextActions[actionIndex] = applyRepairedLocator(action, repairedLocator);
      }

      result.repairedAny = true;
      result.items.push({
        sourceLine,
        originalLocator,
        repairedLocator,
        attempts: 1,
        repairStatus: "PROPOSED",
        failedRuleIds,
        stableAttributes,
        targetTag,
        suggestedLocator: minimalContext.suggestedLocator || "",
        provider,
        codeGenerationBlocked: false
      });
    }

    result.actions = nextActions;
    result.repairStatus = result.repairedAny ? "PROPOSED" : "FAILED";
    return result;
  }

  finalizeRepairResult(repairResult, finalValidation) {
    const hasFailures = Boolean(finalValidation && finalValidation.hasFailures);
    const status = hasFailures ? "FAILED" : "PASS";

    return {
      ...repairResult,
      repairStatus: status,
      codeGenerationBlocked: hasFailures,
      items: repairResult.items.map((item) => ({
        ...item,
        repairStatus: item.repairedLocator ? status : item.repairStatus,
        codeGenerationBlocked: hasFailures || item.repairStatus === "FAILED"
      })),
      validation: {
        severity: finalValidation ? finalValidation.severity : "FAIL",
        failedLocators: finalValidation ? finalValidation.failedLocators : 0,
        warningLocators: finalValidation ? finalValidation.warningLocators : 0
      }
    };
  }
}

module.exports = {
  LocatorRepair
};
