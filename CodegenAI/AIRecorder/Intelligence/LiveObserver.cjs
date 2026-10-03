const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

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
      i += 1;
    } else {
      args[name] = "true";
    }
  }

  return args;
}

function toBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function log(enabled, message) {
  if (enabled) {
    console.log(`[LiveObserver] ${message}`);
  }
}

function toNumber(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function trimActionSource(rawLine) {
  return String(rawLine || "")
    .trim()
    .replace(/^await\s+/, "")
    .replace(/\.(click|dblclick|hover|check|uncheck)\(\);\s*$/, "");
}

function describeFrame(frame, mainFrame, index) {
  return {
    index,
    name: frame.name() || null,
    url: frame.url() || null,
    isMainFrame: frame === mainFrame
  };
}

async function safePageTitle(page) {
  try {
    return await page.title();
  } catch {
    return "";
  }
}

async function collectPageState(page) {
  const frames = page.frames();
  const mainFrame = page.mainFrame();

  let readyState = "unknown";
  try {
    readyState = await page.evaluate(() => document.readyState);
  } catch {
    readyState = "unavailable";
  }

  return {
    url: page.url(),
    title: await safePageTitle(page),
    readyState,
    frameCount: frames.length,
    frames: frames.map((frame, index) => describeFrame(frame, mainFrame, index))
  };
}

async function waitForPostActionState(page, options, label) {
  const waitTimeoutMs = toNumber(options.waitTimeoutMs, 8000);

  await page.waitForLoadState("domcontentloaded", { timeout: waitTimeoutMs }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: waitTimeoutMs }).catch(() => undefined);
  await page
    .waitForFunction(
      () => {
        return document.readyState === "complete" || document.readyState === "interactive";
      },
      null,
      { timeout: Math.min(waitTimeoutMs, 5000) }
    )
    .catch(() => undefined);

  await page
    .waitForFunction(
      () => {
        const selectors = [
          "[aria-busy='true']",
          ".loading",
          ".loader",
          ".spinner",
          ".k-loading-mask",
          ".rgLoading",
          ".ajax-loader",
          ".blockUI"
        ];

        const active = selectors.some((selector) => {
          const elements = Array.from(document.querySelectorAll(selector));
          return elements.some((element) => {
            const style = window.getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
          });
        });

        return !active;
      },
      null,
      { timeout: Math.min(waitTimeoutMs, 4000) }
    )
    .catch(() => undefined);

  log(options.debug, `${label}: page settled (dom/network/busy checks).`);
}

function parseCodeActions(code) {
  const lines = code.split(/\r?\n/);
  const actions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("await ")) {
      continue;
    }

    const lineNumber = i + 1;
    const locatorSource = trimActionSource(lines[i]);

    const gotoMatch = line.match(/^await\s+page\.goto\((['"`])([^'"`]+)\1\);$/);
    if (gotoMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        kind: "goto",
        url: gotoMatch[2]
      });
      continue;
    }

    const roleMatch = line.match(
      /^await\s+page\.getByRole\((['"`])(\w+)\1,\s*\{\s*name:\s*(['"`])([^'"`]+)\3(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (roleMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "roleAction",
        role: roleMatch[2],
        name: roleMatch[4],
        exact: roleMatch[5] === "true",
        method: roleMatch[6],
        scope: "page"
      });
      continue;
    }

    const textMatch = line.match(
      /^await\s+page\.getByText\((['"`])([^'"`]+)\1(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (textMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "textAction",
        text: textMatch[2],
        exact: textMatch[3] === "true",
        method: textMatch[4],
        scope: "page"
      });
      continue;
    }

    const frameTextMatch = line.match(
      /^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (frameTextMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "textAction",
        text: frameTextMatch[4],
        exact: frameTextMatch[5] === "true",
        method: frameTextMatch[6],
        frameSelector: frameTextMatch[2],
        scope: "frame"
      });
      continue;
    }

    const frameRoleMatch = line.match(
      /^await\s+page\.locator\((['"`])(.+?)\1\)\.contentFrame\(\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (frameRoleMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "roleAction",
        role: frameRoleMatch[4],
        name: frameRoleMatch[6],
        exact: frameRoleMatch[7] === "true",
        method: frameRoleMatch[8],
        frameSelector: frameRoleMatch[2],
        scope: "frame"
      });
      continue;
    }

    const scopedRoleMatch = line.match(
      /^await\s+page\.locator\((['"`])(.+?)\1\)\.getByRole\((['"`])(\w+)\3,\s*\{\s*name:\s*(['"`])([^'"`]+)\5(?:,\s*exact:\s*(true|false))?\s*\}\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (scopedRoleMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "roleAction",
        role: scopedRoleMatch[4],
        name: scopedRoleMatch[6],
        exact: scopedRoleMatch[7] === "true",
        method: scopedRoleMatch[8],
        parentSelector: scopedRoleMatch[2],
        scope: "page"
      });
      continue;
    }

    const scopedTextMatch = line.match(
      /^await\s+page\.locator\((['"`])(.+?)\1\)\.getByText\((['"`])([^'"`]+)\3(?:,\s*\{\s*exact:\s*(true|false)\s*\})?\)\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (scopedTextMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "textAction",
        text: scopedTextMatch[4],
        exact: scopedTextMatch[5] === "true",
        method: scopedTextMatch[6],
        parentSelector: scopedTextMatch[2],
        scope: "page"
      });
      continue;
    }

    const locatorClickMatch = line.match(
      /^await\s+page\.locator\((['"`])(.+?)\1\)(?:\.first\(\))?\.(click|dblclick|hover|check|uncheck)\(\);$/
    );
    if (locatorClickMatch) {
      actions.push({
        line: lineNumber,
        raw: lines[i],
        locatorSource,
        kind: "locatorAction",
        selector: locatorClickMatch[2],
        method: locatorClickMatch[3],
        scope: "page"
      });
      continue;
    }
  }

  return actions;
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

async function extractContextForLocator(locator, actionDescriptor) {
  const count = await locator.count();
  if (!count) {
    return {
      matchCount: 0,
      insideTable: false
    };
  }

  const context = await locator.first().evaluate((element, payload) => {
    const safeText = (value) =>
      (value || "")
        .replace(/\s+/g, " ")
        .trim();

    const ancestors = [];
    let walker = element;
    while (walker && walker.nodeType === 1) {
      ancestors.push(walker.tagName.toLowerCase());
      walker = walker.parentElement;
    }

    const table = element.closest(
      "table, [role='grid'], .k-grid, .rgMasterTable, [data-grid], [id*='grid' i]"
    );
    const row = element.closest(
      "tr, [role='row'], .k-master-row, .rgRow, .rgAltRow, [data-row]"
    );
    const cell = element.closest(
      "td, th, [role='gridcell'], [role='cell'], .k-table-td, .rgCell, [data-cell]"
    );

    const tableTag = table ? table.tagName.toLowerCase() : null;
    const rowTag = row ? row.tagName.toLowerCase() : null;
    const cellTag = cell ? cell.tagName.toLowerCase() : null;

    const rowCells = row
      ? Array.from(
          row.querySelectorAll(
            ":scope > td, :scope > th, :scope > [role='gridcell'], :scope > [role='cell']"
          )
        )
      : [];

    let columnIndex = null;
    if (cell && rowCells.length) {
      let index = 1;
      for (const candidate of rowCells) {
        const spanRaw = candidate.getAttribute("colspan") || "1";
        const span = Math.max(parseInt(spanRaw, 10) || 1, 1);

        if (candidate === cell) {
          columnIndex = index;
          break;
        }

        index += span;
      }
    }

    const rowValues = rowCells
      .map((item) => safeText(item.textContent || ""))
      .filter((value) => value.length > 0)
      .slice(0, 8);

    const targetText = safeText(payload.text || element.textContent || "");

    const distinctIdLikeValue = rowValues.find((value) => /^\d{3,}$/.test(value) && value !== targetText);
    const idLikeValue = distinctIdLikeValue || rowValues.find((value) => /^\d{3,}$/.test(value));
    const firstValue = rowValues.length ? rowValues[0] : null;
    const alternateValue = rowValues.find((value) => value !== targetText && value.length <= 80) || null;
    const labelValue = rowValues.find((value) => value !== targetText && /:$/.test(value)) || null;

    const businessValue = labelValue || idLikeValue || firstValue || alternateValue || null;

    let businessValueColumnIndex = null;
    if (businessValue && rowCells.length) {
      let index = 1;
      for (const item of rowCells) {
        const value = safeText(item.textContent || "");
        const spanRaw = item.getAttribute("colspan") || "1";
        const span = Math.max(parseInt(spanRaw, 10) || 1, 1);
        if (value === businessValue) {
          businessValueColumnIndex = index;
          break;
        }
        index += span;
      }
    }

    const tableScopedMatchCount = table
      ? table.querySelectorAll("a, button, [role='link'], [role='button']").length
      : 0;

    let sameBusinessRowCount = 0;
    if (table && businessValue) {
      const rows = Array.from(
        table.querySelectorAll("tr, [role='row'], .k-master-row, .rgRow, .rgAltRow")
      );
      for (const item of rows) {
        const text = safeText(item.textContent || "");
        if (text.includes(businessValue)) {
          sameBusinessRowCount += 1;
        }
      }
    }

    const targetTagName = element.tagName.toLowerCase();
    const allSameTagTargets = Array.from((element.ownerDocument || document).querySelectorAll(targetTagName));
    const targetTestId = element.getAttribute("data-testid") || null;
    const targetId = element.id || null;
    const targetClassName = safeText(element.className || "") || null;
    const targetAriaLabel = element.getAttribute("aria-label") || null;
    const targetName = element.getAttribute("name") || null;
    const targetTitle = element.getAttribute("title") || null;
    const targetDataQa = element.getAttribute("data-qa") || null;
    const targetDataTest = element.getAttribute("data-test") || null;

    const countByAttribute = (attributeName, expectedValue) => {
      if (!expectedValue) {
        return 0;
      }

      let count = 0;
      for (const item of allSameTagTargets) {
        const actualValue =
          attributeName === "id"
            ? item.id || ""
            : item.getAttribute(attributeName) || "";
        if (actualValue === expectedValue) {
          count += 1;
        }
      }

      return count;
    };

    return {
      insideTable: Boolean(table),
      ancestors,
      table: table
        ? {
            tagName: tableTag,
            id: table.id || null,
            testId: table.getAttribute("data-testid") || null,
            role: table.getAttribute("role") || null,
            className: table.className || null
          }
        : null,
      row: row
        ? {
            tagName: rowTag,
            id: row.id || null,
            testId: row.getAttribute("data-testid") || null,
            role: row.getAttribute("role") || null,
            className: row.className || null,
            labelValue,
            businessValue,
            businessValueColumnIndex,
            rowValues
          }
        : null,
      cell: cell
        ? {
            tagName: cellTag,
            columnIndex,
            testId: cell.getAttribute("data-testid") || null,
            role: cell.getAttribute("role") || null,
            className: safeText(cell.className || "") || null
          }
        : null,
      target: {
        tagName: targetTagName,
        text: targetText,
        role: element.getAttribute("role") || null,
        testId: targetTestId,
        id: targetId,
        className: targetClassName,
        ariaLabel: targetAriaLabel,
        name: targetName,
        title: targetTitle,
        dataQa: targetDataQa,
        dataTest: targetDataTest,
        attributeCounts: {
          testId: countByAttribute("data-testid", targetTestId),
          id: countByAttribute("id", targetId),
          ariaLabel: countByAttribute("aria-label", targetAriaLabel),
          name: countByAttribute("name", targetName),
          title: countByAttribute("title", targetTitle),
          dataQa: countByAttribute("data-qa", targetDataQa),
          dataTest: countByAttribute("data-test", targetDataTest)
        }
      },
      tableScopedMatchCount,
      sameBusinessRowCount
    };
  }, {
    text: actionDescriptor.text || actionDescriptor.name || ""
  });

  const dynamicRowId = Boolean(context.row && context.row.id && isDynamicId(context.row.id));
  const dynamicTableId = Boolean(context.table && context.table.id && isDynamicId(context.table.id));

  return {
    matchCount: count,
    isUnique: count === 1,
    duplicateText: count > 1,
    insideTable: Boolean(context.insideTable),
    ancestors: context.ancestors || [],
    table: context.table,
    row: context.row,
    cell: context.cell,
    target: context.target,
    tableScopedMatchCount: context.tableScopedMatchCount,
    sameBusinessRowCount: context.sameBusinessRowCount,
    rowId: context.row
      ? {
          value: context.row.id,
          dynamic: dynamicRowId
        }
      : null,
    tableId: context.table
      ? {
          value: context.table.id,
          dynamic: dynamicTableId
        }
      : null
  };
}

function buildLocator(base, action) {
  if (action.kind === "roleAction") {
    const scopedBase = action.parentSelector ? base.locator(action.parentSelector) : base;
    return scopedBase.getByRole(action.role, {
      name: action.name,
      exact: Boolean(action.exact)
    });
  }

  if (action.kind === "textAction") {
    const scopedBase = action.parentSelector ? base.locator(action.parentSelector) : base;
    return scopedBase.getByText(action.text, {
      exact: Boolean(action.exact)
    });
  }

  if (action.kind === "locatorAction") {
    return base.locator(action.selector);
  }

  return null;
}

async function findLocatorInFrames(page, action) {
  const mainFrame = page.mainFrame();
  const candidates = [];

  for (const frame of page.frames()) {
    if (frame === mainFrame) {
      continue;
    }

    const locator = buildLocator(frame, action);
    if (!locator) {
      continue;
    }

    let count = 0;
    try {
      count = await locator.count();
    } catch {
      count = 0;
    }

    candidates.push({
      frame,
      locator,
      count
    });
  }

  return candidates;
}

async function resolveActionLocator(page, action, options) {
  const resolveTimeoutMs = toNumber(options.resolveTimeoutMs, 10000);
  const retryIntervalMs = toNumber(options.retryIntervalMs, 250);
  const startedAt = Date.now();
  const attempts = [];

  while (Date.now() - startedAt < resolveTimeoutMs) {
    const elapsedMs = Date.now() - startedAt;
    const frameCandidates = [];
    const diagnostics = await collectPageState(page);

    if (action.scope === "frame" && action.frameSelector) {
      const explicitFrameLocator = page.frameLocator(action.frameSelector);
      const explicitLocator = buildLocator(explicitFrameLocator, action);
      let explicitCount = 0;
      try {
        explicitCount = await explicitLocator.count();
      } catch {
        explicitCount = 0;
      }

      attempts.push({
        elapsedMs,
        url: diagnostics.url,
        readyState: diagnostics.readyState,
        pageTitle: diagnostics.title,
        frameCount: diagnostics.frameCount,
        mainFrameMatchCount: explicitCount,
        frameMatches: [],
        scope: "frame"
      });

      if (explicitCount > 0) {
        return {
          locator: explicitLocator,
          count: explicitCount,
          resolvedScope: "frame",
          resolvedFrame: {
            selector: action.frameSelector
          },
          attempts,
          elapsedMs,
          diagnostics
        };
      }
    } else {
      const pageLocator = buildLocator(page, action);
      let pageCount = 0;
      try {
        pageCount = await pageLocator.count();
      } catch {
        pageCount = 0;
      }

      const frameResults = await findLocatorInFrames(page, action);
      for (const item of frameResults) {
        frameCandidates.push({
          name: item.frame.name() || null,
          url: item.frame.url() || null,
          matchCount: item.count
        });
      }

      attempts.push({
        elapsedMs,
        url: diagnostics.url,
        readyState: diagnostics.readyState,
        pageTitle: diagnostics.title,
        frameCount: diagnostics.frameCount,
        mainFrameMatchCount: pageCount,
        frameMatches: frameCandidates,
        scope: "page"
      });

      if (pageCount > 0) {
        return {
          locator: pageLocator,
          count: pageCount,
          resolvedScope: "page",
          resolvedFrame: null,
          attempts,
          elapsedMs,
          diagnostics
        };
      }

      const frameMatches = frameResults.filter((item) => item.count > 0);
      if (frameMatches.length === 1) {
        const frameMatch = frameMatches[0];
        return {
          locator: frameMatch.locator,
          count: frameMatch.count,
          resolvedScope: "frame-auto",
          resolvedFrame: {
            name: frameMatch.frame.name() || null,
            url: frameMatch.frame.url() || null
          },
          attempts,
          elapsedMs,
          diagnostics
        };
      }

      if (frameMatches.length > 1) {
        return {
          locator: null,
          count: 0,
          resolvedScope: "unresolved",
          resolvedFrame: null,
          attempts,
          elapsedMs,
          diagnostics,
          reason: "Locator matched in multiple frames and is ambiguous"
        };
      }
    }

    await page.waitForTimeout(retryIntervalMs);
  }

  const diagnostics = await collectPageState(page);
  return {
    locator: null,
    count: 0,
    resolvedScope: "unresolved",
    resolvedFrame: null,
    attempts,
    elapsedMs: Date.now() - startedAt,
    diagnostics,
    reason: "Timeout waiting for locator to be attached"
  };
}

async function buildUnresolvedDebug(page, action, actionIndex, resolution, reasonOverride) {
  const diagnostics = resolution && resolution.diagnostics
    ? resolution.diagnostics
    : await collectPageState(page);

  const lastAttempt = resolution && Array.isArray(resolution.attempts) && resolution.attempts.length
    ? resolution.attempts[resolution.attempts.length - 1]
    : null;

  return {
    actionIndex,
    originalLocator: action.locatorSource || trimActionSource(action.raw),
    currentUrl: diagnostics.url,
    pageTitle: diagnostics.title,
    readyState: diagnostics.readyState,
    frameCount: diagnostics.frameCount,
    frames: diagnostics.frames,
    resolvedScope: resolution ? resolution.resolvedScope : "unresolved",
    resolvedFrame: resolution ? resolution.resolvedFrame : null,
    locatorMatchCount: resolution ? resolution.count : 0,
    attachedState: Boolean((resolution && resolution.count) > 0),
    visibleState: false,
    lastAttempt: lastAttempt || null,
    attempts: (resolution && resolution.attempts) || [],
    reason: reasonOverride || (resolution && resolution.reason) || "Locator did not resolve"
  };
}

async function executeAction(action, locator) {
  if (!locator) {
    return;
  }

  if (typeof locator[action.method] === "function") {
    await locator[action.method]();
  }
}

async function observeRecordedFlow(options) {
  const code = safeRead(options.codeFilePath);
  const actions = parseCodeActions(code);

  const browser = await chromium.launch({
    headless: !options.showBrowser
  });

  const contextOptions = {};
  if (options.storageStateFile && fs.existsSync(options.storageStateFile)) {
    contextOptions.storageState = options.storageStateFile;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const observations = {
    generatedAtUtc: new Date().toISOString(),
    source: {
      codeFilePath: options.codeFilePath
    },
    actions: []
  };

  try {
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      const action = actions[actionIndex];
      try {
        if (action.kind === "goto") {
          log(options.debug, `Line ${action.line}: goto ${action.url}`);
          await page.goto(action.url);
          await waitForPostActionState(page, options, `Line ${action.line}`);

          const pageState = await collectPageState(page);
          observations.actions.push({
            line: action.line,
            raw: action.raw,
            type: "goto",
            page: action.url,
            debug: {
              actionIndex,
              originalLocator: "page.goto(...)",
              currentUrl: pageState.url,
              pageTitle: pageState.title,
              readyState: pageState.readyState,
              frameCount: pageState.frameCount,
              frames: pageState.frames,
              reason: "Navigation replayed"
            }
          });
          continue;
        }

        const resolution = await resolveActionLocator(page, action, options);
        const locator = resolution.locator;
        if (!locator || resolution.count <= 0) {
          const unresolvedDebug = await buildUnresolvedDebug(
            page,
            action,
            actionIndex,
            resolution,
            resolution && resolution.reason
              ? resolution.reason
              : "Target did not become available before timeout"
          );

          observations.actions.push({
            line: action.line,
            raw: action.raw,
            type: action.kind,
            method: action.method,
            text: action.text || action.name || "",
            role: action.role || null,
            scope: action.scope,
            frameSelector: action.frameSelector || null,
            originalLocator: action.locatorSource || trimActionSource(action.raw),
            matchCount: 0,
            isUnique: false,
            duplicateText: false,
            insideTable: false,
            debug: unresolvedDebug,
            error: unresolvedDebug.reason
          });

          log(
            options.debug,
            `Line ${action.line}: unresolved locator. reason=${unresolvedDebug.reason}, url=${unresolvedDebug.currentUrl}`
          );
          continue;
        }

        const contextData = await extractContextForLocator(locator, action);
        const visibleState = await locator.first().isVisible().catch(() => false);
        log(
          options.debug,
          `Line ${action.line}: insideTable=${contextData.insideTable}, matchCount=${contextData.matchCount}`
        );

        const pageState = await collectPageState(page);
        observations.actions.push({
          line: action.line,
          raw: action.raw,
          type: action.kind,
          method: action.method,
          text: action.text || action.name || "",
          role: action.role || null,
          scope: action.scope,
          frameSelector: action.frameSelector || null,
          originalLocator: action.locatorSource || trimActionSource(action.raw),
          ...contextData,
          debug: {
            actionIndex,
            originalLocator: action.locatorSource || trimActionSource(action.raw),
            currentUrl: pageState.url,
            pageTitle: pageState.title,
            readyState: pageState.readyState,
            frameCount: pageState.frameCount,
            frames: pageState.frames,
            resolvedScope: resolution.resolvedScope,
            resolvedFrame: resolution.resolvedFrame,
            locatorMatchCount: resolution.count,
            attachedState: resolution.count > 0,
            visibleState,
            lastAttempt:
              Array.isArray(resolution.attempts) && resolution.attempts.length
                ? resolution.attempts[resolution.attempts.length - 1]
                : null,
            attempts: resolution.attempts,
            reason: "Locator resolved and DOM inspected"
          }
        });

        await executeAction(action, locator.first());
        await waitForPostActionState(page, options, `Line ${action.line}`);
      } catch (error) {
        const unresolvedDebug = await buildUnresolvedDebug(
          page,
          action,
          actionIndex,
          null,
          error instanceof Error ? error.message : String(error)
        );

        observations.actions.push({
          line: action.line,
          raw: action.raw,
          type: action.kind,
          method: action.method,
          text: action.text || action.name || "",
          role: action.role || null,
          scope: action.scope,
          frameSelector: action.frameSelector || null,
          originalLocator: action.locatorSource || trimActionSource(action.raw),
          insideTable: false,
          matchCount: 0,
          isUnique: false,
          debug: unresolvedDebug,
          error: error instanceof Error ? error.message : String(error)
        });

        log(options.debug, `Line ${action.line}: observation failed, continuing with fallback.`);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return observations;
}

async function runCli() {
  const args = parseArgs(process.argv);
  const codeFilePath = args["code-file"];
  const outputFilePath = args["output-file"];

  if (!codeFilePath || !outputFilePath) {
    console.error("[LiveObserver] Missing required arguments --code-file and --output-file");
    process.exit(2);
  }

  const observations = await observeRecordedFlow({
    codeFilePath,
    outputFilePath,
    storageStateFile: args["storage-state-file"] || "",
    showBrowser: toBoolean(args["show-browser"]),
    debug: toBoolean(args.debug),
    waitTimeoutMs: args["wait-timeout-ms"],
    resolveTimeoutMs: args["resolve-timeout-ms"],
    retryIntervalMs: args["retry-interval-ms"]
  });

  fs.writeFileSync(outputFilePath, JSON.stringify(observations, null, 2), "utf8");
  console.log(`[LiveObserver] Observation completed. captured=${observations.actions.length}`);
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error("[LiveObserver] Failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  parseCodeActions,
  extractContextForLocator,
  observeRecordedFlow,
  isDynamicId
};
