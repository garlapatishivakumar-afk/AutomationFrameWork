const Status = {
  PASS: "PASS",
  WARNING: "WARNING",
  BLOCKED: "BLOCKED"
};

function extractMethodBlocks(code) {
  const source = String(code || "");
  const methods = [];

  const signatureRegex = /(public|private|protected|internal)\s+(async\s+)?([A-Za-z_][A-Za-z0-9_<>\[\]\?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^\)]*)\)\s*\{/g;
  let match;

  while ((match = signatureRegex.exec(source)) !== null) {
    const startBraceIndex = source.indexOf("{", match.index);
    if (startBraceIndex < 0) {
      continue;
    }

    let depth = 0;
    let endBraceIndex = -1;
    for (let index = startBraceIndex; index < source.length; index += 1) {
      const token = source[index];
      if (token === "{") {
        depth += 1;
      } else if (token === "}") {
        depth -= 1;
        if (depth === 0) {
          endBraceIndex = index;
          break;
        }
      }
    }

    if (endBraceIndex < 0) {
      continue;
    }

    const signature = match[0];
    const body = source.slice(startBraceIndex + 1, endBraceIndex);
    methods.push({
      accessModifier: match[1],
      isAsync: Boolean(match[2]),
      returnType: String(match[3] || "").trim(),
      name: String(match[4] || "").trim(),
      parameters: String(match[5] || "").trim(),
      signature,
      body,
      startIndex: match.index,
      endIndex: endBraceIndex
    });
  }

  return methods;
}

function stripCommentsPreserveStrings(value) {
  const source = String(value || "");
  let result = "";
  let index = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;
  let inVerbatimString = false;
  let inChar = false;
  let escaped = false;

  while (index < source.length) {
    const current = source[index];
    const next = index + 1 < source.length ? source[index + 1] : "";

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        result += current;
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 2;
      } else {
        if (current === "\n") {
          result += current;
        }
        index += 1;
      }
      continue;
    }

    if (inVerbatimString) {
      result += current;
      if (current === '"') {
        if (next === '"') {
          result += next;
          index += 2;
          continue;
        }
        inVerbatimString = false;
      }
      index += 1;
      continue;
    }

    if (inString) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (inChar) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === "'") {
        inChar = false;
      }
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (current === "/" && next === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (current === "@" && next === '"') {
      inVerbatimString = true;
      result += current;
      result += next;
      index += 2;
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      index += 1;
      continue;
    }

    if (current === "'") {
      inChar = true;
      result += current;
      index += 1;
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

function stripCommentsAndWhitespace(value) {
  return stripCommentsPreserveStrings(value).trim();
}

function stripStringsAndChars(value) {
  return String(value || "")
    .replace(/@"(?:""|[^"])*"/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])'/g, "''");
}

function sanitizeForHeuristics(value) {
  return stripStringsAndChars(stripCommentsAndWhitespace(value));
}

function normalizeActionSequence(body) {
  return stripCommentsAndWhitespace(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function hasPlaywrightAsyncCall(body) {
  const text = sanitizeForHeuristics(body);
  return /\.\s*(ClickAsync|FillAsync|PressAsync|HoverAsync|CheckAsync|UncheckAsync|WaitForAsync|GotoAsync|SelectOptionAsync|SetInputFilesAsync|ToBeVisibleAsync|ToHaveTextAsync|ToContainTextAsync)\s*\(/.test(text);
}

function hasHardcodedUrl(body) {
  const text = stripCommentsAndWhitespace(body);
  return /https?:\/\//i.test(text);
}

function hasHardcodedDownloadPath(body) {
  const text = stripCommentsAndWhitespace(body);
  return /([A-Za-z]:\\|\\\\|\/)(?:Users|Downloads|Desktop|Temp|tmp)\//i.test(text.replace(/\\/g, "/"));
}

function methodNameLooksPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(String(name || ""));
}

function inferStatusFromRules(ruleResults) {
  if (ruleResults.some((rule) => rule.status === Status.BLOCKED)) {
    return Status.BLOCKED;
  }

  if (ruleResults.some((rule) => rule.status === Status.WARNING)) {
    return Status.WARNING;
  }

  return Status.PASS;
}

function scoreFromRules(ruleResults) {
  let score = 100;
  for (const rule of ruleResults) {
    if (rule.status === Status.BLOCKED) {
      score -= 20;
    } else if (rule.status === Status.WARNING) {
      score -= 8;
    }
  }

  return Math.max(0, score);
}

function createRule(ruleId, status, message, methodName) {
  return { ruleId, status, message, methodName: methodName || "" };
}

function detectMalformedMethodSignatures(code) {
  const source = stripCommentsAndWhitespace(code);
  const lines = source.split(/\r?\n/);
  const classNames = new Set();
  const classRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let classMatch;

  while ((classMatch = classRegex.exec(source)) !== null) {
    classNames.add(classMatch[1]);
  }

  const issues = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^(public|private|protected|internal)\s+/.test(trimmed)) {
      continue;
    }

    if (!trimmed.includes("(") || !trimmed.includes(")")) {
      continue;
    }

    const rest = trimmed.replace(/^(public|private|protected|internal)\s+/, "");

    const constructorMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (constructorMatch && classNames.has(constructorMatch[1])) {
      continue;
    }

    if (/^async\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(rest)) {
      issues.push(trimmed);
      continue;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(rest)) {
      issues.push(trimmed);
      continue;
    }

    const hasNameOnlyPattern = /^(public|private|protected|internal)\s+(async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/.test(trimmed);
    const hasValidMethodPattern = /^(public|private|protected|internal)\s+(async\s+)?([A-Za-z_][A-Za-z0-9_<>\[\]\?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.test(trimmed);

    if (hasNameOnlyPattern && !hasValidMethodPattern) {
      issues.push(trimmed);
    }
  }

  return issues;
}

function evaluateMethodQuality(code, options = {}) {
  const methods = extractMethodBlocks(code);
  const ruleResults = [];
  const methodResults = [];
  const blockHardcodedUrl = options.blockHardcodedUrl === true;
  const blockHardcodedDownloadPath = options.blockHardcodedDownloadPath === true;

  const malformedSignatures = detectMalformedMethodSignatures(code);
  for (const signature of malformedSignatures) {
    ruleResults.push(createRule("MQG006", Status.BLOCKED, `Missing or invalid return type in signature: ${signature}`));
  }

  const methodNameToIndices = new Map();
  const locatorNameToExpression = new Map();
  const locatorExpressionToName = new Map();
  const sequenceToMethod = new Map();

  const locatorRegex = /public\s+ILocator\s+([A-Za-z_][A-Za-z0-9_]*)\s*=>\s*([^;]+);/g;
  let locatorMatch;
  while ((locatorMatch = locatorRegex.exec(String(code || ""))) !== null) {
    const name = locatorMatch[1];
    const expression = stripCommentsAndWhitespace(locatorMatch[2]);

    if (locatorNameToExpression.has(name)) {
      const previous = locatorNameToExpression.get(name);
      if (previous === expression) {
        ruleResults.push(createRule("MQG008", Status.BLOCKED, `Duplicate locator property '${name}' with exact expression duplicate.`));
      } else {
        ruleResults.push(createRule("MQG008", Status.WARNING, `Duplicate locator property '${name}' has conflicting expressions.`));
      }
    }

    if (locatorExpressionToName.has(expression) && locatorExpressionToName.get(expression) !== name) {
      ruleResults.push(createRule("MQG008", Status.WARNING, `Locator expression reused across properties '${locatorExpressionToName.get(expression)}' and '${name}'.`));
    }

    locatorNameToExpression.set(name, expression);
    if (!locatorExpressionToName.has(expression)) {
      locatorExpressionToName.set(expression, name);
    }
  }

  methods.forEach((method, index) => {
    if (!methodNameToIndices.has(method.name)) {
      methodNameToIndices.set(method.name, []);
    }
    methodNameToIndices.get(method.name).push(index);

    const localRules = [];
    const cleanedBody = stripCommentsAndWhitespace(method.body);

    if (!method.name) {
      localRules.push(createRule("MQG001", Status.BLOCKED, "Method name is missing.", method.name));
    }

    if (!methodNameLooksPascalCase(method.name)) {
      localRules.push(createRule("MQG002", Status.WARNING, `Method '${method.name}' does not follow PascalCase naming.`, method.name));
    }

    if (!cleanedBody) {
      localRules.push(createRule("MQG003", Status.BLOCKED, `Method '${method.name}' has an empty body.`, method.name));
    }

    const usesAwait = /\bawait\b/.test(sanitizeForHeuristics(method.body));
    const hasAsyncPlaywright = hasPlaywrightAsyncCall(method.body);

    if (!method.isAsync && (usesAwait || hasAsyncPlaywright)) {
      localRules.push(createRule("MQG004", Status.BLOCKED, `Method '${method.name}' uses async Playwright operation in non-async method.`, method.name));
    }

    const returnType = String(method.returnType || "").trim();
    if (!returnType) {
      localRules.push(createRule("MQG006", Status.BLOCKED, `Method '${method.name}' has missing return type.`, method.name));
    }

    if (method.isAsync && !/^Task(<.*>)?$/.test(returnType)) {
      localRules.push(createRule("MQG007", Status.BLOCKED, `Method '${method.name}' is async but return type '${returnType}' is not Task/Task<T>.`, method.name));
    }

    if (/\bThread\.Sleep\s*\(/.test(sanitizeForHeuristics(method.body))) {
      localRules.push(createRule("MQG010", Status.BLOCKED, `Method '${method.name}' uses Thread.Sleep.`, method.name));
    }

    if (hasHardcodedUrl(method.body)) {
      localRules.push(createRule("MQG011", blockHardcodedUrl ? Status.BLOCKED : Status.WARNING, `Method '${method.name}' contains hard-coded URL.`, method.name));
    }

    if (hasHardcodedDownloadPath(method.body)) {
      localRules.push(createRule("MQG012", blockHardcodedDownloadPath ? Status.BLOCKED : Status.WARNING, `Method '${method.name}' contains hard-coded local download path.`, method.name));
    }

    const normalizedSequence = normalizeActionSequence(method.body);
    if (normalizedSequence) {
      if (sequenceToMethod.has(normalizedSequence)) {
        localRules.push(createRule("MQG013", Status.WARNING, `Method '${method.name}' repeats action sequence from method '${sequenceToMethod.get(normalizedSequence)}'.`, method.name));
      } else {
        sequenceToMethod.set(normalizedSequence, method.name);
      }
    }

    methodResults.push({
      name: method.name,
      status: inferStatusFromRules(localRules),
      rules: localRules,
      isAsync: method.isAsync,
      returnType
    });

    ruleResults.push(...localRules);
  });

  for (const [name, indices] of methodNameToIndices.entries()) {
    if (indices.length > 1) {
      ruleResults.push(createRule("MQG005", Status.BLOCKED, `Duplicate method name '${name}' found ${indices.length} times.`, name));
    }
  }

  const methodUsages = new Map();
  methods.forEach((method) => methodUsages.set(method.name, 0));

  methods.forEach((method) => {
    for (const other of methods) {
      if (method.name === other.name) {
        continue;
      }

      const invocationRegex = new RegExp(`\\b${other.name}\\s*\\(`, "g");
      const matches = method.body.match(invocationRegex);
      if (matches && methodUsages.has(other.name)) {
        methodUsages.set(other.name, methodUsages.get(other.name) + matches.length);
      }
    }
  });

  for (const method of methods) {
    if (method.name === "ReplayAsync") {
      continue;
    }

    const usageCount = methodUsages.get(method.name) || 0;
    if (usageCount === 0) {
      ruleResults.push(createRule("MQG009", Status.WARNING, `Method '${method.name}' appears unused in generated flow.`, method.name));
    }
  }

  const status = inferStatusFromRules(ruleResults);
  return {
    status,
    blocking: status === Status.BLOCKED,
    score: scoreFromRules(ruleResults),
    rules: ruleResults,
    methods: methodResults
  };
}

module.exports = {
  Status,
  evaluateMethodQuality
};
