const fs = require("fs");

const RuleStatus = {
  PASS: "PASS",
  WARNING: "WARNING",
  FAIL: "FAIL"
};

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

function getActionLocatorText(locator) {
  if (!locator) {
    return "";
  }

  if (locator.kind === "locator" || locator.kind === "frameLocator") {
    return String(locator.selector || "");
  }

  if (locator.kind === "expression") {
    return String(locator.expression || "");
  }

  if (locator.kind === "role" || locator.kind === "scopedRole" || locator.kind === "frameRole" || locator.kind === "frameScopedRole") {
    return String(locator.name || "");
  }

  if (locator.kind === "text" || locator.kind === "scopedText" || locator.kind === "frameText" || locator.kind === "frameScopedText" || locator.kind === "label" || locator.kind === "placeholder" || locator.kind === "title" || locator.kind === "testid" || locator.kind === "altText") {
    return String(locator.text || "");
  }

  return "";
}

function isXpathSelector(locator) {
  if (!locator) {
    return false;
  }

  const selector = String(locator.selector || "").trim();
  return selector.startsWith("/") || selector.startsWith("./") || selector.startsWith("(");
}

function normalizeAttributeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isDynamicId(idValue) {
  const id = String(idValue || "").trim();
  if (!id) {
    return false;
  }

  return /__\d+$/.test(id) || /(^|[_-])(row|cell|ctl|item)\d+([_-]|$)/i.test(id) || /\d{6,}/.test(id);
}

function extractQuotedLiterals(text) {
  const source = String(text || "");
  const values = [];
  const regex = /['\"]([^'\"]+)['\"]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    values.push(match[1]);
  }

  return values;
}

function hasTextBasedXpath(selector) {
  const text = String(selector || "").toLowerCase();
  return text.includes("text()") || text.includes("contains(text") || text.includes("normalize-space(") || text.includes("contains(.,");
}

function hasAbsoluteXpath(selector) {
  const value = String(selector || "").trim();
  return /^\/html\//i.test(value) || /^\/body\//i.test(value);
}

function hasPositionalXpath(selector) {
  const value = String(selector || "");
  return /\[\d+\]/.test(value);
}

function hasScopedStructuralPosition(selector) {
  const value = String(selector || "");
  const hasStableParent = /\[@id=|\[@data-|\[@name=|\[@aria-|\[@role=/.test(value);
  const hasPosition = /\[\d+\]/.test(value);
  return hasStableParent && hasPosition;
}

function buildScore(ruleResults) {
  let score = 100;
  for (const rule of ruleResults) {
    if (rule.status === RuleStatus.FAIL) {
      score -= 20;
    } else if (rule.status === RuleStatus.WARNING) {
      score -= 8;
    }
  }

  if (score < 0) {
    return 0;
  }

  return score;
}

function finalSeverity(ruleResults) {
  if (ruleResults.some((r) => r.status === RuleStatus.FAIL)) {
    return RuleStatus.FAIL;
  }

  if (ruleResults.some((r) => r.status === RuleStatus.WARNING)) {
    return RuleStatus.WARNING;
  }

  return RuleStatus.PASS;
}

function collectStableAttributes(domAction) {
  const attrs = [];
  if (!domAction || !domAction.target) {
    return attrs;
  }

  const target = domAction.target;
  if (target.id) attrs.push({ name: "id", value: String(target.id) });
  if (target.testId) attrs.push({ name: "data-testid", value: String(target.testId) });
  if (target.name) attrs.push({ name: "name", value: String(target.name) });
  if (target.ariaLabel) attrs.push({ name: "aria-label", value: String(target.ariaLabel) });

  const rawAttributes = target.attributes;
  if (rawAttributes && typeof rawAttributes === "object") {
    for (const [name, value] of Object.entries(rawAttributes)) {
      if (typeof value === "string" && value.trim().length > 0) {
        attrs.push({ name, value });
      }
    }
  }

  return attrs;
}

function preferAttributeLocatorSuggestion(domAction) {
  if (!domAction || !domAction.target) {
    return "";
  }

  const target = domAction.target;
  const tag = String(target.tagName || "*").toLowerCase() || "*";
  const attrs = collectStableAttributes(domAction);

  const preferredOrder = ["id", "data-testid", "name", "aria-label"];
  for (const attributeName of preferredOrder) {
    const match = attrs.find((item) => normalizeAttributeName(item.name) === attributeName && item.value.trim().length > 0);
    if (!match) {
      continue;
    }

    return `//${tag}[@${match.name}='${String(match.value).replace(/'/g, "''")}']`;
  }

  const stableDataAttribute = attrs.find((item) => {
    const name = normalizeAttributeName(item.name);
    return name.startsWith("data-") && name !== "data-testid" && String(item.value || "").trim().length > 0;
  });

  if (stableDataAttribute) {
    return `//${tag}[@${stableDataAttribute.name}='${String(stableDataAttribute.value).replace(/'/g, "''")}']`;
  }

  return "";
}

class LocatorValidator {
  constructor(options = {}) {
    this.options = options;
    this.domObservations = safeReadJson(options.domObservationPath || "");
    this.tableMetadata = safeReadJson(options.tableMetadataPath || "");
    this.liveByLine = new Map();

    const liveActions = Array.isArray(this.domObservations.actions) ? this.domObservations.actions : [];
    for (const action of liveActions) {
      if (Number.isFinite(Number(action.line))) {
        this.liveByLine.set(Number(action.line), action);
      }
    }

    this.tableByLine = new Map();
    const tableActions = Array.isArray(this.tableMetadata.actions) ? this.tableMetadata.actions : [];
    for (const action of tableActions) {
      if (Number.isFinite(Number(action.line))) {
        this.tableByLine.set(Number(action.line), action);
      }
    }
  }

  validateActions(actions) {
    // Old observer versions silently omitted fill/press/selectOption (and other
    // actions). A downstream zero count from that different application state
    // is not proof of a bad locator. Preserve the evidence, but mark it unverified.
    const observed = [...this.liveByLine.values()];
    const isReplay = this.domObservations.replayVersion >= 2 || observed.some((item) => typeof item.raw === "string");
    let firstUntrustedLine = Infinity;
    const gaps = [];
    if (isReplay) {
      for (const action of actions) {
        const line = Number(action.sourceLine);
        const evidence = this.liveByLine.get(line);
        if (!evidence || evidence.observationStatus === "unverified" || evidence.executionStatus === "skipped") {
          firstUntrustedLine = Math.min(firstUntrustedLine, line);
          gaps.push({ sourceLine: line, reason: evidence?.error || "Recorded action was not replayed by the observer." });
        } else if (evidence.executionStatus === "failed" || evidence.error) {
          firstUntrustedLine = Math.min(firstUntrustedLine, line + 1);
          gaps.push({ sourceLine: line, reason: "Observer replay failed; later application state is unverified." });
        }
      }
    }
    this.firstUntrustedLine = firstUntrustedLine;
    const observationCoverage = {
      status: observed.length === 0 ? "UNAVAILABLE" : gaps.length ? "INCOMPLETE" : "AVAILABLE",
      firstUntrustedLine: Number.isFinite(firstUntrustedLine) ? firstUntrustedLine : null,
      gaps,
      unverifiedSourceLines: actions.filter((action) => action.locator && action.sourceLine >= firstUntrustedLine).map((action) => action.sourceLine)
    };
    const dataAnchors = new Set();
    for (const action of actions) {
      if (["fill", "selectOption", "press"].includes(action.actionType) && typeof action.value === "string" && action.value.trim().length > 0) {
        dataAnchors.add(action.value.trim());
      }
    }

    const results = [];
    const validatedSourceLines = [];
    const uniqueLocatorSet = new Set();
    for (const action of actions) {
      if (!action.locator) {
        continue;
      }

      const validationResult = this.validateSingleLocator(action, dataAnchors);
      results.push(validationResult);
      validatedSourceLines.push(Number(action.sourceLine));
      uniqueLocatorSet.add(`${action.locator.kind || "unknown"}:${validationResult.locator}`);
    }

    const hasFailures = results.some((x) => x.severity === RuleStatus.FAIL);
    return {
      severity: hasFailures ? RuleStatus.FAIL : results.some((x) => x.severity === RuleStatus.WARNING) ? RuleStatus.WARNING : RuleStatus.PASS,
      hasFailures,
      totalLocators: results.length,
      totalLocatorActions: results.length,
      uniqueLocatorActions: uniqueLocatorSet.size,
      failedLocators: results.filter((x) => x.severity === RuleStatus.FAIL).length,
      warningLocators: results.filter((x) => x.severity === RuleStatus.WARNING).length,
      validatedSourceLines,
      observationCoverage,
      results
    };
  }

  validateSingleLocator(action, dataAnchors) {
    const locatorText = getActionLocatorText(action.locator);
    const ruleResults = [];
    const unverified = Number(action.sourceLine) >= (this.firstUntrustedLine ?? Infinity);
    const domAction = unverified ? null : this.liveByLine.get(Number(action.sourceLine));
    const tableAction = unverified ? null : this.tableByLine.get(Number(action.sourceLine));
    const stableAttributes = collectStableAttributes(domAction);

    ruleResults.push(this.validateNotEmpty(locatorText));

    if (action.locator.kind === "locator" || action.locator.kind === "frameLocator") {
      ruleResults.push(this.validateAbsoluteXpath(action.locator.selector));
      ruleResults.push(this.validatePositionalXpath(action.locator.selector, tableAction));
      ruleResults.push(this.validateTextXpathAgainstStableAttributes(action.locator.selector, stableAttributes));
      ruleResults.push(this.validateInventedAttributes(action.locator.selector, stableAttributes));
      ruleResults.push(this.validateTagWildcard(action.locator.selector));
    }

    ruleResults.push(this.validateTextLocatorWhenStableAttributeExists(action, stableAttributes));
    ruleResults.push(this.validateTestDataAnchor(locatorText, dataAnchors));
    ruleResults.push(this.validateDynamicIdUsage(action));
    ruleResults.push(this.validateGeneratedClassUsage(action));
    ruleResults.push(this.validateDomUniqueness(action, domAction));
    ruleResults.push(this.validateTargetType(action, domAction));
    ruleResults.push(this.validateDomPresence(action, domAction));
    if (unverified) {
      ruleResults.push({ ruleId: "LV015", status: RuleStatus.WARNING,
        message: "Incomplete observer replay: downstream DOM evidence ignored. Locator requires runtime verification after a complete replay." });
    }

    const cleanedRules = ruleResults.filter(Boolean);
    return {
      locator: locatorText,
      sourceLine: action.sourceLine,
      severity: finalSeverity(cleanedRules),
      score: buildScore(cleanedRules),
      rules: cleanedRules,
      suggestedLocator: preferAttributeLocatorSuggestion(domAction) || undefined
    };
  }

  validateNotEmpty(locator) {
    if (!String(locator || "").trim()) {
      return {
        ruleId: "LV001",
        status: RuleStatus.FAIL,
        message: "Locator is empty."
      };
    }

    return {
      ruleId: "LV001",
      status: RuleStatus.PASS,
      message: "Locator is not empty."
    };
  }

  validateAbsoluteXpath(selector) {
    if (!selector || !isXpathSelector({ selector })) {
      return {
        ruleId: "LV002",
        status: RuleStatus.PASS,
        message: "Locator is not an absolute XPath."
      };
    }

    if (hasAbsoluteXpath(selector)) {
      return {
        ruleId: "LV002",
        status: RuleStatus.FAIL,
        message: "Absolute XPath is not allowed."
      };
    }

    return {
      ruleId: "LV002",
      status: RuleStatus.PASS,
      message: "XPath is relative."
    };
  }

  validatePositionalXpath(selector, tableAction) {
    if (!selector || !isXpathSelector({ selector })) {
      return {
        ruleId: "LV003",
        status: RuleStatus.PASS,
        message: "No positional XPath detected."
      };
    }

    if (!hasPositionalXpath(selector)) {
      return {
        ruleId: "LV003",
        status: RuleStatus.PASS,
        message: "No positional XPath detected."
      };
    }

    const hasStructuralOverride = tableAction && /structural|required/i.test(String(tableAction.reason || ""));
    if (hasStructuralOverride || hasScopedStructuralPosition(selector)) {
      return {
        ruleId: "LV003",
        status: RuleStatus.WARNING,
        message: "Positional XPath detected but appears structurally scoped. Verify stability."
      };
    }

    return {
      ruleId: "LV003",
      status: RuleStatus.FAIL,
      message: "Unconstrained positional XPath is not allowed."
    };
  }

  validateTextXpathAgainstStableAttributes(selector, stableAttributes) {
    if (!selector || !isXpathSelector({ selector })) {
      return {
        ruleId: "LV004",
        status: RuleStatus.PASS,
        message: "Not a text-based XPath."
      };
    }

    const textBased = hasTextBasedXpath(selector);
    if (!textBased) {
      return {
        ruleId: "LV004",
        status: RuleStatus.PASS,
        message: "No text-based XPath predicate detected."
      };
    }

    if (stableAttributes.length > 0) {
      return {
        ruleId: "LV004",
        status: RuleStatus.FAIL,
        message: "Text-based XPath used while stable attribute-based alternatives exist in observed DOM."
      };
    }

    return {
      ruleId: "LV004",
      status: RuleStatus.WARNING,
      message: "Text-based XPath used and no stable attributes were observed to auto-repair."
    };
  }

  validateTextLocatorWhenStableAttributeExists(action, stableAttributes) {
    const textKinds = new Set(["text", "scopedText", "frameText", "frameScopedText"]);
    if (!action || !action.locator || !textKinds.has(action.locator.kind)) {
      return {
        ruleId: "LV005",
        status: RuleStatus.PASS,
        message: "Primary locator is not text-only."
      };
    }

    if (stableAttributes.length > 0) {
      return {
        ruleId: "LV005",
        status: RuleStatus.FAIL,
        message: "Text locator used while stable DOM attributes were observed."
      };
    }

    return {
      ruleId: "LV005",
      status: RuleStatus.WARNING,
      message: "Text locator used as fallback because no stable attributes were observed."
    };
  }

  validateTestDataAnchor(locatorText, dataAnchors) {
    const text = String(locatorText || "").trim();
    if (!text) {
      return {
        ruleId: "LV006",
        status: RuleStatus.PASS,
        message: "No test-data anchor detected."
      };
    }

    const quotedValues = extractQuotedLiterals(text);
    const matched = quotedValues.find((item) => dataAnchors.has(String(item).trim()));
    if (matched) {
      return {
        ruleId: "LV006",
        status: RuleStatus.FAIL,
        message: `Locator appears anchored to recorded test data value '${matched}'.`
      };
    }

    return {
      ruleId: "LV006",
      status: RuleStatus.PASS,
      message: "No test-data anchor detected."
    };
  }

  validateInventedAttributes(selector, stableAttributes) {
    if (!selector || !isXpathSelector({ selector })) {
      return {
        ruleId: "LV007",
        status: RuleStatus.PASS,
        message: "No invented attribute usage detected."
      };
    }

    const attrRegex = /@([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=/g;
    const usedAttributes = new Set();
    let match;
    while ((match = attrRegex.exec(selector)) !== null) {
      usedAttributes.add(normalizeAttributeName(match[1]));
    }

    const domAttributes = new Set(stableAttributes.map((x) => normalizeAttributeName(x.name)));
    for (const attributeName of usedAttributes) {
      if (!attributeName.startsWith("data-") && !attributeName.startsWith("aria-") && attributeName !== "id" && attributeName !== "name" && attributeName !== "class" && attributeName !== "type" && attributeName !== "role") {
        continue;
      }

      if (domAttributes.size > 0 && !domAttributes.has(attributeName) && (attributeName === "data-testid" || attributeName === "automation-id" || attributeName === "unique-id")) {
        return {
          ruleId: "LV007",
          status: RuleStatus.FAIL,
          message: `Locator uses attribute '${attributeName}' that is not present in observed DOM for target element.`
        };
      }
    }

    return {
      ruleId: "LV007",
      status: RuleStatus.PASS,
      message: "No invented attribute usage detected."
    };
  }

  validateDynamicIdUsage(action) {
    if (!action || !action.locator) {
      return {
        ruleId: "LV008",
        status: RuleStatus.PASS,
        message: "No dynamic id risk detected."
      };
    }

    let idValue = "";
    if (action.locator.kind === "locator" || action.locator.kind === "frameLocator") {
      const selector = String(action.locator.selector || "");
      const idMatch = selector.match(/@id\s*=\s*['\"]([^'\"]+)['\"]/i) || selector.match(/#([A-Za-z0-9_:-]+)/);
      idValue = idMatch ? idMatch[1] : "";
    }

    if (!idValue) {
      return {
        ruleId: "LV008",
        status: RuleStatus.PASS,
        message: "No id segment detected in locator."
      };
    }

    if (isDynamicId(idValue)) {
      return {
        ruleId: "LV008",
        status: RuleStatus.WARNING,
        message: `Locator uses potentially dynamic id '${idValue}'. Prefer a stable attribute combination if available.`
      };
    }

    return {
      ruleId: "LV008",
      status: RuleStatus.PASS,
      message: "Id pattern appears stable."
    };
  }

  validateGeneratedClassUsage(action) {
    if (!action || !action.locator || (action.locator.kind !== "locator" && action.locator.kind !== "frameLocator")) {
      return {
        ruleId: "LV009",
        status: RuleStatus.PASS,
        message: "No class stability risk detected."
      };
    }

    const selector = String(action.locator.selector || "");
    const classMatch = selector.match(/@class\s*=\s*['\"]([^'\"]+)['\"]/i);
    if (!classMatch) {
      return {
        ruleId: "LV009",
        status: RuleStatus.PASS,
        message: "No class stability risk detected."
      };
    }

    const classValue = classMatch[1];
    if (/\b(css|jsx|ng|Mui)[-_]?[a-z0-9]{4,}\b/i.test(classValue)) {
      return {
        ruleId: "LV009",
        status: RuleStatus.WARNING,
        message: "Locator depends on potentially generated class token(s)."
      };
    }

    return {
      ruleId: "LV009",
      status: RuleStatus.PASS,
      message: "Class value does not look framework-generated."
    };
  }

  validateTagWildcard(selector) {
    if (!selector || !isXpathSelector({ selector })) {
      return {
        ruleId: "LV010",
        status: RuleStatus.PASS,
        message: "Tag specificity is acceptable."
      };
    }

    if (/^\/\/\*/.test(String(selector).trim())) {
      return {
        ruleId: "LV010",
        status: RuleStatus.WARNING,
        message: "Wildcard tag used in XPath. Prefer concrete tag when known."
      };
    }

    return {
      ruleId: "LV010",
      status: RuleStatus.PASS,
      message: "Tag specificity is acceptable."
    };
  }

  validateDomUniqueness(action, domAction) {
    if (!domAction || !Number.isFinite(Number(domAction.matchCount))) {
      return {
        ruleId: "LV012",
        status: RuleStatus.WARNING,
        message: "No runtime match count available; uniqueness not verified."
      };
    }

    const count = Number(domAction.matchCount);
    if (count === 1) {
      return {
        ruleId: "LV012",
        status: RuleStatus.PASS,
        message: "Locator uniquely identifies one element."
      };
    }

    if (count === 0) {
      return {
        ruleId: "LV012",
        status: RuleStatus.FAIL,
        message: "Locator does not match any element in observed DOM."
      };
    }

    return {
      ruleId: "LV012",
      status: RuleStatus.FAIL,
      message: `Locator matches ${count} elements in observed DOM.`
    };
  }

  validateTargetType(action, domAction) {
    if (!domAction || !domAction.target || !domAction.target.tagName || !action || !action.targetElement) {
      return {
        ruleId: "LV013",
        status: RuleStatus.WARNING,
        message: "Target element type could not be verified."
      };
    }

    const target = domAction.target;
    const expected = String((action.locator && action.locator.role) || action.targetElement || "").toLowerCase();
    const actual = String(target.tagName || "").toLowerCase();
    const attribute = (name) => Object.prototype.hasOwnProperty.call(target, name)
      ? target[name]
      : (target.attributes && Object.prototype.hasOwnProperty.call(target.attributes, name) ? target.attributes[name] : undefined);
    const explicitRole = String(attribute("role") || "").trim().toLowerCase().split(/\s+/)[0];
    let observedRole = explicitRole;
    let incompleteEvidence = false;
    if (!observedRole) {
      const roles = {
        button: "button", textarea: "textbox", option: "option", optgroup: "group",
        table: "table", tr: "row", td: "cell", thead: "rowgroup", tbody: "rowgroup", tfoot: "rowgroup",
        ul: "list", ol: "list", li: "listitem", h1: "heading", h2: "heading", h3: "heading",
        h4: "heading", h5: "heading", h6: "heading", progress: "progressbar", meter: "meter",
        nav: "navigation", main: "main", aside: "complementary", dialog: "dialog", article: "article"
      };
      observedRole = roles[actual] || "generic";
      if (actual === "a" || actual === "area") {
        incompleteEvidence = attribute("href") === undefined;
        observedRole = attribute("href") != null ? "link" : "generic";
      } else if (actual === "input") {
        incompleteEvidence = attribute("type") === undefined;
        const type = String(attribute("type") || "text").toLowerCase();
        const inputRoles = { checkbox: "checkbox", radio: "radio", button: "button", submit: "button", reset: "button", image: "button", range: "slider", number: "spinbutton", search: "searchbox", text: "textbox", email: "textbox", tel: "textbox", url: "textbox" };
        observedRole = inputRoles[type] || "generic";
        if (["text", "email", "tel", "url", "search"].includes(type) && attribute("list")) observedRole = "combobox";
      } else if (actual === "select") {
        incompleteEvidence = attribute("multiple") === undefined || attribute("size") === undefined;
        const multiple = attribute("multiple");
        observedRole = (multiple != null && multiple !== false) || Number(attribute("size")) > 1 ? "listbox" : "combobox";
      } else if (actual === "th") {
        incompleteEvidence = attribute("scope") === undefined;
        observedRole = ["row", "rowgroup"].includes(attribute("scope")) ? "rowheader" : "columnheader";
      } else if (actual === "img") {
        observedRole = attribute("alt") === "" ? "presentation" : "img";
      }
    }

    // Older observation files omitted href/type/etc. Do not invent evidence or
    // block otherwise valid recordings; require fresh observations for certainty.
    const isRoleLocator = Boolean(action.locator && action.locator.role);
    const possibleRoles = {
      a: ["link", "generic"], area: ["link", "generic"],
      input: ["checkbox", "radio", "button", "slider", "spinbutton", "searchbox", "textbox", "combobox", "generic"],
      select: ["listbox", "combobox"], th: ["rowheader", "columnheader"]
    };
    if (incompleteEvidence && (possibleRoles[actual] || []).includes(expected) && (isRoleLocator || expected !== actual)) {
      return { ruleId: "LV013", status: RuleStatus.WARNING, message: `Insufficient attributes to verify implicit role '${expected}' on '${actual}'.` };
    }
    const compatible = isRoleLocator
      ? expected === observedRole
      : expected === actual || expected === observedRole || expected === "text" || expected === "locator";
    if (!compatible) {
      return {
        ruleId: "LV013",
        status: RuleStatus.FAIL,
        message: `Expected target '${expected}' but observed '${actual}'.`
      };
    }

    return {
      ruleId: "LV013",
      status: RuleStatus.PASS,
      message: "Target element type matches observed DOM element."
    };
  }

  validateDomPresence(action, domAction) {
    if (!domAction) {
      return {
        ruleId: "LV014",
        status: RuleStatus.WARNING,
        message: `No observed DOM record found for source line ${action.sourceLine}.`
      };
    }

    return {
      ruleId: "LV014",
      status: RuleStatus.PASS,
      message: "Locator evaluated against captured DOM observation."
    };
  }
}

module.exports = {
  LocatorValidator,
  RuleStatus
};
