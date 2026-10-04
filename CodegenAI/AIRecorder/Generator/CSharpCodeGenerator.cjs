const fs = require("fs");
const path = require("path");

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
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
    const entries = [];

    for (const [key, value] of Object.entries(urls)) {
      if (typeof value === "string" && value.trim().length > 0) {
        entries.push({ key, value, source: "legacy" });
      }
    }

    const applications = urls && typeof urls === "object" ? urls.Applications : null;
    if (applications && typeof applications === "object") {
      for (const [key, value] of Object.entries(applications)) {
        if (typeof value === "string" && value.trim().length > 0) {
          entries.push({ key, value, source: "applications" });
        }
      }
    }

    return entries;
  } catch {
    return [];
  }
}

function buildUrlExpression(url, appSettingsPath) {
  const configuredUrls = readConfiguredUrls(appSettingsPath);
  const matched = configuredUrls.find((entry) => entry.value === url);

  if (matched) {
    const expression = matched.source === "applications"
      ? `Config.Urls.TryGetApplication("${escapeCSharpString(matched.key)}")`
      : `Config.Urls.${matched.key}`;

    return {
      expression,
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

function resolveActorName(actor) {
  const normalized = String(actor || "").trim();
  return normalized || "page";
}

function toCSharpActor(actor) {
  const normalized = resolveActorName(actor);
  return normalized === "page" ? "Page" : normalized;
}

function actorToFieldName(actor) {
  const normalized = resolveActorName(actor);
  if (normalized === "page") {
    return "Page";
  }

  const camel = toCamelCase(normalized);
  const safe = /^[A-Za-z_][A-Za-z0-9_]*$/.test(camel) ? camel : "popupPage";
  return `_${safe}`;
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
      regex: /^page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.locator\((['"`])(.+?)\3\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?$/,
      build: (match) => withPosition({ kind: "frameLocator", frameSelector: match[2], selector: match[4] }, match[5])
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

  const actorMatch = line.match(/^await\s+([A-Za-z_$][\w$]*)\./);
  const actor = resolveActorName(actorMatch ? actorMatch[1] : "page");
  const normalizedLine = actorMatch ? line.replace(/^await\s+[A-Za-z_$][\w$]*\./, "await page.") : line;

  const gotoMatch = normalizedLine.match(/^await\s+page\.goto\((['"`])([^'"`]+)\1\);$/);
  if (gotoMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: "goto",
      locatorStrategy: "PAGE_URL",
      value: gotoMatch[2],
      targetElement: "page"
    });
  }

  const waitForSelectorMatch = normalizedLine.match(/^await\s+page\.waitForSelector\((['"`])(.+?)\1\);$/);
  if (waitForSelectorMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: "waitForSelector",
      locatorStrategy: "SELECTOR",
      locator: { kind: "selector", selector: waitForSelectorMatch[2] },
      targetElement: "selector"
    });
  }

  const keyboardMatch = normalizedLine.match(/^await\s+page\.keyboard\.(press|type|insertText|down|up)\((['"`])([^'"`]*)\2\);$/);
  if (keyboardMatch) {
    return createAction(sourceLine, rawLine, {
      actionType: `keyboard.${keyboardMatch[1]}`,
      locatorStrategy: "KEYBOARD",
      value: keyboardMatch[3],
      targetElement: "keyboard"
    });
  }

  const mouseMatch = normalizedLine.match(/^await\s+page\.mouse\.(click|dblclick|move)\(([^\)]*)\);$/);
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

  const expectVisibleMatch = normalizedLine.match(/^await\s+expect\((.+)\)\.(toBeVisible|toContainText|toHaveText)\((?:\s*(['"`])([\s\S]*?)\3\s*)?\);$/);
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
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.locator\((['"`])(.+?)\3\)\.getByText\((['"`])([^'"`]+)\5(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[8],
        locatorStrategy: "FRAME_SCOPED_TEXT",
        locator: {
          kind: "frameScopedText",
          actor,
          frameSelector: matches[2],
          selector: matches[4],
          text: matches[6],
          exact: matches[7] === "true"
        },
        targetElement: "frameScopedText",
        frame: { selector: matches[2] },
        confidence: 0.9
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.locator\((['"`])(.+?)\3\)\.getByRole\((['"`])(\w+)\5,\s*\{\s*name:\s*(['"`])([^'"`]+)\7(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[10],
        locatorStrategy: "FRAME_SCOPED_ROLE",
        locator: {
          kind: "frameScopedRole",
          actor,
          frameSelector: matches[2],
          selector: matches[4],
          role: matches[6],
          name: matches[8],
          exact: matches[9] === "true"
        },
        targetElement: matches[6],
        frame: { selector: matches[2] },
        confidence: 0.9
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.locator\((['"`])(.+?)\3\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "FRAMELOCATOR",
        locator: {
          kind: "frameLocator",
          actor,
          frameSelector: matches[2],
          selector: matches[4],
          position: parseLocatorPosition(matches[5])
        },
        targetElement: "frameLocator",
        frame: { selector: matches[2] },
        confidence: 0.9
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.locator\((['"`])(.+?)\3\)(\.first\(\)|\.last\(\)|\.nth\(\d+\))?\.(fill|press|selectOption|setInputFiles)\((['"`])([\s\S]*?)\7\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "FRAMELOCATOR",
        locator: {
          kind: "frameLocator",
          actor,
          frameSelector: matches[2],
          selector: matches[4],
          position: parseLocatorPosition(matches[5])
        },
        targetElement: "frameLocator",
        value: matches[8],
        frame: { selector: matches[2] },
        confidence: 0.9,
        diagnostics: ["Literal input value preserved from recording. Consider replacing with framework data binding."]
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[8],
        locatorStrategy: "FRAME_ROLE",
        locator: { kind: "frameRole", actor, frameSelector: matches[2], role: matches[4], name: matches[6], exact: matches[7] === "true" },
        targetElement: matches[4],
        frame: { selector: matches[2] },
        confidence: 0.9
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "FRAME_TEXT",
        locator: { kind: "frameText", actor, frameSelector: matches[2], text: matches[4], exact: matches[5] === "true" },
        targetElement: "text",
        frame: { selector: matches[2] },
        confidence: 0.88
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[8],
        locatorStrategy: "SCOPED_ROLE",
        locator: { kind: "scopedRole", actor, selector: matches[2], role: matches[4], name: matches[6], exact: matches[7] === "true" },
        targetElement: matches[4],
        table: detectTableInfo(matches[2]),
        confidence: 0.92
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "SCOPED_TEXT",
        locator: { kind: "scopedText", actor, selector: matches[2], text: matches[4], exact: matches[5] === "true" },
        targetElement: "text",
        table: detectTableInfo(matches[2]),
        confidence: 0.9
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.getByRole\((['"`])(\w+)\1,\s*\{\s*name:\s*(['"`])([^'"`]+)\3(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[6],
        locatorStrategy: "ROLE",
        locator: { kind: "role", actor, role: matches[2], name: matches[4], exact: matches[5] === "true" },
        targetElement: matches[2],
        confidence: 0.95
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.getByText\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck|focus)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: "TEXT",
        locator: { kind: "text", actor, text: matches[2], exact: matches[3] === "true" },
        targetElement: "text",
        confidence: 0.82
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.getByLabel\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(fill|press|focus|click)\((?:\s*(['"`])([\s\S]*?)\5\s*)?\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: "LABEL",
        locator: { kind: "label", actor, text: matches[2], exact: matches[3] === "true" },
        targetElement: "label",
        value: matches[6] || null,
        confidence: 0.92,
        diagnostics: matches[4] === "fill" && matches[6] ? ["Literal input value preserved from recording. Consider replacing with framework data binding."] : []
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)(\.first\(\))?\.(click|dblclick|hover|check|uncheck|focus|waitFor)\(\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[4],
        locatorStrategy: detectTableInfo(matches[2]) ? "TABLE_LOCATOR" : "LOCATOR",
        locator: { kind: "locator", actor, selector: matches[2], first: Boolean(matches[3]) },
        targetElement: "locator",
        table: detectTableInfo(matches[2]),
        confidence: 0.93
      })
    },
    {
      match: normalizedLine.match(/^await\s+page\.locator\((['"`])(.+?)\1\)\.(fill|press|selectOption|setInputFiles)\((['"`])([\s\S]*?)\4\);$/),
      build: (matches) => createAction(sourceLine, rawLine, {
        actionType: matches[3],
        locatorStrategy: detectTableInfo(matches[2]) ? "TABLE_LOCATOR" : "LOCATOR",
        locator: { kind: "locator", actor, selector: matches[2], first: false },
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

  const genericAction = tryParseGenericLocatorAction(normalizedLine, rawLine, sourceLine);
  if (genericAction) {
    if (genericAction.locator && !genericAction.locator.actor) {
      genericAction.locator.actor = actor;
    }
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
    const trimmed = normalizedLine.trim();

    const popupWaitMatch = trimmed.match(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.waitForEvent\((['"`])popup\3\);$/);
    if (popupWaitMatch) {
      actions.push(createAction(index + 1, lines[index], {
        actionType: "popupWait",
        locatorStrategy: "POPUP_WAIT",
        targetElement: "popup",
        popup: {
          promiseVar: popupWaitMatch[1],
          actor: popupWaitMatch[2]
        },
        confidence: 0.95
      }));
      continue;
    }

    const popupResolveMatch = trimmed.match(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+([A-Za-z_$][\w$]*)\s*;$/);
    if (popupResolveMatch) {
      actions.push(createAction(index + 1, lines[index], {
        actionType: "popupResolve",
        locatorStrategy: "POPUP_RESOLVE",
        targetElement: "popup",
        popup: {
          pageVar: popupResolveMatch[1],
          promiseVar: popupResolveMatch[2]
        },
        confidence: 0.95
      }));
      continue;
    }

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

function buildLocatorExpression(locator, actorFieldMap = new Map()) {
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

  const actorName = resolveActorName(locator.actor);
  const actorRef = actorName === "page"
    ? "Page"
    : (actorFieldMap.get(actorName) || toCSharpActor(actorName));

  if (locator.kind === "role") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`${actorRef}.GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "text") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`${actorRef}.GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "label") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`${actorRef}.GetByLabel(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "placeholder") {
    return applyPosition(`${actorRef}.GetByPlaceholder(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "title") {
    return applyPosition(`${actorRef}.GetByTitle(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "testid") {
    return applyPosition(`${actorRef}.GetByTestId(\"${escapeCSharpString(locator.text)}\")`);
  }

  if (locator.kind === "locator") {
    const base = locator.filterText
      ? `${actorRef}.Locator(\"${escapeCSharpString(locator.selector)}\").Filter(new() { HasText = \"${escapeCSharpString(locator.filterText)}\" })`
      : `${actorRef}.Locator(\"${escapeCSharpString(locator.selector)}\")`;
    return applyPosition(base);
  }

  if (locator.kind === "scopedRole") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`${actorRef}.Locator(\"${escapeCSharpString(locator.selector)}\").GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "scopedText") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`${actorRef}.Locator(\"${escapeCSharpString(locator.selector)}\").GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "frameRole") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`${actorRef}.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
  }

  if (locator.kind === "frameText") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`${actorRef}.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "frameLocator") {
    return applyPosition(`${actorRef}.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").Locator(\"${escapeCSharpString(locator.selector)}\")`);
  }

  if (locator.kind === "frameScopedText") {
    const options = locator.exact ? ", new() { Exact = true }" : "";
    return applyPosition(`${actorRef}.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").Locator(\"${escapeCSharpString(locator.selector)}\").GetByText(\"${escapeCSharpString(locator.text)}\"${options})`);
  }

  if (locator.kind === "frameScopedRole") {
    const exactPart = locator.exact ? ", Exact = true" : "";
    return applyPosition(`${actorRef}.FrameLocator(\"${escapeCSharpString(locator.frameSelector)}\").Locator(\"${escapeCSharpString(locator.selector)}\").GetByRole(AriaRole.${inferRoleEnum(locator.role)}, new() { Name = \"${escapeCSharpString(locator.name)}\"${exactPart} })`);
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

  if (locator.kind === "frameLocator") {
    return sanitizeIdentifier(selectorDerivedName(locator.selector || "FrameLocator"));
  }

  if (locator.kind === "frameScopedText") {
    return sanitizeIdentifier(locator.text || "FrameScopedTextLocator");
  }

  if (locator.kind === "frameScopedRole") {
    return sanitizeIdentifier(locator.name || locator.role || "FrameScopedRoleLocator");
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

function buildGeneratedLocatorRegistry(actions, frameworkContext, actorFieldMap) {
  const expressionToProperty = new Map();
  const usedNames = new Map();
  const actionBindings = new Map();
  const generatedLocators = [];

  for (const action of actions) {
    if (!action.locator) {
      continue;
    }

    const locatorExpression = buildLocatorExpression(action.locator, actorFieldMap);
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

    if (action.locator.actor && action.locator.actor !== "page") {
      continue;
    }

    const locatorExpression = buildLocatorExpression(action.locator, options.actorFieldMap || new Map());
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

  if (action.actionType === "popupWait") {
    const popupActor = toCSharpActor(action.popup && action.popup.actor ? action.popup.actor : "page");
    const promiseVar = (action.popup && action.popup.promiseVar) || "popupPromise";
    return [`            var ${promiseVar} = ${popupActor}.WaitForPopupAsync();`];
  }

  if (action.actionType === "popupResolve") {
    const pageVar = (action.popup && action.popup.pageVar) || "popupPage";
    const promiseVar = (action.popup && action.popup.promiseVar) || "popupPromise";
    const pageField = options.actorFieldMap ? options.actorFieldMap.get(pageVar) : null;
    if (pageField) {
      return [`            ${pageField} = await ${promiseVar};`];
    }
    return [`            var ${pageVar} = await ${promiseVar};`];
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
      : buildLocatorExpression(action.locator, options.actorFieldMap || new Map());
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
  const locatorExpression = buildLocatorExpression(action.locator, options.actorFieldMap || new Map());
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
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...warnings, ...split.prefixLines, `            await ${split.callTarget}.${methodMap[action.actionType]}();`];
    }
    return [...warnings, `            await ${effectiveExpression}.${methodMap[action.actionType]}();`];
  }

  if (action.actionType === "fill") {
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...warnings, ...split.prefixLines, `            await ${split.callTarget}.FillAsync("${escapeCSharpString(action.value)}");`];
    }
    return [...warnings, `            await ${effectiveExpression}.FillAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "press") {
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...warnings, ...split.prefixLines, `            await ${split.callTarget}.PressAsync("${escapeCSharpString(action.value)}");`];
    }
    return [...warnings, `            await ${effectiveExpression}.PressAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "selectOption") {
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...warnings, ...split.prefixLines, `            await ${split.callTarget}.SelectOptionAsync(new[] { "${escapeCSharpString(action.value)}" });`];
    }
    return [...warnings, `            await ${effectiveExpression}.SelectOptionAsync(new[] { "${escapeCSharpString(action.value)}" });`];
  }

  if (action.actionType === "setInputFiles") {
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...warnings, ...split.prefixLines, `            await ${split.callTarget}.SetInputFilesAsync("${escapeCSharpString(action.value)}");`];
    }
    return [...warnings, `            await ${effectiveExpression}.SetInputFilesAsync("${escapeCSharpString(action.value)}");`];
  }

  if (action.actionType === "waitFor") {
    const split = buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, options.runtimeState);
    if (split) {
      return [...split.prefixLines, `            await ${split.callTarget}.WaitForAsync();`];
    }
    return [`            await ${effectiveExpression}.WaitForAsync();`];
  }

  return [`            // Unsupported mapping: ${action.raw.trim()}`];
}

function buildInlineLocatorSplit(action, locatorBinding, effectiveExpression, runtimeState) {
  if (!locatorBinding || locatorBinding.kind !== "inline" || !action.locator || !runtimeState) {
    return null;
  }

  const locatorExpression = buildLocatorExpression(action.locator);
  const existing = runtimeState.inlineActorLocators.get(locatorExpression);
  if (existing) {
    return {
      prefixLines: [],
      callTarget: existing
    };
  }

  let baseName = toCamelCase(locatorPropertyBaseName(action.locator));
  if (!baseName || !/^[A-Za-z_]/.test(baseName)) {
    baseName = "popupLocator";
  }

  let name = baseName;
  let suffix = 2;
  while (runtimeState.usedInlineActorNames.has(name)) {
    name = `${baseName}${suffix}`;
    suffix += 1;
  }

  runtimeState.usedInlineActorNames.add(name);
  runtimeState.inlineActorLocators.set(locatorExpression, name);

  return {
    prefixLines: [`            var ${name} = ${effectiveExpression};`],
    callTarget: name
  };
}

function isTrueFlag(value) {
  if (value === true) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function getActionBindingExpression(action, buildOptions) {
  if (!action || !action.locator) {
    return "Page";
  }

  const locatorBinding = buildOptions.locatorBindings
    ? buildOptions.locatorBindings.get(action.sourceLine)
    : null;

  if (locatorBinding && locatorBinding.expression) {
    return locatorBinding.expression;
  }

  return buildLocatorExpression(action.locator, buildOptions.actorFieldMap || new Map());
}

function getPropertyLikeName(expression) {
  const parsed = String(expression || "").trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(parsed)) {
    return parsed;
  }
  return "";
}

function toMethodParameterName(propertyName, fallback) {
  const candidate = toCamelCase(propertyName || fallback || "value");
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate)) {
    return candidate;
  }
  return fallback || "value";
}

function renderMethodBodyForActions(actions, buildOptions, fillArgBySourceLine) {
  const lines = [];
  const includeInteractionWaits = isTrueFlag(buildOptions && buildOptions.enterpriseMode);

  const appendInteractionWaitIfNeeded = (action) => {
    if (!includeInteractionWaits || !action || !action.locator) {
      return;
    }

    if (!["click", "dblclick", "hover", "check", "uncheck", "focus", "fill", "press", "selectOption", "setInputFiles"].includes(action.actionType)) {
      return;
    }

    const effectiveExpression = getActionBindingExpression(action, buildOptions);
    lines.push(`            await Assertions.Expect(${effectiveExpression}).ToBeVisibleAsync();`);
  };

  const appendPostActionWaitIfNeeded = (action) => {
    if (!includeInteractionWaits || !action) {
      return;
    }

    if (action.actionType === "goto") {
      lines.push("            await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);");
      return;
    }

    if (action.actionType !== "click") {
      return;
    }

    const expression = getActionBindingExpression(action, buildOptions);
    if (/(Search|Reassign|Submit|Save|Generate|View|Continue|Apply|Next|Finish|Ok|OK)/i.test(expression)) {
      lines.push("            await Page.WaitForLoadStateAsync(LoadState.NetworkIdle);");
    }
  };

  for (const action of actions) {
    appendInteractionWaitIfNeeded(action);

    if (action.actionType === "fill" && fillArgBySourceLine && fillArgBySourceLine.has(action.sourceLine)) {
      const effectiveExpression = getActionBindingExpression(action, buildOptions);
      const warnings = action.diagnostics.map((message) => `            // Review: ${message}`);
      lines.push(...warnings);
      lines.push(`            await FillInputAsync(${effectiveExpression}, ${fillArgBySourceLine.get(action.sourceLine)});`);
      appendPostActionWaitIfNeeded(action);
      continue;
    }

    const generated = buildActionStatement(action, buildOptions);
    lines.push(...generated);
    appendPostActionWaitIfNeeded(action);
  }

  return lines;
}

function findFirstIndexByActionType(actions, actionTypes) {
  return actions.findIndex((action) => actionTypes.includes(action.actionType));
}

function collectConsecutiveByActionType(actions, startIndex, actionType) {
  const result = [];
  let index = startIndex;
  while (index < actions.length && actions[index].actionType === actionType) {
    result.push(actions[index]);
    index += 1;
  }

  return {
    actions: result,
    endIndexExclusive: index
  };
}

function tryBuildEnterpriseLinearMethods(actions, buildOptions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  const popupExists = actions.some((action) => action.actionType === "popupWait" || action.actionType === "popupResolve");
  if (popupExists) {
    return null;
  }

  const gotoIndexes = actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => entry.action.actionType === "goto")
    .map((entry) => entry.index);

  const lastGotoIndex = gotoIndexes.length > 0 ? gotoIndexes[gotoIndexes.length - 1] : -1;
  const navigationActions = gotoIndexes.map((index) => actions[index]);
  const flowActions = actions.slice(lastGotoIndex + 1);
  if (flowActions.length === 0 && navigationActions.length === 0) {
    return null;
  }

  const firstDataEntryIndex = findFirstIndexByActionType(flowActions, ["fill", "selectOption", "press"]);
  const firstCheckIndex = findFirstIndexByActionType(flowActions, ["check", "uncheck"]);

  let openModuleActions = [];
  let searchActions = [];
  let selectRowsActions = [];
  let finalizeActions = [];

  if (firstDataEntryIndex >= 0) {
    openModuleActions = flowActions.slice(0, firstDataEntryIndex);

    if (firstCheckIndex >= 0 && firstCheckIndex > firstDataEntryIndex) {
      searchActions = flowActions.slice(firstDataEntryIndex, firstCheckIndex);
      const consecutiveChecks = collectConsecutiveByActionType(flowActions, firstCheckIndex, "check");
      const consecutiveUnchecks = collectConsecutiveByActionType(flowActions, firstCheckIndex, "uncheck");
      const longer = consecutiveChecks.actions.length >= consecutiveUnchecks.actions.length ? consecutiveChecks : consecutiveUnchecks;
      selectRowsActions = longer.actions;
      finalizeActions = flowActions.slice(longer.endIndexExclusive);
    } else {
      searchActions = flowActions.slice(firstDataEntryIndex);
    }
  } else if (firstCheckIndex >= 0) {
    openModuleActions = flowActions.slice(0, firstCheckIndex);
    const consecutiveChecks = collectConsecutiveByActionType(flowActions, firstCheckIndex, "check");
    selectRowsActions = consecutiveChecks.actions;
    finalizeActions = flowActions.slice(consecutiveChecks.endIndexExclusive);
  } else {
    openModuleActions = flowActions;
  }

  const methodBlocks = [];
  const replayCalls = [];

  if (navigationActions.length > 0) {
    const firstUrl = String(navigationActions[0].value || "");
    const navName = /investorreporting/i.test(firstUrl)
      ? "NavigateToInvestorReportingAsync"
      : "NavigateToApplicationAsync";

    methodBlocks.push([
      `        public async Task ${navName}()`,
      "        {",
      ...renderMethodBodyForActions(navigationActions, buildOptions),
      "        }"
    ]);
    replayCalls.push(`            await ${navName}();`);
  }

  if (openModuleActions.length > 0) {
    methodBlocks.push([
      "        public async Task OpenTargetModuleAsync()",
      "        {",
      ...renderMethodBodyForActions(openModuleActions, buildOptions),
      "        }"
    ]);
    replayCalls.push("            await OpenTargetModuleAsync();");
  }

  if (searchActions.length > 0) {
    methodBlocks.push([
      "        public async Task ApplySearchCriteriaAsync()",
      "        {",
      ...renderMethodBodyForActions(searchActions, buildOptions),
      "        }"
    ]);
    replayCalls.push("            await ApplySearchCriteriaAsync();");
  }

  if (selectRowsActions.length > 0) {
    methodBlocks.push([
      "        public async Task SelectResultRowsAsync()",
      "        {",
      ...renderMethodBodyForActions(selectRowsActions, buildOptions),
      "        }"
    ]);
    replayCalls.push("            await SelectResultRowsAsync();");
  }

  if (finalizeActions.length > 0) {
    methodBlocks.push([
      "        public async Task CompleteBusinessActionAsync()",
      "        {",
      ...renderMethodBodyForActions(finalizeActions, buildOptions),
      "        }"
    ]);
    replayCalls.push("            await CompleteBusinessActionAsync();");
  }

  if (replayCalls.length === 0) {
    return null;
  }

  return {
    replayLines: replayCalls,
    methodBlocks,
    helperMethod: []
  };
}

function tryBuildEnterpriseMethods(actions, buildOptions) {
  const popupWaitIndex = actions.findIndex((action) => action.actionType === "popupWait");
  const popupResolveIndex = popupWaitIndex >= 0
    ? actions.findIndex((action, index) => index > popupWaitIndex && action.actionType === "popupResolve")
    : -1;

  if (popupWaitIndex < 0 || popupResolveIndex < 0 || popupResolveIndex <= popupWaitIndex) {
    return null;
  }

  const gotoIndexes = actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => entry.action.actionType === "goto")
    .map((entry) => entry.index);

  const lastGotoIndex = gotoIndexes.length > 0 ? gotoIndexes[gotoIndexes.length - 1] : -1;
  const navigationActions = gotoIndexes.map((index) => actions[index]);
  const prePopupActions = actions.slice(lastGotoIndex + 1, popupWaitIndex);
  const popupActions = actions.slice(popupWaitIndex, popupResolveIndex + 1);
  const postPopupActions = actions.slice(popupResolveIndex + 1);

  const prePopupMarkerIndex = prePopupActions.findIndex((action) => {
    const expr = getActionBindingExpression(action, buildOptions);
    return /DealsCompletionStatus/i.test(expr);
  });

  const openDealsActions = prePopupMarkerIndex >= 0
    ? prePopupActions.slice(0, prePopupMarkerIndex + 1)
    : prePopupActions;
  const openReportActions = prePopupMarkerIndex >= 0
    ? prePopupActions.slice(prePopupMarkerIndex + 1)
    : [];

  const saveIndex = postPopupActions.findIndex((action, index) => {
    if (index !== postPopupActions.length - 1) {
      return false;
    }
    const expr = getActionBindingExpression(action, buildOptions);
    return action.actionType === "click" && /(\bOk\b|\bSave\b|\bSubmit\b|\bApply\b)/i.test(expr);
  });

  const saveAction = saveIndex >= 0 ? postPopupActions[saveIndex] : null;
  const updateActions = saveIndex >= 0 ? postPopupActions.slice(0, saveIndex) : postPopupActions;

  const fillActions = updateActions.filter((action) => action.actionType === "fill");
  const fillArgBySourceLine = new Map();
  const fillParameters = [];
  const fillArguments = [];

  for (let index = 0; index < fillActions.length; index += 1) {
    const action = fillActions[index];
    const expression = getActionBindingExpression(action, buildOptions);
    const propertyName = getPropertyLikeName(expression);
    const fallbackName = index === 0 ? "value" : `value${index + 1}`;
    const parameterName = toMethodParameterName(propertyName, fallbackName);
    fillArgBySourceLine.set(action.sourceLine, parameterName);
    fillParameters.push(`string ${parameterName}`);
    fillArguments.push(`"${escapeCSharpString(action.value || "")}"`);
  }

  const methodBlocks = [];
  const replayCalls = [];

  if (navigationActions.length > 0) {
    const firstUrl = String(navigationActions[0].value || "");
    const navName = /investorreporting/i.test(firstUrl)
      ? "NavigateToInvestorReportingAsync"
      : "NavigateToApplicationAsync";
    methodBlocks.push([
      `        public async Task ${navName}()`,
      "        {",
      ...renderMethodBodyForActions(navigationActions, buildOptions),
      "        }"
    ]);
    replayCalls.push(`            await ${navName}();`);
  }

  if (openDealsActions.length > 0) {
    const openDealsMethodName = prePopupMarkerIndex >= 0
      ? "OpenDealsCompletionStatusAsync"
      : "ExecutePrePopupActionsAsync";
    const methodLines = renderMethodBodyForActions(openDealsActions, buildOptions);
    if (prePopupMarkerIndex >= 0) {
      methodLines.push("            await Assertions.Expect(Page).ToHaveURLAsync(new System.Text.RegularExpressions.Regex(\"DealsCompletionStatus\\\\.aspx\", System.Text.RegularExpressions.RegexOptions.IgnoreCase));");
    }
    methodBlocks.push([
      `        public async Task ${openDealsMethodName}()`,
      "        {",
      ...methodLines,
      "        }"
    ]);
    replayCalls.push(`            await ${openDealsMethodName}();`);
  }

  if (openReportActions.length > 0) {
    methodBlocks.push([
      "        public async Task OpenSelectedDealReportAsync()",
      "        {",
      ...renderMethodBodyForActions(openReportActions, buildOptions),
      "        }"
    ]);
    replayCalls.push("            await OpenSelectedDealReportAsync();");
  }

  const popupResolve = popupActions.find((action) => action.actionType === "popupResolve");
  const popupActor = popupResolve && popupResolve.popup && popupResolve.popup.pageVar
    ? resolveActorName(popupResolve.popup.pageVar)
    : "page1";
  const popupField = buildOptions.actorFieldMap.get(popupActor) || actorToFieldName(popupActor);

  const popupMethodLines = renderMethodBodyForActions(popupActions, buildOptions);
  popupMethodLines.push(`            await ${popupField}.WaitForLoadStateAsync(LoadState.DOMContentLoaded);`);

  const popupVisibleAnchor = updateActions.find((action) => action.locator);
  if (popupVisibleAnchor) {
    const anchorExpr = getActionBindingExpression(popupVisibleAnchor, buildOptions);
    popupMethodLines.push(`            await Assertions.Expect(${anchorExpr}).ToBeVisibleAsync();`);
  }
  popupMethodLines.push(`            return ${popupField};`);

  methodBlocks.push([
    "        public async Task<IPage> OpenOverridePopupAsync()",
    "        {",
    ...popupMethodLines,
    "        }"
  ]);
  replayCalls.push("            var popupPage = await OpenOverridePopupAsync();");

  if (updateActions.length > 0) {
    const updateSignature = fillParameters.length > 0
      ? `        public async Task UpdateOverrideDetailsAsync(IPage popupPage, ${fillParameters.join(", ")})`
      : "        public async Task UpdateOverrideDetailsAsync(IPage popupPage)";
    const updateBody = renderMethodBodyForActions(updateActions, buildOptions, fillArgBySourceLine);
    methodBlocks.push([
      updateSignature,
      "        {",
      ...updateBody,
      "        }"
    ]);

    if (fillArguments.length > 0) {
      replayCalls.push(`            await UpdateOverrideDetailsAsync(popupPage, ${fillArguments.join(", ")});`);
    } else {
      replayCalls.push("            await UpdateOverrideDetailsAsync(popupPage);");
    }
  }

  if (saveAction) {
    const saveBody = renderMethodBodyForActions([saveAction], buildOptions);
    saveBody.push("            await popupPage.WaitForLoadStateAsync(LoadState.NetworkIdle);");
    methodBlocks.push([
      "        public async Task SaveOverrideChangesAsync(IPage popupPage)",
      "        {",
      ...saveBody,
      "        }"
    ]);
    replayCalls.push("            await SaveOverrideChangesAsync(popupPage);");
  }

  const helperMethod = fillActions.length > 0
    ? [
        "        private static async Task FillInputAsync(ILocator input, string value)",
        "        {",
        "            await input.ClickAsync();",
        "            await input.FillAsync(value);",
        "            await Assertions.Expect(input).ToHaveValueAsync(value);",
        "        }"
      ]
    : [];

  return {
    replayLines: replayCalls,
    methodBlocks,
    helperMethod
  };
}

function buildCode(actions, options) {
  const actorFieldMap = new Map();
  for (const action of actions) {
    if (action && action.locator && action.locator.actor) {
      const actorName = resolveActorName(action.locator.actor);
      if (actorName !== "page" && !actorFieldMap.has(actorName)) {
        actorFieldMap.set(actorName, actorToFieldName(actorName));
      }
    }

    if (action && action.actionType === "popupResolve" && action.popup && action.popup.pageVar) {
      const popupActor = resolveActorName(action.popup.pageVar);
      if (popupActor !== "page" && !actorFieldMap.has(popupActor)) {
        actorFieldMap.set(popupActor, actorToFieldName(popupActor));
      }
    }
  }

  const { frameworkContext, dependencies } = collectFrameworkDependencies(actions, {
    ...options,
    actorFieldMap
  });
  const locatorRegistry = buildGeneratedLocatorRegistry(actions, frameworkContext, actorFieldMap);
  const buildOptions = {
    ...options,
    frameworkContext,
    frameworkDependencies: dependencies,
    locatorBindings: locatorRegistry.actionBindings,
    actorFieldMap,
    runtimeState: {
      inlineActorLocators: new Map(),
      usedInlineActorNames: new Set()
    }
  };

  const enterpriseMode = isTrueFlag(options.enterpriseMode);

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

  for (const [actorName, fieldName] of [...actorFieldMap.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    fieldLines.push(`        private IPage ${fieldName} = default!;`);
  }

  if (actorFieldMap.size > 0) {
    fieldLines.push("");
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
    ""
  ];

  const sourceMap = [];
  let replayLines = [];
  let methodBlocks = [];
  let helperMethod = [];

  if (enterpriseMode) {
    const enterprise = tryBuildEnterpriseMethods(actions, buildOptions);
    if (enterprise) {
      replayLines = enterprise.replayLines;
      methodBlocks = enterprise.methodBlocks;
      helperMethod = enterprise.helperMethod;
    } else {
      const linearEnterprise = tryBuildEnterpriseLinearMethods(actions, buildOptions);
      if (linearEnterprise) {
        replayLines = linearEnterprise.replayLines;
        methodBlocks = linearEnterprise.methodBlocks;
        helperMethod = linearEnterprise.helperMethod;
      }
    }
  }

  if (replayLines.length === 0) {
    const replayMethodStartLine = preBodyLines.length + 3;
    const bodyLines = [];
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
    replayLines = bodyLines;
  } else {
    for (const action of actions) {
      sourceMap.push({
        sourceLine: action.sourceLine,
        generatedLine: 0,
        actionType: action.actionType,
        locatorStrategy: action.locatorStrategy,
        supported: action.supported
      });
    }
  }

  return {
    code: [
      ...preBodyLines,
      "        public async Task ReplayAsync()",
      "        {",
      ...replayLines,
      "        }",
      ...(methodBlocks.length > 0 ? [""] : []),
      ...methodBlocks.flatMap((block, index) => (index === methodBlocks.length - 1 ? block : [...block, ""])),
      ...(helperMethod.length > 0 ? ["", ...helperMethod] : []),
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
    appSettingsPath: args["appsettings-file"] || path.join(projectRoot, "appsettings.json"),
    enterpriseMode: isTrueFlag(args["enterprise-mode"])
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