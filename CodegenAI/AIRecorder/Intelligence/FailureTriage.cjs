const fs = require("fs");

const Category = {
  NONE: "NONE",
  LOCATOR_VALIDATION: "LOCATOR_VALIDATION",
  LOCATOR_REPAIR_FAILED: "LOCATOR_REPAIR_FAILED",
  DOM_EVIDENCE_MISSING: "DOM_EVIDENCE_MISSING",
  GENERATION_ERROR: "GENERATION_ERROR",
  INPUT_ERROR: "INPUT_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
  UNKNOWN: "UNKNOWN"
};

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

function safeExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function gatherFailedRuleIds(locatorValidation) {
  if (!locatorValidation || !Array.isArray(locatorValidation.results)) {
    return [];
  }

  const ruleIds = [];
  for (const item of locatorValidation.results) {
    const rules = Array.isArray(item.rules) ? item.rules : [];
    for (const rule of rules) {
      if (rule && rule.status === "FAIL" && rule.ruleId) {
        ruleIds.push(rule.ruleId);
      }
    }
  }

  return [...new Set(ruleIds)];
}

function hasDomEvidenceMissingSignal(locatorValidation) {
  if (!locatorValidation || !Array.isArray(locatorValidation.results)) {
    return false;
  }

  for (const item of locatorValidation.results) {
    const rules = Array.isArray(item.rules) ? item.rules : [];
    for (const rule of rules) {
      if (!rule || !rule.ruleId) {
        continue;
      }

      if (rule.ruleId === "LV014" && (rule.status === "WARNING" || rule.status === "FAIL")) {
        return true;
      }
    }
  }

  return false;
}

class FailureTriage {
  classifyFailure(context) {
    const input = context || {};
    const validation = input.validation || { success: true, errors: [], warnings: [] };
    const locatorValidation = input.locatorValidation || { hasFailures: false, results: [] };
    const locatorRepair = input.locatorRepair || { attempts: 0, repairStatus: "SKIPPED" };

    const inputError = !input.codeFilePath || !String(input.codeContent || "").trim();
    const configIssue = input.appSettingsPath ? !safeExists(input.appSettingsPath) : false;
    const generationError = input.generationError || null;

    const blocking = Boolean(
      generationError ||
      inputError ||
      (validation && validation.success === false) ||
      (locatorValidation && locatorValidation.hasFailures)
    );

    const failedRuleIds = gatherFailedRuleIds(locatorValidation);

    if (generationError) {
      return {
        status: Status.BLOCKED,
        category: Category.GENERATION_ERROR,
        severity: Severity.HIGH,
        action: "Inspect generator exception and rerun generation.",
        blocking: true,
        source: "CSharpCodeGenerator",
        ruleIds: failedRuleIds
      };
    }

    if (inputError) {
      return {
        status: Status.BLOCKED,
        category: Category.INPUT_ERROR,
        severity: Severity.HIGH,
        action: "Provide valid Code.ts input and rerun generation.",
        blocking: true,
        source: "Input",
        ruleIds: failedRuleIds
      };
    }

    if (locatorRepair.attempts > 0 && String(locatorRepair.repairStatus || "").toUpperCase() === "FAILED" && locatorValidation.hasFailures) {
      return {
        status: Status.BLOCKED,
        category: Category.LOCATOR_REPAIR_FAILED,
        severity: Severity.HIGH,
        action: "Review repaired locator proposals and DOM evidence.",
        blocking: true,
        source: "LocatorValidator",
        ruleIds: failedRuleIds
      };
    }

    if (locatorValidation.hasFailures) {
      if (hasDomEvidenceMissingSignal(locatorValidation)) {
        return {
          status: Status.BLOCKED,
          category: Category.DOM_EVIDENCE_MISSING,
          severity: Severity.HIGH,
          action: "Capture/refresh DOM evidence and rerun generation.",
          blocking: true,
          source: "LiveObserver",
          ruleIds: failedRuleIds
        };
      }

      return {
        status: Status.BLOCKED,
        category: Category.LOCATOR_VALIDATION,
        severity: Severity.HIGH,
        action: "Fix locator rule violations and rerun generation.",
        blocking: true,
        source: "LocatorValidator",
        ruleIds: failedRuleIds
      };
    }

    if (configIssue) {
      return {
        status: Status.WARNING,
        category: Category.CONFIG_ERROR,
        severity: Severity.MEDIUM,
        action: "Validate configuration paths and values.",
        blocking: false,
        source: "Configuration",
        ruleIds: failedRuleIds
      };
    }

    if (Array.isArray(validation.warnings) && validation.warnings.length > 0) {
      return {
        status: Status.WARNING,
        category: Category.UNKNOWN,
        severity: Severity.MEDIUM,
        action: "Review generation warnings before execution.",
        blocking: false,
        source: "CSharpCodeGenerator",
        ruleIds: failedRuleIds
      };
    }

    return {
      status: Status.PASS,
      category: Category.NONE,
      severity: Severity.LOW,
      action: "No action required.",
      blocking,
      source: "GenerationPipeline",
      ruleIds: failedRuleIds
    };
  }
}

module.exports = {
  FailureTriage,
  Category,
  Status,
  Severity
};
