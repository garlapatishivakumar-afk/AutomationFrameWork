const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const [key, value] = token.split("=");
    const name = key.slice(2);
    if (value !== undefined) {
      args[name] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[name] = next;
      i++;
    } else {
      args[name] = "true";
    }
  }

  return args;
}

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function safeReadJson(filePath) {
  try {
    const text = safeRead(filePath).trim();
    if (!text) {
      return {};
    }

    return JSON.parse(text);
  } catch {
    return {};
  }
}

function log(enabled, message) {
  if (!enabled) {
    return;
  }

  console.log(`[TableLocator] ${message}`);
}

function escapeXPathLiteral(value) {
  return String(value || "").replace(/'/g, "''");
}

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function isIdAnchoredTableLocator(originalLocator) {
  const source = String(originalLocator || "");
  return (
    /#[-\w:.]+/.test(source) ||
    /\[@id\s*=/.test(source) ||
    /\[id\s*=/.test(source) ||
    /\/\/tr\[@id=/.test(source)
  );
}

function isDynamicId(value) {
  if (!value) {
    return false;
  }

  const id = String(value).trim();
  return (
    /(^|[_-])ctl\d+([_-]|$)/i.test(id) ||
    /__\d+$/.test(id) ||
    /(?:^|\W)nth\s*\(\s*\d+\s*\)/i.test(id) ||
    /position\s*\(\)\s*=\s*\d+/i.test(id) ||
    /:[a-z-]*nth-(?:child|of-type)\(\d+\)/i.test(id) ||
    /(^|[_-])(row|cell|item|ctl)\d{1,4}([_-]|$)/i.test(id)
  );
}

function isKnownStableGridLinkId(value) {
  return /^g_ctl\d+_hE_\d+$/i.test(String(value || "").trim());
}

function isNumericLike(value) {
  return /^\d{3,}$/.test(String(value || "").trim());
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function normalizeClassValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isStableClassValue(value) {
  const normalized = normalizeClassValue(value);
  if (!normalized) {
    return false;
  }

  const tokens = normalized.split(" ");
  if (!tokens.length) {
    return false;
  }

  const genericTokens = new Set([
    "rgrow",
    "rgaltrow",
    "rgselectedrow",
    "rgmastertable",
    "rgclipcells",
    "k-master-row",
    "k-grid",
    "k-table-td",
    "selected",
    "active"
  ]);

  const nonGeneric = tokens.filter((item) => !genericTokens.has(normalize(item)));
  return nonGeneric.length > 0;
}

function strategyDependsOnTargetText(strategy) {
  return strategy === "DATA_ATTRIBUTE" || strategy === "COMPOSITE" || strategy === "TABLE_CELL";
}

function stripRelativePrefix(xpathSegment) {
  return String(xpathSegment || "")
    .replace(/^\.\//, "")
    .replace(/^\//, "");
}

function safeRegex(value) {
  return new RegExp(value, "i");
}

function defaultSpecificRulesFilePath() {
  return path.join(__dirname, "SpecificLocatorRules.json");
}

function loadSpecificLocatorRules(filePath) {
  const resolvedPath = filePath || defaultSpecificRulesFilePath();
  const parsed = safeReadJson(resolvedPath);
  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];

  return {
    enabled: parsed.enabled !== false,
    rules,
    filePath: resolvedPath
  };
}

function matchesSpecificRule(rule, context) {
  if (!rule || rule.enabled === false) {
    return false;
  }

  const match = rule.match || {};
  const actionKind = normalize(context.action.kind);
  const actionText = normalize(context.action.text);
  const originalLocator = String(context.action.originalLocator || "");

  const onlyNonTable = match.onlyNonTable !== false;
  if (onlyNonTable && context.insideTable) {
    return false;
  }

  if (hasValue(match.kind) && normalize(match.kind) !== actionKind) {
    return false;
  }

  if (Array.isArray(match.kinds) && match.kinds.length > 0) {
    const allowedKinds = match.kinds.map((item) => normalize(item));
    if (!allowedKinds.includes(actionKind)) {
      return false;
    }
  }

  if (hasValue(match.textEquals) && normalize(match.textEquals) !== actionText) {
    return false;
  }

  if (hasValue(match.originalLocatorContains) && !originalLocator.includes(String(match.originalLocatorContains))) {
    return false;
  }

  if (hasValue(match.originalLocatorRegex)) {
    try {
      const regex = new RegExp(String(match.originalLocatorRegex));
      if (!regex.test(originalLocator)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function buildSpecificAttributeLocatorCandidate(context, rule) {
  const targetTag = resolveTargetTag(context) || normalize(context.target.tagName) || "*";
  const counts = context.target.attributeCounts || {};
  const allowedAttributes =
    Array.isArray(rule.allowedAttributes) && rule.allowedAttributes.length > 0
      ? rule.allowedAttributes
      : ["data-testid", "id", "aria-label"];

  const candidates = {
    "data-testid": {
      value: context.target.testId,
      count: Number(counts.testId || 0),
      xpathAttribute: "data-testid"
    },
    id: {
      value: context.target.id,
      count: Number(counts.id || 0),
      xpathAttribute: "id"
    },
    "aria-label": {
      value: context.target.ariaLabel,
      count: Number(counts.ariaLabel || 0),
      xpathAttribute: "aria-label"
    },
    name: {
      value: context.target.name,
      count: Number(counts.name || 0),
      xpathAttribute: "name"
    },
    title: {
      value: context.target.title,
      count: Number(counts.title || 0),
      xpathAttribute: "title"
    },
    "data-qa": {
      value: context.target.dataQa,
      count: Number(counts.dataQa || 0),
      xpathAttribute: "data-qa"
    },
    "data-test": {
      value: context.target.dataTest,
      count: Number(counts.dataTest || 0),
      xpathAttribute: "data-test"
    }
  };

  for (const item of allowedAttributes) {
    const key = normalize(item);
    const candidate = candidates[key];
    if (!candidate || !hasValue(candidate.value)) {
      continue;
    }

    if (key === "id" && isDynamicId(candidate.value) && rule.allowDynamicId !== true) {
      continue;
    }

    if (candidate.count !== 1) {
      continue;
    }

    return {
      strategy: "SPECIFIC_ATTRIBUTE_RULE",
      locator: `//${targetTag}[@${candidate.xpathAttribute}='${escapeXPathLiteral(candidate.value)}']`,
      score: 30,
      reasonParts: [
        `Specific rule: ${rule.id || "custom-rule"}`,
        `Unique ${candidate.xpathAttribute} for tag ${targetTag}`
      ],
      method: context.action.method,
      rewrite: true,
      validation: {
        valid: true,
        unique: true,
        matchEstimate: 1,
        reason: `Unique ${candidate.xpathAttribute} confirmed from live DOM`
      }
    };
  }

  return null;
}

function findSpecificLocatorCandidate(context, specificRules) {
  if (!specificRules || !specificRules.enabled || !Array.isArray(specificRules.rules) || !specificRules.rules.length) {
    return null;
  }

  for (const rule of specificRules.rules) {
    if (!matchesSpecificRule(rule, context)) {
      continue;
    }

    const candidate = buildSpecificAttributeLocatorCandidate(context, rule);
    if (candidate) {
      return candidate;
    }

    return {
      strategy: "SPECIFIC_ATTRIBUTE_RULE_SKIPPED",
      locator: context.action.originalLocator,
      score: 0,
      reasonParts: [
        `Specific rule matched: ${rule.id || "custom-rule"}`,
        "No unique allowed attribute found"
      ],
      method: context.action.method,
      rewrite: false
    };
  }

  return null;
}

function isDataGridContext(context) {
  const tableId = String(context.table.id || "");
  const tableClass = String(context.table.className || "");
  const rowClass = String(context.row.className || "");
  const rowId = String(context.row.id || "");

  const strongGridSignal =
    safeRegex("grid|rgtransactions|rgmastertable|k-grid|datagrid|results|gridview").test(tableId) ||
    safeRegex("grid|rgmastertable|rgclipcells|k-grid|datagrid|results|gridview").test(tableClass) ||
    safeRegex("rgrow|rgaltrow|k-master-row|grid-row|gridviewscrollitem").test(rowClass) ||
    safeRegex("rgtransactions|grid").test(rowId);

  const controlTableSignal =
    safeRegex("titlebar|toolbar|controls|menu").test(tableClass) ||
    safeRegex("titlebar|toolbar|controls|menu").test(tableId);

  return strongGridSignal && !controlTableSignal;
}

function isKeyValueTableContext(context) {
  const rowValues = Array.isArray(context.row.rowValues) ? context.row.rowValues : [];
  const labelValue = String(context.row.labelValue || rowValues[0] || "").trim();
  if (rowValues.length < 2 || rowValues.length > 3) {
    return false;
  }

  return /:$/.test(labelValue);
}

function resolveTargetTag(context) {
  if (hasValue(context.target.tagName)) {
    return normalize(context.target.tagName);
  }

  const role = normalize(context.action.role);
  if (role === "cell" || role === "gridcell") {
    return "td";
  }

  if (role === "link") {
    return "a";
  }

  if (role === "button") {
    return "button";
  }

  if (role === "checkbox") {
    return "input";
  }

  if (role === "combobox") {
    return "select";
  }

  return "";
}

function buildAttributeLocator(context) {
  const targetTag = resolveTargetTag(context) || "*";
  const idCount = Number((context.target && context.target.attributeCounts && context.target.attributeCounts.id) || 0);

  // Rule priority for future maintenance:
  // 1) If the resolved target (last tag) has a unique id in observed DOM, prefer it.
  // 2) Otherwise prefer test id and then other validated table-aware strategies.
  // 3) Avoid normalize-space() based locator generation in table strategies.
  if (hasValue(context.target.id) && idCount === 1) {
    return `//${targetTag}[@id='${escapeXPathLiteral(context.target.id)}']`;
  }

  if (hasValue(context.target.testId)) {
    return `//${targetTag}[@data-testid='${escapeXPathLiteral(context.target.testId)}']`;
  }

  if (
    hasValue(context.target.id) &&
    (!isDynamicId(context.target.id) || isKnownStableGridLinkId(context.target.id))
  ) {
    return `//${targetTag}[@id='${escapeXPathLiteral(context.target.id)}']`;
  }

  return "";
}

function isTransformableTarget(context) {
  if (normalize(context.action.kind) === "text") {
    return hasValue(resolveTargetTag(context));
  }

  if (normalize(context.action.kind) === "locator") {
    return hasValue(resolveTargetTag(context));
  }

  const role = normalize(context.action.role);
  const targetTag = resolveTargetTag(context);
  const allowedRoles = new Set([
    "link",
    "cell",
    "gridcell",
    "button",
    "checkbox",
    "combobox",
    "textbox",
    "option",
    "menuitem"
  ]);

  if (!allowedRoles.has(role)) {
    return false;
  }

  return hasValue(targetTag);
}

function buildTargetSelectorForColumn(context, escapedText, columnIndex) {
  const targetTag = resolveTargetTag(context);
  const role = normalize(context.action.role);

  if (targetTag === "td" || targetTag === "th") {
    return `td[${columnIndex}][text()='${escapedText}']`;
  }

  if (targetTag === "a") {
    return `td[${columnIndex}]//a[text()='${escapedText}']`;
  }

  if (targetTag === "button") {
    return `td[${columnIndex}]//*[self::button[text()='${escapedText}'] or self::input[(translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='button' or translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='submit') and (@value='${escapedText}' or @aria-label='${escapedText}')]]`;
  }

  if (targetTag === "input" && role === "checkbox") {
    return `td[${columnIndex}]//input[translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='checkbox']`;
  }

  if (targetTag === "select") {
    return `td[${columnIndex}]//select`;
  }

  if (targetTag === "input") {
    return `td[${columnIndex}]//input[@value='${escapedText}' or @aria-label='${escapedText}' or @name='${escapedText}']`;
  }

  if (targetTag === "span") {
    return `td[${columnIndex}]//span[text()='${escapedText}']`;
  }

  return `td[${columnIndex}]//*[text()='${escapedText}']`;
}

function buildTargetTagSelectorForColumn(context, columnIndex) {
  const targetTag = resolveTargetTag(context);
  const role = normalize(context.action.role);

  if (targetTag === "td" || targetTag === "th") {
    return `td[${columnIndex}]`;
  }

  if (targetTag === "a") {
    return `td[${columnIndex}]/a`;
  }

  if (targetTag === "button") {
    return `td[${columnIndex}]//*[self::button or self::input[(translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='button' or translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='submit')]]`;
  }

  if (targetTag === "input" && role === "checkbox") {
    return `td[${columnIndex}]//input[translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='checkbox']`;
  }

  if (targetTag === "select") {
    return `td[${columnIndex}]//select`;
  }

  if (targetTag === "input") {
    return `td[${columnIndex}]//input`;
  }

  if (targetTag === "span") {
    return `td[${columnIndex}]//span`;
  }

  return `td[${columnIndex}]//*`;
}

function buildTargetSelectorInRow(context, escapedText) {
  const targetTag = resolveTargetTag(context);
  const role = normalize(context.action.role);

  if (targetTag === "td" || targetTag === "th") {
    return `td[text()='${escapedText}']`;
  }

  if (targetTag === "a") {
    return `.//a[text()='${escapedText}']`;
  }

  if (targetTag === "button") {
    return `.//*[self::button[text()='${escapedText}'] or self::input[(translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='button' or translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='submit') and (@value='${escapedText}' or @aria-label='${escapedText}')]]`;
  }

  if (targetTag === "input" && role === "checkbox") {
    return ".//input[translate(@type,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='checkbox']";
  }

  if (targetTag === "select") {
    return ".//select";
  }

  if (targetTag === "input") {
    return `.//input[@value='${escapedText}' or @aria-label='${escapedText}' or @name='${escapedText}']`;
  }

  if (targetTag === "span") {
    return `.//span[text()='${escapedText}']`;
  }

  return `.//*[text()='${escapedText}']`;
}

function buildUniqueTargetAttributeSelectorInRow(context) {
  const targetTag = resolveTargetTag(context) || "*";
  const counts = context.target.attributeCounts || {};
  const candidates = [
    { key: "id", value: context.target.id, count: Number(counts.id || 0) },
    { key: "data-testid", value: context.target.testId, count: Number(counts.testId || 0) },
    { key: "aria-label", value: context.target.ariaLabel, count: Number(counts.ariaLabel || 0) },
    { key: "name", value: context.target.name, count: Number(counts.name || 0) },
    { key: "title", value: context.target.title, count: Number(counts.title || 0) },
    { key: "data-qa", value: context.target.dataQa, count: Number(counts.dataQa || 0) },
    { key: "data-test", value: context.target.dataTest, count: Number(counts.dataTest || 0) }
  ];

  for (const candidate of candidates) {
    if (!hasValue(candidate.value)) {
      continue;
    }

    if (candidate.key === "id" && candidate.count === 1) {
      return {
        selector: `.//${targetTag}[@id='${escapeXPathLiteral(candidate.value)}']`,
        reason: "Unique id"
      };
    }

    if (candidate.key === "id" && isDynamicId(candidate.value) && !isKnownStableGridLinkId(candidate.value)) {
      continue;
    }

    if (candidate.count !== 1) {
      continue;
    }

    return {
      selector: `.//${targetTag}[@${candidate.key}='${escapeXPathLiteral(candidate.value)}']`,
      reason: `Unique ${candidate.key}`
    };
  }

  return null;
}

function buildClassSelectorInRow(context) {
  const targetTag = resolveTargetTag(context) || "*";
  const classValue = normalizeClassValue(context.target.className || context.cell.className || "");
  if (!isStableClassValue(classValue)) {
    return null;
  }

  return {
    selector: `.//${targetTag}[@class='${escapeXPathLiteral(classValue)}']`,
    reason: "Stable class attribute"
  };
}

function buildPreferredTargetSelectorInRow(context, escapedText, columnIndex) {
  const uniqueAttributeSelector = buildUniqueTargetAttributeSelectorInRow(context);
  if (uniqueAttributeSelector) {
    return {
      selector: uniqueAttributeSelector.selector,
      usesText: false,
      usesIndex: false,
      reason: uniqueAttributeSelector.reason
    };
  }

  const classSelector = buildClassSelectorInRow(context);
  if (classSelector) {
    return {
      selector: classSelector.selector,
      usesText: false,
      usesIndex: false,
      reason: classSelector.reason
    };
  }

  if (Number.isFinite(columnIndex) && columnIndex > 0) {
    return {
      selector: buildTargetTagSelectorForColumn(context, columnIndex),
      usesText: false,
      usesIndex: true,
      reason: `Column index fallback (${columnIndex})`
    };
  }

  return {
    selector: buildTargetSelectorInRow(context, escapedText),
    usesText: true,
    usesIndex: false,
    reason: "Text fallback"
  };
}

function buildKeyValueRowCandidate(context, escapedText, method) {
  const rowValues = Array.isArray(context.row.rowValues) ? context.row.rowValues : [];
  const labelValue = context.row.labelValue || rowValues[0] || null;
  if (!hasValue(labelValue)) {
    return null;
  }

  const targetInRow = stripRelativePrefix(buildTargetSelectorInRow(context, escapedText));

  return {
    strategy: "TABLE_KEY_VALUE_ROW",
    locator: `//tr[td[1][text()='${escapeXPathLiteral(labelValue)}']]//${targetInRow}`,
    score: 11,
    reasonParts: ["Key/value row label", "Observed target inside row"],
    method,
    rewrite: true
  };
}

function validateCandidate(candidate, context) {
  const result = {
    valid: false,
    unique: false,
    matchEstimate: 0,
    reason: "Insufficient evidence"
  };

  if (!candidate.rewrite) {
    result.reason = "Baseline non-rewrite candidate";
    return result;
  }

  if (!context.insideTable || (!context.dataGridDetected && !context.keyValueTableDetected)) {
    result.reason = "Not an eligible table interaction";
    return result;
  }

  if (context.candidateEvidence.roleMatchCount === 0) {
    result.reason = "Observed locator did not resolve in replay";
    return result;
  }

  if (candidate.strategy === "TARGET_ID" || candidate.strategy === "TARGET_TESTID") {
    if (!hasValue(resolveTargetTag(context))) {
      result.reason = "Missing observed target tag";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Stable target attribute uniquely identifies observed element";
    return result;
  }

  if (candidate.strategy === "TABLE_KEY_VALUE_ROW") {
    if (!context.keyValueTableDetected || !hasValue(context.row.labelValue) || !hasValue(resolveTargetTag(context))) {
      result.reason = "Missing key/value row label or target-tag evidence";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Key/value row label and value column are unique in observed DOM";
    return result;
  }

  if (candidate.strategy === "TABLE_ROW_BUSINESS_VALUE") {
    if (!hasValue(context.row.businessValue) || !hasValue(resolveTargetTag(context))) {
      result.reason = "Missing business row value or target-tag evidence";
      return result;
    }

    if (context.candidateEvidence.sameBusinessRowCount !== 1) {
      result.reason = "Business row value is not unique";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Business row and column are unique in observed DOM";
    return result;
  }

  if (candidate.strategy === "TABLE_ROW_ID") {
    if (!hasValue(context.row.id) || !hasValue(resolveTargetTag(context))) {
      result.reason = "Missing row id or target tag";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Stable row id and column observed";
    return result;
  }

  if (candidate.strategy === "DATA_ATTRIBUTE" || candidate.strategy === "COMPOSITE") {
    const hasScope =
      (candidate.strategy === "DATA_ATTRIBUTE" && hasValue(context.table.testId)) ||
      (candidate.strategy === "COMPOSITE" && hasValue(context.table.id) && !isDynamicId(context.table.id));
    if (!hasScope) {
      result.reason = "Missing stable table scope";
      return result;
    }

    if (context.duplicateText) {
      result.reason = "Observed text is duplicated";
      return result;
    }

    if (context.candidateEvidence.roleMatchCount !== 1) {
      result.reason = "Observed target is not unique";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Scoped table candidate matches unique observed target";
    return result;
  }

  if (candidate.strategy === "TABLE_CELL") {
    if (!hasValue(resolveTargetTag(context))) {
      result.reason = "Missing observed target-tag evidence";
      return result;
    }

    if (context.duplicateText || context.candidateEvidence.roleMatchCount !== 1) {
      result.reason = "Structural candidate is not uniquely supported";
      return result;
    }

    result.valid = true;
    result.unique = true;
    result.matchEstimate = 1;
    result.reason = "Observed target uniquely resolves within detected column";
    return result;
  }

  return result;
}

function findObservation(lineNumber, textValue, observations) {
  const actions = Array.isArray(observations.actions) ? observations.actions : [];
  if (!actions.length) {
    return null;
  }

  const byLine = actions.find((item) => Number(item.line) === Number(lineNumber));
  if (byLine) {
    return byLine;
  }

  const targetText = normalize(textValue);
  if (!targetText) {
    return null;
  }

  return (
    actions.find((item) => normalize(item.text) === targetText) ||
    actions.find((item) => normalize(item.name) === targetText) ||
    null
  );
}

function inferInsideTable(actionText, observation) {
  if (observation && (observation.insideTable || observation.insideGrid)) {
    return true;
  }

  if (observation && Array.isArray(observation.ancestors)) {
    const normalized = observation.ancestors.map((item) => normalize(item));
    if (normalized.includes("td") || normalized.includes("tr") || normalized.includes("table")) {
      return true;
    }
  }

  return false;
}

function buildContext(action, observation, tableSelector) {
  const row = observation && observation.row ? observation.row : {};
  const table = observation && observation.table ? observation.table : {};
  const cell = observation && observation.cell ? observation.cell : {};

  const text = hasValue(action.text) ? action.text : (observation && (observation.text || observation.name) ? (observation.text || observation.name) : "");
  const columnIndex = Number(cell.columnIndex || 0);

  const rowBusinessValue =
    row.businessValue ||
    row.keyValue ||
    row.primaryValue ||
    null;

  return {
    action: {
      ...action,
      text
    },
    insideTable: Boolean(observation && observation.insideTable),
    inferredInsideTable: inferInsideTable(text, observation),
    tableSelector,
    table: {
      id: table.id || null,
      testId: table.testId || table["data-testid"] || null,
      className: table.className || null
    },
    row: {
      id: row.id || null,
      labelValue: row.labelValue || null,
      businessValue: rowBusinessValue,
      className: row.className || null,
      rowValues: Array.isArray(row.rowValues) ? row.rowValues : []
    },
    cell: {
      columnIndex: Number.isFinite(columnIndex) && columnIndex > 0 ? columnIndex : null,
      className: observation && observation.cell ? observation.cell.className || null : null
    },
    target: {
      tagName: observation && observation.target ? observation.target.tagName || null : null,
      id: observation && observation.target ? observation.target.id || null : null,
      className: observation && observation.target ? observation.target.className || null : null,
      testId: observation && observation.target ? observation.target.testId || null : null,
      ariaLabel: observation && observation.target ? observation.target.ariaLabel || null : null,
      name: observation && observation.target ? observation.target.name || null : null,
      title: observation && observation.target ? observation.target.title || null : null,
      dataQa: observation && observation.target ? observation.target.dataQa || null : null,
      dataTest: observation && observation.target ? observation.target.dataTest || null : null,
      attributeCounts:
        observation && observation.target && observation.target.attributeCounts
          ? observation.target.attributeCounts
          : {}
    },
    dataGridDetected: false,
    keyValueTableDetected: false,
    duplicateText: Boolean(observation && (observation.duplicateText || observation.matchCount > 1 || observation.isUnique === false)),
    candidateEvidence: {
      roleMatchCount: Number(observation && observation.matchCount ? observation.matchCount : 0),
      sameBusinessRowCount: Number(observation && observation.sameBusinessRowCount ? observation.sameBusinessRowCount : 0),
      tableScopedMatchCount: Number(observation && observation.tableScopedMatchCount ? observation.tableScopedMatchCount : 0)
    },
    normalized: {
      text: normalize(text)
    }
  };
}

function buildCandidates(context) {
  const candidates = [];
  const text = escapeXPathLiteral(context.action.text);
  const method = context.action.method;
  const columnIndex = context.cell.columnIndex;
  const targetSelector = buildPreferredTargetSelectorInRow(context, text, columnIndex);
  const targetInRow = targetSelector.selector;
  const attributeLocator = buildAttributeLocator(context);

  candidates.push({
    strategy: "ROLE",
    locator: context.action.originalLocator,
    score: 5,
    reasonParts: ["Baseline role/name locator"],
    method,
    rewrite: false
  });

  if (!context.insideTable) {
    if (context.inferredInsideTable) {
      candidates.push({
        strategy: "TEXT",
        locator: context.action.originalLocator,
        score: 3,
        reasonParts: ["Heuristic-only signal (last resort)"],
        method,
        rewrite: false
      });
    }
    return candidates;
  }

  if ((!context.dataGridDetected && !context.keyValueTableDetected) || !isTransformableTarget(context)) {
    candidates.push({
      strategy: "TABLE_CONTEXT_REJECTED",
      locator: context.action.originalLocator,
      score: 4,
      reasonParts: ["Table context not eligible for safe transformation"],
      method,
      rewrite: false
    });
    return candidates;
  }

  const hasStableTableId = !!context.table.id && !isDynamicId(context.table.id);
  const hasTableTestId = !!context.table.testId;
  const hasRowId = !!context.row.id;

  if (attributeLocator) {
    candidates.push({
      strategy: hasValue(context.target.testId) ? "TARGET_TESTID" : "TARGET_ID",
      locator: attributeLocator,
      score: context.keyValueTableDetected ? 16 : 13,
      reasonParts: [hasValue(context.target.testId) ? "Stable target data-testid" : "Stable target id"],
      method,
      rewrite: true
    });
  }

  if (hasRowId) {
    candidates.push({
      strategy: "TABLE_ROW_ID",
      locator: `//tr[@id='${escapeXPathLiteral(context.row.id)}']//${stripRelativePrefix(targetInRow)}`,
      score: 12,
      reasonParts: ["Observed row id", targetSelector.reason],
      method,
      rewrite: true
    });
  }

  const rowBusinessValue = context.row.businessValue || context.action.text;
  const escapedBusiness = escapeXPathLiteral(rowBusinessValue);
  const keyValueCandidate = buildKeyValueRowCandidate(context, text, method);

  if (keyValueCandidate) {
    candidates.push(keyValueCandidate);
  }

  if (hasValue(context.row.businessValue) || hasValue(context.action.text)) {
    candidates.push({
      strategy: "TABLE_ROW_BUSINESS_VALUE",
      locator: `//tr[td[text()='${escapedBusiness}']]//${stripRelativePrefix(targetInRow)}`,
      score: 9,
      reasonParts: ["Business row value", targetSelector.reason],
      method,
      rewrite: true
    });
  }

  if (hasStableTableId) {
    candidates.push({
      strategy: "COMPOSITE",
      locator: `//table[@id='${escapeXPathLiteral(context.table.id)}']//tr[${targetInRow}]//${stripRelativePrefix(targetInRow)}`,
      score: 8,
      reasonParts: ["Stable table id", "Table row/anchor relationship"],
      method,
      rewrite: true
    });
  }

  if (hasTableTestId) {
    candidates.push({
      strategy: "DATA_ATTRIBUTE",
      locator: `//*[@data-testid='${escapeXPathLiteral(context.table.testId)}']//tr[${targetInRow}]//${stripRelativePrefix(targetInRow)}`,
      score: 10,
      reasonParts: ["Stable data-testid", "Table row/anchor relationship"],
      method,
      rewrite: true
    });
  }

  candidates.push({
    strategy: "TABLE_CELL",
    locator: `//${context.tableSelector}//tr[${targetInRow}]//${stripRelativePrefix(targetInRow)}`,
    score: 7,
    reasonParts: ["Table structural relationship", targetSelector.reason],
    method,
    rewrite: true
  });

  for (const candidate of candidates) {
    if (!candidate.rewrite) {
      continue;
    }

    if (context.duplicateText && strategyDependsOnTargetText(candidate.strategy) && targetSelector.usesText) {
      candidate.score -= 5;
      candidate.reasonParts.push("Duplicate text detected");
    }

    if (context.candidateEvidence.roleMatchCount > 1 && candidate.strategy === "ROLE") {
      candidate.score -= 4;
      candidate.reasonParts.push("ROLE locator is ambiguous");
    }

    if (
      context.candidateEvidence.sameBusinessRowCount > 1 &&
      candidate.strategy === "TABLE_ROW_BUSINESS_VALUE"
    ) {
      candidate.score -= 5;
      candidate.reasonParts.push("Business row value is duplicated");
    }

    if (
      context.candidateEvidence.sameBusinessRowCount === 1 &&
      candidate.strategy === "TABLE_ROW_BUSINESS_VALUE"
    ) {
      candidate.score += 3;
      candidate.reasonParts.push("Business row value validated as unique");
    }

    if (isNumericLike(context.action.text) && normalize(context.action.role) !== "link") {
      candidate.score += 2;
      candidate.reasonParts.push("Numeric business identifier signal");
    }

    const validation = validateCandidate(candidate, context);
    candidate.validation = validation;
    if (!validation.valid) {
      candidate.score -= 6;
      candidate.reasonParts.push(`Validation rejected: ${validation.reason}`);
    }
  }

  return candidates;
}

function selectBestCandidate(candidates) {
  const ordered = [...candidates].sort((a, b) => b.score - a.score);
  return {
    best: ordered[0],
    ordered
  };
}

function selectBestValidatedRewriteCandidate(candidates) {
  const ordered = [...candidates]
    .filter(
      (candidate) =>
        candidate.rewrite &&
        candidate.validation &&
        candidate.validation.valid &&
        candidate.validation.unique &&
        candidate.validation.matchEstimate === 1
    )
    .sort((a, b) => b.score - a.score);

  return ordered[0] || null;
}

function toConfidence(score) {
  const value = (score + 10) / 25;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function parseActionLine(line) {
  const scopedRolePattern = /^(\s*)await\s+page\.locator\((['"`])(.+?)\2\)\.getByRole\((['"`])(\w+)\4,\s*\{[^}]*name:\s*(['"`])([^'"`]+)\6[^}]*\}\)(?:\.(first\(\)|nth\((\d+)\)))?\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const scopedRoleMatch = line.match(scopedRolePattern);
  if (scopedRoleMatch) {
    const role = scopedRoleMatch[5];
    const text = scopedRoleMatch[7];
    const positionRaw = scopedRoleMatch[8] || "";

    return {
      indent: scopedRoleMatch[1],
      kind: "role",
      role,
      text,
      method: scopedRoleMatch[10],
      first: positionRaw === "first()",
      nth: scopedRoleMatch[9] ? Number(scopedRoleMatch[9]) : null,
      originalLocator: `page.locator('${scopedRoleMatch[3]}').getByRole('${role}', { name: '${text}' })`
    };
  }

  const scopedRoleFilterPattern = /^(\s*)await\s+page\.locator\((['"`])(.+?)\2\)\.getByRole\((['"`])(\w+)\4\)\.filter\(\{\s*hasText:\s*\/\^\$\/\s*\}\)(?:\.(first\(\)|nth\((\d+)\)))?\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const scopedRoleFilterMatch = line.match(scopedRoleFilterPattern);
  if (scopedRoleFilterMatch) {
    const positionRaw = scopedRoleFilterMatch[6] || "";
    return {
      indent: scopedRoleFilterMatch[1],
      kind: "role",
      role: scopedRoleFilterMatch[5],
      text: "",
      method: scopedRoleFilterMatch[8],
      first: positionRaw === "first()",
      nth: scopedRoleFilterMatch[7] ? Number(scopedRoleFilterMatch[7]) : null,
      originalLocator: `page.locator('${scopedRoleFilterMatch[3]}').getByRole('${scopedRoleFilterMatch[5]}').filter({ hasText: /^$/ })`
    };
  }

  const scopedTextPattern = /^(\s*)await\s+page\.locator\((['"`])(.+?)\2\)\.getByText\((['"`])([^'"`]+)\4(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const scopedTextMatch = line.match(scopedTextPattern);
  if (scopedTextMatch) {
    return {
      indent: scopedTextMatch[1],
      kind: "text",
      role: "text",
      text: scopedTextMatch[5],
      exact: scopedTextMatch[6] === "true",
      method: scopedTextMatch[7],
      originalLocator: `page.locator('${scopedTextMatch[3]}').getByText('${scopedTextMatch[5]}')`
    };
  }

  const rolePattern = /^(\s*)await\s+page\.getByRole\((['"`])(\w+)\2,\s*\{[^}]*name:\s*(['"`])([^'"`]+)\4[^}]*\}\)(?:\.(first\(\)|nth\((\d+)\)))?\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const match = line.match(rolePattern);
  if (match) {
    const role = match[3];
    const text = match[5];
    const positionRaw = match[6] || "";

    return {
      indent: match[1],
      kind: "role",
      role,
      text,
      method: match[8],
      first: positionRaw === "first()",
      nth: match[7] ? Number(match[7]) : null,
      originalLocator: `page.getByRole('${role}', { name: '${text}' })`
    };
  }

  const pageTextPattern = /^(\s*)await\s+page\.getByText\((['"`])([^'"`]+)\2(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const pageTextMatch = line.match(pageTextPattern);
  if (pageTextMatch) {
    return {
      indent: pageTextMatch[1],
      kind: "text",
      role: "text",
      text: pageTextMatch[3],
      exact: pageTextMatch[4] === "true",
      method: pageTextMatch[5],
      originalLocator: pageTextMatch[0].trim().replace(/^await\s+/, "").replace(/\.(click|dblclick|hover|check|uncheck)\(\);\s*$/, "")
    };
  }

  const frameTextPattern = /^(\s*)await\s+page\.locator\((['"`])(.+?)\2\)\.contentFrame\(\)\.getByText\((['"`])([^'"`]+)\4(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
  const frameTextMatch = line.match(frameTextPattern);
  if (frameTextMatch) {
    return {
      indent: frameTextMatch[1],
      kind: "text",
      role: "text",
      text: frameTextMatch[5],
      exact: frameTextMatch[6] === "true",
      method: frameTextMatch[7],
      scope: "frame",
      frameSelector: frameTextMatch[3],
      originalLocator: frameTextMatch[0].trim().replace(/^await\s+/, "").replace(/\.(click|dblclick|hover|check|uncheck)\(\);\s*$/, "")
    };
  }

    const locatorActionPattern = /^(\s*)await\s+page\.locator\((['"`])(.+?)\2\)(?:\.first\(\))?\.(click|dblclick|hover|check|uncheck)\(\);\s*$/;
    const locatorActionMatch = line.match(locatorActionPattern);
    if (locatorActionMatch) {
      return {
        indent: locatorActionMatch[1],
        kind: "locator",
        role: "locator",
        text: "",
        method: locatorActionMatch[4],
        originalLocator: `page.locator('${locatorActionMatch[3]}')`,
      };
    }

  return null;
}

function rewriteAction(lineInfo, bestCandidate) {
  const indent = lineInfo.action.indent;
  const escapedLocator = bestCandidate.locator.replace(/"/g, '\\"');
  const baseExpression =
    lineInfo.action.scope === "frame" && lineInfo.action.frameSelector
      ? `page.locator('${lineInfo.action.frameSelector}').contentFrame().locator("${escapedLocator}")`
      : `page.locator("${escapedLocator}")`;

  return [`${indent}await ${baseExpression}.${lineInfo.action.method}();`];
}

function transformCode(options) {
  const codeText = safeRead(options.codeFilePath);
  const observations = safeReadJson(options.domFilePath);
  const specificRules = loadSpecificLocatorRules(options.specificRulesFilePath);
  const lines = codeText.split(/\r?\n/);
  const outLines = [];
  const metadata = {
    generatedAtUtc: new Date().toISOString(),
    codeFilePath: options.codeFilePath,
    tableSelector: options.tableSelector,
    analyzedActions: 0,
    transformedActions: 0,
    specificRulesFilePath: specificRules.filePath,
    actions: []
  };

  const preserveIdTableLocators = Boolean(options.preserveIdTableLocators);
  const rewriteTableGetByTextOnly = Boolean(options.rewriteTableGetByTextOnly);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const action = parseActionLine(line);
    if (!action) {
      outLines.push(line);
      continue;
    }

    metadata.analyzedActions += 1;
    const lineNumber = i + 1;

    try {
      const observation = findObservation(lineNumber, action.text, observations);
      const context = buildContext(action, observation, options.tableSelector);
      context.dataGridDetected = isDataGridContext(context);
      context.keyValueTableDetected = isKeyValueTableContext(context);

      if (!context.insideTable) {
        const specificCandidate = findSpecificLocatorCandidate(context, specificRules);
        if (specificCandidate && specificCandidate.rewrite) {
          const rewrittenSpecific = rewriteAction({ action, lineNumber }, specificCandidate);
          outLines.push(...rewrittenSpecific);
          metadata.transformedActions += 1;
          metadata.actions.push({
            line: lineNumber,
            action: action.method,
            text: action.text,
            tableDetected: false,
            strategy: specificCandidate.strategy,
            confidence: 0.95,
            locator: specificCandidate.locator,
            reason: specificCandidate.reasonParts.join("; "),
            uniqueMatch: true
          });
          log(options.debug, `Line ${lineNumber}: specific rule rewrite applied (${specificCandidate.strategy}).`);
          continue;
        }

        if (specificCandidate && !specificCandidate.rewrite) {
          outLines.push(line);
          metadata.actions.push({
            line: lineNumber,
            action: action.method,
            text: action.text,
            tableDetected: false,
            strategy: specificCandidate.strategy,
            confidence: 0.45,
            reason: specificCandidate.reasonParts.join("; "),
            uniqueMatch: false
          });
          log(options.debug, `Line ${lineNumber}: specific rule matched but no unique attribute candidate.`);
          continue;
        }
      }

      if (!context.insideTable) {
        log(options.debug, `Line ${lineNumber}: not classified as table/grid action, keeping original.`);
        outLines.push(line);
        metadata.actions.push({
          line: lineNumber,
          action: action.method,
          text: action.text,
          tableDetected: false,
          strategy: "ROLE",
          confidence: 0.5,
          reason: "Not detected as table/grid action"
        });
        continue;
      }

      if (preserveIdTableLocators && isIdAnchoredTableLocator(action.originalLocator)) {
        outLines.push(line);
        metadata.actions.push({
          line: lineNumber,
          action: action.method,
          text: action.text,
          tableDetected: true,
          strategy: "PRESERVE_ID_TABLE_LOCATOR",
          confidence: 1,
          reason: "Preserved existing id-anchored table locator",
          uniqueMatch: true
        });
        log(options.debug, `Line ${lineNumber}: preserved id-anchored table locator.`);
        continue;
      }

      if (rewriteTableGetByTextOnly && action.kind !== "text") {
        outLines.push(line);
        metadata.actions.push({
          line: lineNumber,
          action: action.method,
          text: action.text,
          tableDetected: true,
          strategy: "PRESERVE_NON_TEXT_TABLE_LOCATOR",
          confidence: 1,
          reason: "Only getByText table locators are eligible for transformation",
          uniqueMatch: true
        });
        log(options.debug, `Line ${lineNumber}: preserved non-text table locator by policy.`);
        continue;
      }

      log(options.debug, `Line ${lineNumber}: table/grid element detected.`);
      const candidates = buildCandidates(context);
      const selected = selectBestCandidate(candidates);
      const bestValidatedRewrite = selectBestValidatedRewriteCandidate(candidates);
      const chosenCandidate = bestValidatedRewrite || selected.best;
      const confidence = toConfidence(chosenCandidate.score);
      const roleScore = candidates.find((item) => item.strategy === "ROLE")?.score ?? 0;
      const selectedValidation = chosenCandidate.validation || { valid: chosenCandidate.rewrite, unique: false, matchEstimate: 0, reason: "No validation" };
      const shouldRewrite =
        chosenCandidate.rewrite &&
        selectedValidation.valid &&
        selectedValidation.unique &&
        selectedValidation.matchEstimate === 1 &&
        chosenCandidate.score >= roleScore + 2 &&
        confidence >= 0.65 &&
        (!context.duplicateText || !strategyDependsOnTargetText(chosenCandidate.strategy));

      metadata.actions.push({
        line: lineNumber,
        action: action.method,
        elementType: `table-${resolveTargetTag(context) || action.role || "target"}`,
        text: action.text,
        tableDetected: true,
        dataGridDetected: context.dataGridDetected,
        strategy: chosenCandidate.strategy,
        confidence,
        locator: shouldRewrite ? chosenCandidate.locator : "",
        reason: [...chosenCandidate.reasonParts, `Validation: ${selectedValidation.reason}`].join("; "),
        uniqueMatch: shouldRewrite,
        candidates: candidates.map((item) => ({
          strategy: item.strategy,
          score: item.score,
          locator: item.locator,
          validation: item.validation || null
        }))
      });

      log(options.debug, `Line ${lineNumber}: candidates generated: ${candidates.length}.`);
  log(options.debug, `Line ${lineNumber}: best strategy ${chosenCandidate.strategy} (score=${chosenCandidate.score}, confidence=${confidence}).`);

      if (!shouldRewrite) {
        log(options.debug, `Line ${lineNumber}: fallback to original codegen locator.`);
        outLines.push(line);
        continue;
      }

      const rewritten = rewriteAction({ action, lineNumber }, chosenCandidate);
      outLines.push(...rewritten);
      metadata.transformedActions += 1;
      log(options.debug, `Line ${lineNumber}: locator selected: ${chosenCandidate.locator}`);
    } catch (error) {
      outLines.push(line);
      metadata.actions.push({
        line: lineNumber,
        action: action.method,
        text: action.text,
        tableDetected: false,
        strategy: "ROLE",
        confidence: 0.4,
        reason: `Analysis failure fallback: ${error instanceof Error ? error.message : String(error)}`
      });
      log(options.debug, `Line ${lineNumber}: analysis failed, fallback to original locator.`);
    }
  }

  return {
    code: outLines.join("\n"),
    metadata
  };
}

function runCli() {
  const args = parseArgs(process.argv);
  const codeFilePath = args["code-file"];

  if (!codeFilePath) {
    console.error("[TableLocator] Missing required argument: --code-file");
    process.exit(2);
  }

  const options = {
    codeFilePath,
    domFilePath: args["dom-file"] || "",
    metadataFilePath: args["metadata-file"] || "",
    specificRulesFilePath: args["specific-rules-file"] || "",
    tableSelector: args["table-selector"] || "table",
    debug: toBoolean(args.debug),
    preserveIdTableLocators: toBoolean(args["preserve-id-table-locators"]),
    rewriteTableGetByTextOnly: toBoolean(args["rewrite-table-getbytext-only"])
  };

  const result = transformCode(options);
  fs.writeFileSync(options.codeFilePath, result.code, "utf8");

  if (options.metadataFilePath) {
    const metadataDir = path.dirname(options.metadataFilePath);
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.writeFileSync(options.metadataFilePath, JSON.stringify(result.metadata, null, 2), "utf8");
  }

  console.log(
    `[TableLocator] Completed. analyzed=${result.metadata.analyzedActions}, transformed=${result.metadata.transformedActions}`
  );
}

if (require.main === module) {
  runCli();
}

module.exports = {
  transformCode,
  parseActionLine,
  buildContext,
  buildCandidates,
  selectBestCandidate,
  selectBestValidatedRewriteCandidate,
  toConfidence
};
