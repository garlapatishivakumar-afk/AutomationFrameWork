const fs = require("fs");
const path = require("path");

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
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

function escapeCSharpString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function toPascalCase(value) {
  const acronymTokens = new Set(["id", "api", "url", "ui", "qa"]);
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => {
      const normalized = segment.toLowerCase();
      if (acronymTokens.has(normalized)) {
        return normalized.toUpperCase();
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("");
}

function inferRoleEnum(role) {
  const normalized = String(role || "").trim().toLowerCase();
  const explicitMap = {
    button: "Button",
    link: "Link",
    cell: "Cell",
    row: "Row",
    textbox: "Textbox",
    combobox: "Combobox",
    checkbox: "Checkbox",
    radio: "Radio",
    dialog: "Dialog",
    table: "Table",
    grid: "Grid",
    option: "Option",
    tab: "Tab",
    tabpanel: "TabPanel",
    heading: "Heading",
    img: "Img",
    image: "Img"
  };

  return explicitMap[normalized] || toPascalCase(normalized);
}

function readConfiguredUrls(appSettingsPath) {
  try {
    const parsed = JSON.parse(safeRead(appSettingsPath) || "{}");
    const urls = parsed && parsed.Urls ? parsed.Urls : {};
    return Object.entries(urls)
      .filter((entry) => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([key, value]) => ({ key, value }));
  } catch {
    return [];
  }
}

function buildUrlExpression(url, appSettingsPath) {
  const configuredUrls = readConfiguredUrls(appSettingsPath);
  const matched = configuredUrls.find((entry) => entry.value === url);

  if (matched) {
    return {
      expression: `Config.Urls.${matched.key}`,
      warning: null
    };
  }

  return {
    expression: `"${escapeCSharpString(url)}"`,
    warning: `URL at source line uses literal value because no matching appsettings Urls entry was found: ${url}`
  };
}

function detectTableInfo(selector) {
  const text = String(selector || "");
  const probable = /\/\/tr\[|role='row'|role='cell'|grid|table|rg[a-z]+/i.test(text);
  return probable
    ? {
        probable: true,
        selector
      }
    : null;
}

function createAction(sourceLine, raw, data) {
  return {
    sourceLine,
    raw,
    actionType: data.actionType,
    locator: data.locator || null,
    locatorStrategy: data.locatorStrategy || "UNKNOWN",
    targetElement: data.targetElement || null,
    value: data.value === undefined ? null : data.value,
    expectedResult: data.expectedResult || null,
    frame: data.frame || null,
    popup: data.popup || null,
    table: data.table || null,
    confidence: data.confidence === undefined ? 0.7 : data.confidence,
    supported: data.supported !== false,
    diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : []
  };
}

function parseLocatorPosition(segment) {
  const value = String(segment || "");
  if (!value) {
    return null;
  }

  if (value === ".first()") {
    return { type: "first" };
  }

  if (value === ".last()") {
    return { type: "last" };
  }

  const nthMatch = value.match(/^\.nth\((\d+)\)$/);
  if (nthMatch) {
    return { type: "nth", index: Number(nthMatch[1]) };
  }

  return null;
}

function withPosition(locator, positionSegment) {
  const position = parseLocatorPosition(positionSegment);
  return position ? { ...locator, position } : locator;
}

function parseLocatorExpression(expression) {
  const trimmed = String(expression || "").trim();
  const patterns = [
    {
      regex: /^page\.frameLocator\((['"`])(.+?)\1\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "frameRole", frameSelector: match[2], role: match[4], name: match[6], exact: match[7] === "true" }, match[8])
    },
    {
      regex: /^page\.frameLocator\((['"`])(.+?)\1\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "frameText", frameSelector: match[2], text: match[4], exact: match[5] === "true" }, match[6])
    },
    {
      regex: /^page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "frameRole", frameSelector: match[2], role: match[4], name: match[6], exact: match[7] === "true" }, match[8])
    },
    {
      regex: /^page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "frameText", frameSelector: match[2], text: match[4], exact: match[5] === "true" }, match[6])
    },
    {
      regex: /^page\.locator\((['"`])(.+?)\1\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "scopedRole", selector: match[2], role: match[4], name: match[6], exact: match[7] === "true" }, match[8])
    },
    {
      regex: /^page\.locator\((['"`])(.+?)\1\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "scopedText", selector: match[2], text: match[4], exact: match[5] === "true" }, match[6])
    },
    {
      regex: /^page\.getByRole\((['"`])(\w+)\1,\s*\{\s*name:\s*(['"`])([^'"`]+)\3(?:,\s*exact:\s*(true|false))?\s*\}\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "role", role: match[2], name: match[4], exact: match[5] === "true" }, match[6])
    },
    {
      regex: /^page\.getByText\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "text", text: match[2], exact: match[3] === "true" }, match[4])
    },
    {
      regex: /^page\.getByLabel\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "label", text: match[2], exact: match[3] === "true" }, match[4])
    },
    {
      regex: /^page\.getByPlaceholder\((['"`])([^'"`]+)\1\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "placeholder", text: match[2] }, match[3])
    },
    {
      regex: /^page\.getByTitle\((['"`])([^'"`]+)\1\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "title", text: match[2] }, match[3])
    },
    {
      regex: /^page\.getByTestId\((['"`])([^'"`]+)\1\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "testid", text: match[2] }, match[3])
    },
    {
      regex: /^page\.locator\((['"`])(.+?)\1\)(\.filter\(\{\s*hasText:\s*(['"`])([^'"`]+)\4\s*\}\))?(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "locator", selector: match[2], filterText: match[5] || null }, match[6])
    }
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return pattern.build(match);
    }
  }

  return null;
}

function tryParseGenericLocatorAction(line, rawLine, sourceLine) {
  const actionMatch = line.match(/^await\s+(page\.[\s\S]+)\.(click|dblclick|hover|check|uncheck|focus|fill|press|selectOption|setInputFiles|waitFor)\((?:\s*(['"`])([\s\S]*?)\3\s*)?\);$/);
  if (!actionMatch) {
    return null;
  }

  const locator = parseLocatorExpression(actionMatch[1]);
  if (!locator) {
    return null;
  }

  const diagnostics = [];
  if (["fill", "press", "selectOption", "setInputFiles"].includes(actionMatch[2]) && actionMatch[4]) {
    diagnostics.push("Literal input value preserved from recording. Consider replacing with framework data binding.");
  }

  return createAction(sourceLine, rawLine, {
    actionType: actionMatch[2],
    locatorStrategy: locator.kind.toUpperCase(),
    locator,
    targetElement: locator.kind,
    value: actionMatch[4] || null,
    table: locator.selector ? detectTableInfo(locator.selector) : null,
    frame: locator.frameSelector ? { selector: locator.frameSelector } : null,
    confidence: 0.88,
    diagnostics
  });
}

function parseActionLine(rawLine, sourceLine) {
  const line = String(rawLine || "").trim();
  if (!line.startsWith("await ")) {
    return null;
  }

  const gotoMatch = line.match(/^await\s+page\.goto\((['"`])([^'"`]+)\1\);$/);
  if (gotoMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: "goto",
      locatorStrategy: "PAGE_URL",
      value: gotoMatch[2],
      targetElement: "page"
    });
  }

  const waitForSelectorMatch = line.match(/^await\s+page\.waitForSelector\((['"`])(.+?)\1\);$/);
  if (waitForSelectorMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: "waitForSelector",
      locatorStrategy: "SELECTOR",
      locator: { kind: "selector", selector: waitForSelectorMatch[2] },
      targetElement: "selector"
    });
  }

  const keyboardMatch = line.match(/^await\s+page\.keyboard\.(press|type|insertText|down|up)\((['"`])([^'"`]*)\2\);$/);
  if (keyboardMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: `keyboard.${keyboardMatch[1]}`,
      locatorStrategy: "KEYBOARD",
      value: keyboardMatch[3],
      targetElement: "keyboard"
    });
  }

  const mouseMatch = line.match(/^await\s+page\.mouse\.(click|dblclick|move)\(([^\)]*)\);$/);
  if (mouseMatch) {
    const values = mouseMatch[2]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    return createAction(sourceLine, rawLine, {
      actionType: `mouse.${mouseMatch[1]}`,
      locatorStrategy: "MOUSE",
      value: values,
      targetElement: "mouse"
    });
  }

  const expectVisibleMatch = line.match(/^await\s+expect\((.+)\)\.(toBeVisible|toContainText|toHaveText)\((?:\s*(['"`])([\s\S]*?)\3\s*)?\);$/);
  if (expectVisibleMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: expectVisibleMatch[2],
      locatorStrategy: "ASSERTION",
      locator: { kind: "expression", expression: expectVisibleMatch[1].trim() },
      expectedResult: expectVisibleMatch[4] || expectVisibleMatch[2],
      targetElement: "assertion"
    });
  }

  const patterns = [
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[8],
        locatorStrategy: "FRAME_ROLE",
        locator: { kind: "frameRole", frameSelector: matches[2], role: matches[4], name: matches[6], exact: matches[7] === "true" },
        targetElement: matches[4],
        frame: { selector: matches[2] },
        confidence: 0.9
      })
    },
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "FRAME_TEXT",
        locator: { kind: "frameText", frameSelector: matches[2], text: matches[4], exact: matches[5] === "true" },
        targetElement: "text",
        frame: { selector: matches[2] },
        confidence: 0.88
      })
    },
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[8],
        locatorStrategy: "SCOPED_ROLE",
        locator: { kind: "scopedRole", selector: matches[2], role: matches[4], name: matches[6], exact: matches[7] === "true" },
        targetElement: matches[4],
        table: detectTableInfo(matches[2]),
        confidence: 0.92
      })
    },
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "SCOPED_TEXT",
        locator: { kind: "scopedText", selector: matches[2], text: matches[4], exact: matches[5] === "true" },
        targetElement: "text",
        table: detectTableInfo(matches[2]),
        confidence: 0.9
      })
    },
    {
      match: line.match(/^await\s+page\.getByRole\((['"`])(\w+)\1,\s*\{\s*name:\s*(['"`])([^'"`]+)\3(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "ROLE",
        locator: { kind: "role", role: matches[2], name: matches[4], exact: matches[5] === "true" },
        targetElement: matches[2],
        confidence: 0.95
      })
    },
    {
      match: line.match(/^await\s+page\.getByText\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: "TEXT",
        locator: { kind: "text", text: matches[2], exact: matches[3] === "true" },
        targetElement: "text",
        confidence: 0.82
      })
    },
    {
      match: line.match(/^await\s+page\.getByLabel\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(fill|press|focus|click)\((?:\s*(['"`])([\s\S]*?)\5\s*)?\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: "LABEL",
        locator: { kind: "label", text: matches[2], exact: matches[3] === "true" },
        targetElement: "label",
        value: matches[6] || null,
        confidence: 0.92,
        diagnostics: matches[4] === "fill" && matches[6] ? ["Literal input value preserved from recording. Consider replacing with framework data binding."] : []
      })
    },
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)(\.first\(\))?\.(click|dblclick|hover|check|uncheck|focus|waitFor)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: detectTableInfo(matches[2]) ? "TABLE_LOCATOR" : "LOCATOR",
        locator: { kind: "locator", selector: matches[2], first: Boolean(matches[3]) },
        targetElement: "locator",
        table: detectTableInfo(matches[2]),
        confidence: 0.93
      })
    },
    {
      match: line.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.(fill|press|selectOption|setInputFiles)\((['"`])([\s\S]*?)\4\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[3],
        locatorStrategy: detectTableInfo(matches[2]) ? "TABLE_LOCATOR" : "LOCATOR",
        locator: { kind: "locator", selector: matches[2], first: false },
        targetElement: "locator",
        value: matches[5],
        table: detectTableInfo(matches[2]),
        confidence: 0.9,
        diagnostics: ["Literal input value preserved from recording. Consider replacing with framework data binding."]
      })
    }
  ];

  for (const pattern of patterns) {
    if (pattern.match) {
      return pattern.build(pattern.match);
    }
  }

  const genericAction = tryParseGenericLocatorAction(line, rawLine, sourceLine);
  if (genericAction) {
    return genericAction;
  }

  return createAction(sourceLine, rawLine, {
    actionType: "unsupported",
    locatorStrategy: "UNSUPPORTED",
    supported: false,
    confidence: 0,
    diagnostics: ["Unsupported Playwright statement. Manual review required."]
  });
}

function parseRecordedActions(code) {
  const lines = String(code || "").split(/\r?\n/);
  const actions = [];

  const normalizeRecordedLine = (line) => {
    const raw = String(line || "");
    const trimmed = raw.trim();

    // Ignore recorder narrative notes that are not executable actions.
    if (/^await\s+.+\s+will\s+have\s+below\s+details\s*:\s*$/i.test(trimmed)) {
      return "";
    }

    // Keep executable statement and drop recorder-side annotation text.
    return raw.replace(/;\s*->.*$/, ";");
  };

  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizeRecordedLine(lines[index]);
    const action = parseActionLine(normalizedLine, index + 1);
    if (action) {
      actions.push(action);
    }
  }

  return actions;
}

function convertLocatorExpressionFromTs(expression) {
  const trimmed = String(expression || "").trim();

  const parsed = parseLocatorExpression(trimmed);
  if (parsed) {
    return buildLocatorExpression(parsed);
  }

  const roleMatch = trimmed.match(/^page\.getByRole\((['"`])(\w+)\1,\s*\{\s*name:\s*(['"`])([^'"`]+)\3(?:,\s*exact:\s*(true|false))?\s*\}\)$/);
  if (roleMatch) {
    const exactPart = roleMatch[5] === "true" ? ", Exact = true" : "";
    return `Page.GetByRole(AriaRole.${inferRoleEnum(roleMatch[2])}, new() { Name = \"${escapeCSharpString(roleMatch[4])}\"${exactPart} })`;
  }

  const textMatch = trimmed.match(/^page\.getByText\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)$/);
  if (textMatch) {
    const options = textMatch[3] === "true" ? ", new() { Exact = true }" : "";
    return `Page.GetByText(\"${escapeCSharpString(textMatch[2])}\"${options})`;
  }

  const labelMatch = trimmed.match(/^page\.getByLabel\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)$/);
  if (labelMatch) {
    const options = labelMatch[3] === "true" ? ", new() { Exact = true }" : "";
    return `Page.GetByLabel(\"${escapeCSharpString(labelMatch[2])}\"${options})`;
  }

  const locatorMatch = trimmed.match(/^page\.locator\((['"`])(.+?)\1\)$/);
  if (locatorMatch) {
    return `Page.Locator(\"${escapeCSharpString(locatorMatch[2])}\")`;
  }

  return trimmed
    .replace(/page\./g, "Page.")
    .replace(/getByRole\(/g, "GetByRole(")
    .replace(/getByText\(/g, "GetByText(")
    .replace(/getByLabel\(/g, "GetByLabel(")
    .replace(/locator\(/g, "Locator(")
    .replace(/'/g, '"');
}

function buildLocatorExpression(locator) {
  if (!locator) {
    return "Page";
  }

  const applyPosition = (expression) => {
    if (!locator.position) {
      return expression;
    }

    if (locator.position.type === "first") {
      return `${expression}.First`;
    }

    if (locator.position.type === "last") {
      return `${expression}.Last`;
    }

    if (locator.position.type === "nth") {
      return `${expression}.Nth(${locator.position.index})`;
    }

    return expression;
  };

  if (locator.kind === "role") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`Page.GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "text") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`Page.GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "label") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`Page.GetByLabel(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "placeholder") {
    return applyPosition(`Page.GetByPlaceholder(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "title") {
    return applyPosition(`Page.GetByTitle(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "testid") {
    return applyPosition(`Page.GetByTestId(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "locator") {
    const base = locator.filterText
      ? `Page.Locator(\"${escapeCSharpString(locator.selector)}\").Filter(new() { HasText = \"${escapeCSharpString(locator.filterText)}\" })`
      : `Page.Locator(\"${escapeCSharpString(locator.selector)}\")`;
    return applyPosition(base);
  }

  if (locator.kind === "scopedRole") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`Page.Locator(\"${escapeCSharpString(locator.selector)}\").GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "scopedText") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`Page.Locator(\"${escapeCSharpString(locator.selector)}\").GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "frameRole") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`Page.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "frameText") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`Page.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "expression") {
    return convertLocatorExpressionFromTs(locator.expression);
  }

  return "Page";
}

function toCamelCase(value) {
  const cleaned = String(value || "").trim();
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(cleaned)) {
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  const pascal = toPascalCase(cleaned);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "value";
}

function normalizeFrameworkExpression(expression) {
  return String(expression || "")
    .replace(/_page\./g, "Page.")
    .replace(/\s+/g, " ")
    .replace(/\s*=>\s*/g, "=>")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*;\s*$/g, "")
    .trim();
}

function splitTerminalPosition(expression) {
  const match = String(expression || "").match(/^(.*?)(\.First|\.Last|\.Nth\(\d+\))$/);
  if (!match) {
    return {
      baseExpression: expression,
      suffix: ""
    };
  }

  return {
    baseExpression: match[1],
    suffix: match[2]
  };
}

function inferProjectRoot(options) {
  if (options.projectRoot) {
    return path.resolve(options.projectRoot);
  }

  if (options.appSettingsPath) {
    return path.dirname(path.resolve(options.appSettingsPath));
  }

  if (options.codeFilePath) {
    return path.resolve(path.dirname(options.codeFilePath), "..", "..");
  }

  return process.cwd();
}

function collectPageElementRegistry(projectRoot) {
  const pageElementsDir = path.join(projectRoot, "PageElements");
  if (!fs.existsSync(pageElementsDir)) {
    return [];
  }

  const entries = [];
  for (const file of fs.readdirSync(pageElementsDir)) {
    if (!file.endsWith(".cs")) {
      continue;
    }

    const filePath = path.join(pageElementsDir, file);
    const source = safeRead(filePath);
    const classMatch = source.match(/class\s+(\w+)/);
    if (!classMatch) {
      continue;
    }

    const className = classMatch[1];
    const propertyRegex = /public\s+ILocator\s+(\w+)\s*=>\s*([\s\S]*?);/g;
    let match;
    while ((match = propertyRegex.exec(source)) !== null) {
      entries.push({
        className,
        fieldName: `_${toCamelCase(className)}`,
        propertyName: match[1],
        expression: match[2].trim(),
        normalizedExpression: normalizeFrameworkExpression(match[2]),
        file: path.join("PageElements", file)
      });
    }
  }

  return entries;
}

function buildFrameworkContext(options) {
  const projectRoot = inferProjectRoot(options);
  return {
    projectRoot,
    hasCommonActionsPage: fs.existsSync(path.join(projectRoot, "Helpers", "CommonActionsPage.cs")),
    pageElements: collectPageElementRegistry(projectRoot)
  };
}

function resolveFrameworkLocatorReference(locatorExpression, frameworkContext) {
  const normalizedFull = normalizeFrameworkExpression(locatorExpression);

  const exact = frameworkContext.pageElements.find((entry) => entry.normalizedExpression === normalizedFull);
  if (exact) {
    return {
      kind: "pageElement",
      className: exact.className,
      fieldName: exact.fieldName,
      propertyName: exact.propertyName,
      expression: `${exact.fieldName}.${exact.propertyName}`,
      file: exact.file
    };
  }

  return null;
}

function sanitizeIdentifier(value) {
  const reserved = new Set([
    "class",
    "namespace",
    "public",
    "private",
    "protected",
    "internal",
    "event",
    "string",
    "int",
    "long",
    "float",
    "double",
    "decimal",
    "object",
    "params",
    "ref",
    "out",
    "base",
    "this",
    "operator",
    "default",
    "return",
    "await",
    "async",
    "new"
  ]);

  const cleaned = toPascalCase(String(value || "").replace(/[^a-zA-Z0-9]+/g, " "));
  let identifier = cleaned || "GeneratedLocator";
  if (!/^[A-Za-z_]/.test(identifier)) {
    identifier = `Locator${identifier}`;
  }
  return reserved.has(identifier.toLowerCase()) ? `${identifier}Locator` : identifier;
}

function selectorDerivedName(selector) {
  const source = String(selector || "");
  const idMatch = source.match(/#([A-Za-z0-9_:-]+)/);
  const candidate = idMatch ? idMatch[1] : source;
  const segments = candidate
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((part) => !/^ctl\d*$/i.test(part))
    .filter((part) => !/^contentplaceholder\d*$/i.test(part));

  const meaningful = segments.filter((part) => /[A-Za-z]/.test(part));
  const joined = meaningful.length ? meaningful.join(" ") : candidate;
  const normalized = joined
    .replace(/^rcbo/i, "")
    .replace(/^r?cb/i, "")
    .replace(/^ddl/i, "")
    .replace(/^txt/i, "")
    .replace(/^btn/i, "")
    .replace(/^lnk/i, "")
    .replace(/^lbl/i, "");

  return sanitizeIdentifier(normalized);
}

function locatorPropertyBaseName(locator) {
  if (!locator) {
    return "GeneratedLocator";
  }

  if (locator.kind === "expression") {
    const parsed = parseLocatorExpression(locator.expression || "");
    return parsed ? locatorPropertyBaseName(parsed) : "GeneratedLocator";
  }

  if (locator.kind === "role") {
    return sanitizeIdentifier(locator.name || locator.role || "RoleLocator");
  }

  if (locator.kind === "text") {
    return sanitizeIdentifier(locator.text || "TextLocator");
  }

  if (locator.kind === "label") {
    return sanitizeIdentifier(locator.text || "LabelLocator");
  }

  if (locator.kind === "placeholder") {
    return sanitizeIdentifier(locator.text || "PlaceholderLocator");
  }

  if (locator.kind === "title") {
    return sanitizeIdentifier(locator.text || "TitleLocator");
  }

  if (locator.kind === "testid") {
    return sanitizeIdentifier(locator.text || "TestIdLocator");
  }

  if (locator.kind === "locator") {
    return sanitizeIdentifier(locator.filterText || selectorDerivedName(locator.selector || "GeneratedLocator"));
  }

  if (locator.kind === "scopedRole") {
    return sanitizeIdentifier(locator.name || locator.role || "ScopedRoleLocator");
  }

  if (locator.kind === "scopedText") {
    return sanitizeIdentifier(locator.text || "ScopedTextLocator");
  }

  if (locator.kind === "frameRole") {
    return sanitizeIdentifier(locator.name || locator.role || "FrameRoleLocator");
  }

  if (locator.kind === "frameText") {
    return sanitizeIdentifier(locator.text || "FrameTextLocator");
  }

  return "GeneratedLocator";
}

function applyPositionSuffix(name, position) {
  if (!position) {
    return name;
  }

  if (position.type === "first") {
    return `First${name}`;
  }

  if (position.type === "last") {
    return `Last${name}`;
  }

  if (position.type === "nth") {
    return `${name}${position.index + 1}`;
  }

  return name;
}

function buildGeneratedLocatorRegistry(actions, frameworkContext) {
  const expressionToProperty = new Map();
  const usedNames = new Map();
  const actionBindings = new Map();
  const generatedLocators = [];

  for (const action of actions) {
    if (!action.locator) {
      continue;
    }

    const locatorExpression = buildLocatorExpression(action.locator);
    const frameworkReference = frameworkContext
      ? resolveFrameworkLocatorReference(locatorExpression, frameworkContext)
      : null;

    if (frameworkReference) {
      actionBindings.set(action.sourceLine, {
        kind: "framework",
        expression: frameworkReference.expression,
        propertyName: frameworkReference.propertyName,
        className: frameworkReference.className,
        file: frameworkReference.file
      });
      continue;
    }

    if (expressionToProperty.has(locatorExpression)) {
      actionBindings.set(action.sourceLine, expressionToProperty.get(locatorExpression));
      continue;
    }

    const baseName = applyPositionSuffix(locatorPropertyBaseName(action.locator), action.locator.position);
    let propertyName = baseName;
    if (usedNames.has(propertyName)) {
      const nextIndex = usedNames.get(propertyName) + 1;
      usedNames.set(propertyName, nextIndex);
      propertyName = `${propertyName}${nextIndex}`;
    } else {
      usedNames.set(propertyName, 1);
    }

    const binding = {
      kind: "generated",
      propertyName,
      expression: propertyName,
      locatorExpression
    };
    expressionToProperty.set(locatorExpression, binding);
    actionBindings.set(action.sourceLine, binding);
    generatedLocators.push(binding);
  }

  return {
    actionBindings,
    generatedLocators
  };
}

function collectFrameworkDependencies(actions, options) {
  const frameworkContext = buildFrameworkContext(options);
  const dependencies = {
    useCommonActions: false,
    pageElementClasses: new Map(),
    frameworkMatches: []
  };

  for (const action of actions) {
    if (action.actionType === "goto" && frameworkContext.hasCommonActionsPage) {
      dependencies.useCommonActions = true;
      dependencies.frameworkMatches.push({
        sourceLine: action.sourceLine,
        type: "navigation",
        target: "CommonActionsPage.NavigateToURLAsync"
      });
      continue;
    }

    if (!action.locator) {
      continue;
    }

    const locatorExpression = buildLocatorExpression(action.locator);
    const reference = resolveFrameworkLocatorReference(locatorExpression, frameworkContext);
    if (reference) {
      dependencies.pageElementClasses.set(reference.className, reference.fieldName);
      dependencies.frameworkMatches.push({
        sourceLine: action.sourceLine,
        type: "pageElement",
        className: reference.className,
        propertyName: reference.propertyName,
        file: reference.file
      });
    }
  }

  return {
    frameworkContext,
    dependencies
  };
}

function buildActionStatement(action, options) {
  if (!action.supported) {
    return [`            // Unsupported: ${action.raw.trim()}`];
  }

  if (action.actionType === "goto") {
    const resolved = buildUrlExpression(action.value, options.appSettingsPath);
    const lines = [];
    if (resolved.warning) {
      lines.push(`            // Review: ${resolved.warning}`);
    }
    if (options.frameworkDependencies && options.frameworkDependencies.useCommonActions) {
      lines.push(`            await _commonActions.NavigateToURLAsync(${resolved.expression});`);
    } else {
      lines.push(`            await Page.GotoAsync(${resolved.expression});`);
    }
    return lines;
  }

  if (action.actionType === "waitForSelector") {
    return [
      `            await Page.WaitForSelectorAsync(\"${escapeCSharpString(action.locator.selector)}\");`
    ];
  }

  if (action.actionType.startsWith("keyboard.")) {
    const methodName = action.actionType.split(".")[1];
    const mapping = {
      press: "PressAsync",
      type: "TypeAsync",
      insertText: "InsertTextAsync",
      down: "DownAsync",
      up: "UpAsync"
    };
    return [
      `            await Page.Keyboard.${mapping[methodName]}(\"${escapeCSharpString(action.value)}\");`
    ];
  }

  if (action.actionType.startsWith("mouse.")) {
    const methodName = action.actionType.split(".")[1];
    const values = Array.isArray(action.value) ? action.value : [];
    const x = values[0] || "0";
    const y = values[1] || "0";
    if (methodName === "move") {
      return [`            await Page.Mouse.MoveAsync(${x}, ${y});`];
    }

    const mapped = methodName === "dblclick" ? "DblClickAsync" : "ClickAsync";
    return [`            await Page.Mouse.${mapped}(${x}, ${y});`];
  }

  if (["toBeVisible", "toHaveText", "toContainText"].includes(action.actionType)) {
    const locatorBinding = options.locatorBindings
      ? options.locatorBindings.get(action.sourceLine)
      : null;
    const locatorExpression = locatorBinding
      ? locatorBinding.expression
      : buildLocatorExpression(action.locator);
    if (action.actionType === "toBeVisible") {
      return [`            await Assertions.Expect(${locatorExpression}).ToBeVisibleAsync();`];
    }

    if (action.actionType === "toHaveText") {
      return [`            await Assertions.Expect(${locatorExpression}).ToHaveTextAsync("${escapeCSharpString(action.expectedResult)}");`];
    }

    return [`            await Assertions.Expect(${locatorExpression}).ToContainTextAsync("${escapeCSharpString(action.expectedResult)}");`];
  }

  const locatorBinding = options.locatorBindings
    ? options.locatorBindings.get(action.sourceLine)
    : null;
  const locatorExpression = buildLocatorExpression(action.locator);
  const effectiveExpression = locatorBinding ? locatorBinding.expression : locatorExpression;
  const warnings = action.diagnostics.map((message) => `            // Review: ${message}`);
  const methodMap = {
    click: "ClickAsync",
    dblclick: "DblClickAsync",
    hover: "HoverAsync",
    check: "CheckAsync",
    uncheck: "UncheckAsync",
    focus: "FocusAsync"
  };

  if (methodMap[action.actionType]) {
    return [...warnings, `            await ${effectiveExpression}.${methodMap[action.actionType]}();`];
  }

  if (action.actionType === "fill") {
    return [...warnings, `            await ${effectiveExpression}.FillAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "press") {
    return [...warnings, `            await ${effectiveExpression}.PressAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "selectOption") {
    return [...warnings, `            await ${effectiveExpression}.SelectOptionAsync(new[] { "${escapeCSharpString(action.value)}" });`];
  }

  if (action.actionType === "setInputFiles") {
    return [...warnings, `            await ${effectiveExpression}.SetInputFilesAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "waitFor") {
    return [`            await ${effectiveExpression}.WaitForAsync();`];
  }

  return [`            // Unsupported mapping: ${action.raw.trim()}`];
}

function buildCode(actions, options) {
  const { frameworkContext, dependencies } = collectFrameworkDependencies(actions, options);
  const locatorRegistry = buildGeneratedLocatorRegistry(actions, frameworkContext);
  const buildOptions = {
    ...options,
    frameworkContext,
    frameworkDependencies: dependencies,
    locatorBindings: locatorRegistry.actionBindings
  };

  const usingLines = [
    "using System;",
    "using System.Threading.Tasks;",
    "using AutomationFrameWork.Utilities;",
    "using Microsoft.Playwright;"
  ];

  if (dependencies.pageElementClasses.size > 0) {
    usingLines.push("using AutomationFrameWork.PageElements;");
  }

  if (dependencies.useCommonActions) {
    usingLines.push("using AutomationFrameWork.Pages;");
  }

  const fieldLines = [];
  if (dependencies.useCommonActions) {
    fieldLines.push("        private readonly CommonActionsPage _commonActions;", "");
  }

  for (const [className, fieldName] of [...dependencies.pageElementClasses.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    fieldLines.push(`        private readonly ${className} ${fieldName};`);
  }

  if (dependencies.pageElementClasses.size > 0) {
    fieldLines.push("");
  }

  const constructorSetupLines = [];
  if (dependencies.useCommonActions) {
    constructorSetupLines.push("            _commonActions = new CommonActionsPage(Page);");
  }

  for (const [className, fieldName] of [...dependencies.pageElementClasses.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    constructorSetupLines.push(`            ${fieldName} = new ${className}(Page);`);
  }

  const preBodyLines = [
    ...usingLines,
    "",
    "namespace AutomationFrameWork.CodegenAI",
    "{",
    "    public sealed class CodegenRecordedFlow",
    "    {",
    ...fieldLines,
    "        public CodegenRecordedFlow(IPage page, ConfigReader config)",
    "        {",
    "            Page = page ?? throw new ArgumentNullException(nameof(page));",
    "            Config = config ?? throw new ArgumentNullException(nameof(config));",
    ...constructorSetupLines,
    "        }",
    "",
    "        public IPage Page { get; }",
    "",
    "        public ConfigReader Config { get; }",
    ...(
      locatorRegistry.generatedLocators.length > 0
        ? [
            "",
            "        // Locators",
            ...locatorRegistry.generatedLocators.map((locator) => `        public ILocator ${locator.propertyName} => ${locator.locatorExpression};`)
          ]
        : []
    ),
    "",
    "        public async Task ReplayAsync()",
    "        {"
  ];

  const replayMethodStartLine = preBodyLines.length;
  const bodyLines = [];
  const sourceMap = [];

  for (const action of actions) {
    const lines = buildActionStatement(action, buildOptions);
    sourceMap.push({
      sourceLine: action.sourceLine,
      generatedLine: replayMethodStartLine + bodyLines.length + lines.length,
      actionType: action.actionType,
      locatorStrategy: action.locatorStrategy,
      supported: action.supported
    });
    bodyLines.push(...lines);
  }

  return {
    code: [
      ...preBodyLines,
      ...bodyLines,
      "        }",
      "    }",
      "}"
    ].join("\n"),
    sourceMap,
    frameworkMatches: dependencies.frameworkMatches
  };
}

function validateGeneratedCSharp(code, actions) {
  const errors = [];
  const warnings = [];
  const codeWithoutComments = String(code || "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  if (!code.includes("using Microsoft.Playwright;")) {
    errors.push("Missing Microsoft.Playwright using.");
  }

  if (!code.includes("public async Task ReplayAsync()")) {
    errors.push("ReplayAsync method was not generated.");
  }

  if ((code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) {
    errors.push("Generated code has unbalanced braces.");
  }

  if (/\bpage\.(getByRole|getByText|getByLabel|getByPlaceholder|getByTitle|getByTestId|locator|frameLocator|goto|keyboard|mouse)\b/.test(codeWithoutComments)) {
    errors.push("Generated code still contains lowercase TypeScript page references.");
  }

  if (code.includes("TODO_UNRESOLVED")) {
    errors.push("Generated code contains unresolved placeholders.");
  }

  const unsupported = actions.filter((action) => !action.supported);
  if (unsupported.length > 0) {
    warnings.push(`${unsupported.length} recorded action(s) require manual review.`);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

function generateCSharpCode(options) {
  const code = safeRead(options.codeFilePath);
  const actions = parseRecordedActions(code);
  const builtCode = buildCode(actions, options);
  const validation = validateGeneratedCSharp(builtCode.code, actions);
  const unsupportedActions = actions.filter((action) => !action.supported);
  const result = {
    generatedAtUtc: new Date().toISOString(),
    codeFilePath: options.codeFilePath,
    outputFilePath: options.outputFilePath,
    actions,
    unsupportedActions,
    frameworkMatches: builtCode.frameworkMatches,
    sourceMap: builtCode.sourceMap,
    validation,
    code: builtCode.code
  };

  if (options.outputFilePath) {
    fs.mkdirSync(path.dirname(options.outputFilePath), { recursive: true });
    fs.writeFileSync(options.outputFilePath, builtCode.code, "utf8");
  }

  if (options.reportFilePath) {
    fs.mkdirSync(path.dirname(options.reportFilePath), { recursive: true });
    fs.writeFileSync(options.reportFilePath, JSON.stringify({
      generatedAtUtc: result.generatedAtUtc,
      codeFilePath: result.codeFilePath,
      outputFilePath: result.outputFilePath,
      actionCount: result.actions.length,
      frameworkMatches: result.frameworkMatches,
      sourceMap: result.sourceMap,
      unsupportedActions: result.unsupportedActions.map((action) => ({
        sourceLine: action.sourceLine,
        raw: action.raw,
        diagnostics: action.diagnostics
      })),
      validation: result.validation
    }, null, 2), "utf8");
  }

  return result;
}

function runCli() {
  const args = parseArgs(process.argv);
  const codeFilePath = args["code-file"];
  const outputFilePath = args["output-file"];

  if (!codeFilePath || !outputFilePath) {
    console.error("[CSharpCodeGenerator] Missing required arguments --code-file and --output-file");
    process.exit(2);
  }

  const projectRoot = path.resolve(path.dirname(codeFilePath), "..", "..");
  const result = generateCSharpCode({
    codeFilePath,
    outputFilePath,
    reportFilePath: args["report-file"] || "",
    appSettingsPath: args["appsettings-file"] || path.join(projectRoot, "appsettings.json")
  });

  console.log(`[CSharpCodeGenerator] Generated ${path.basename(outputFilePath)} with ${result.actions.length} action(s). unsupported=${result.unsupportedActions.length}`);
  if (!result.validation.success) {
    console.error(`[CSharpCodeGenerator] Validation failed: ${result.validation.errors.join(" | ")}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildCode,
  generateCSharpCode,
  parseRecordedActions,
  validateGeneratedCSharp
};