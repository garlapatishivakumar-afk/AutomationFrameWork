const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { parseRecordedActions } = require("../Generator/CSharpCodeGenerator.cjs");

function safeRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function inferCodeFilePath(sourceFile, explicitCodeFilePath) {
  if (explicitCodeFilePath && fs.existsSync(explicitCodeFilePath)) {
    return explicitCodeFilePath;
  }

  if (!sourceFile) {
    return "";
  }

  const sibling = path.join(path.dirname(sourceFile), "Code.ts");
  return fs.existsSync(sibling) ? sibling : "";
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((item) => item.length >= 2);
}

function similarity(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function applyPosition(locator, position) {
  if (!position) {
    return locator;
  }

  if (position.type === "first") {
    return locator.first();
  }

  if (position.type === "last") {
    return locator.last();
  }

  if (position.type === "nth") {
    return locator.nth(position.index);
  }

  return locator;
}

function buildLocator(base, locator) {
  if (!locator) {
    return null;
  }

  let built = null;

  switch (locator.kind) {
    case "role":
      built = base.getByRole(locator.role, { name: locator.name, exact: Boolean(locator.exact) });
      break;
    case "text":
      built = base.getByText(locator.text, { exact: Boolean(locator.exact) });
      break;
    case "label":
      built = base.getByLabel(locator.text, { exact: Boolean(locator.exact) });
      break;
    case "placeholder":
      built = base.getByPlaceholder(locator.text);
      break;
    case "title":
      built = base.getByTitle(locator.text);
      break;
    case "testid":
      built = base.getByTestId(locator.text);
      break;
    case "locator": {
      built = base.locator(locator.selector);
      if (locator.filterText) {
        built = built.filter({ hasText: locator.filterText });
      }
      break;
    }
    case "scopedRole":
      built = base.locator(locator.selector).getByRole(locator.role, { name: locator.name, exact: Boolean(locator.exact) });
      break;
    case "scopedText":
      built = base.locator(locator.selector).getByText(locator.text, { exact: Boolean(locator.exact) });
      break;
    case "frameRole":
      built = base.frameLocator(locator.frameSelector).getByRole(locator.role, { name: locator.name, exact: Boolean(locator.exact) });
      break;
    case "frameText":
      built = base.frameLocator(locator.frameSelector).getByText(locator.text, { exact: Boolean(locator.exact) });
      break;
    default:
      built = null;
      break;
  }

  return built ? applyPosition(built, locator.position) : null;
}

async function waitForPageSettled(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
}

async function executeRecordedAction(page, action) {
  if (action.actionType === "goto") {
    await page.goto(action.value, { waitUntil: "domcontentloaded" });
    await waitForPageSettled(page);
    return;
  }

  const locator = buildLocator(page, action.locator);
  if (!locator) {
    return;
  }

  switch (action.actionType) {
    case "click":
      await locator.click();
      break;
    case "dblclick":
      await locator.dblclick();
      break;
    case "hover":
      await locator.hover();
      break;
    case "check":
      await locator.check();
      break;
    case "uncheck":
      await locator.uncheck();
      break;
    case "focus":
      await locator.focus();
      break;
    case "fill":
      await locator.fill(action.value || "");
      break;
    case "press":
      await locator.press(action.value || "Enter");
      break;
    case "selectOption":
      await locator.selectOption(action.value || "");
      break;
    case "setInputFiles":
      await locator.setInputFiles(action.value || "");
      break;
    case "waitFor":
      await locator.waitFor();
      break;
    default:
      break;
  }

  await waitForPageSettled(page);
}

function inferRole(tagName, explicitRole, type) {
  if (explicitRole) {
    return explicitRole;
  }

  const tag = normalize(tagName);
  const inputType = normalize(type);

  if (tag === "button") {
    return "button";
  }
  if (tag === "a") {
    return "link";
  }
  if (tag === "select") {
    return "combobox";
  }
  if (tag === "textarea") {
    return "textbox";
  }
  if (tag === "input" && ["button", "submit", "reset"].includes(inputType)) {
    return "button";
  }
  if (tag === "input" && inputType === "checkbox") {
    return "checkbox";
  }
  if (tag === "input" && inputType === "radio") {
    return "radio";
  }
  if (tag === "input") {
    return "textbox";
  }

  return tag || "element";
}

async function resolveFrameSelectors(page) {
  const selectors = new Map();
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) {
      selectors.set(frame, null);
      continue;
    }

    try {
      const frameElement = await frame.frameElement();
      const descriptor = await frameElement.evaluate((element) => {
        const id = element.getAttribute("id");
        const name = element.getAttribute("name");
        const src = element.getAttribute("src");
        if (id) {
          return `#${id}`;
        }
        if (name) {
          return `iframe[name="${name.replace(/"/g, '\\"')}"]`;
        }
        if (src) {
          return `iframe[src="${src.replace(/"/g, '\\"')}"]`;
        }
        return "iframe";
      });
      selectors.set(frame, descriptor || "iframe");
    } catch {
      selectors.set(frame, "iframe");
    }
  }

  return selectors;
}

async function collectCandidatesFromPage(page, pageKind) {
  const frameSelectors = await resolveFrameSelectors(page);
  const collected = [];

  for (const frame of page.frames()) {
    try {
      const entries = await frame.evaluate(() => {
        const toText = (value) => (value || "").replace(/\s+/g, " ").trim();
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        };
        const describe = (element) => {
          const tagName = element.tagName.toLowerCase();
          const type = element.getAttribute("type") || "";
          const role = element.getAttribute("role") || "";
          const text = toText(element.innerText || element.textContent || element.value || "");
          const ariaLabel = element.getAttribute("aria-label") || "";
          const title = element.getAttribute("title") || "";
          const placeholder = element.getAttribute("placeholder") || "";
          const name = ariaLabel || text || title || placeholder || element.getAttribute("value") || "";
          const outerHTML = element.outerHTML.slice(0, 500);
          return {
            tagName,
            type,
            role,
            text,
            name,
            ariaLabel,
            title,
            placeholder,
            testId: element.getAttribute("data-testid") || "",
            id: element.id || "",
            className: toText(element.className || ""),
            visible: visible(element),
            outerHTML
          };
        };

        return Array.from(document.querySelectorAll("a,button,input,select,textarea,[role],[data-testid],[title],[placeholder],[aria-label]"))
          .map(describe)
          .filter((entry) => entry.visible && (entry.name || entry.testId || entry.id || entry.title || entry.placeholder));
      });

      for (const entry of entries) {
        collected.push({
          ...entry,
          inferredRole: inferRole(entry.tagName, entry.role, entry.type),
          pageKind,
          pageUrl: page.url(),
          frameName: frame === page.mainFrame() ? null : frame.name() || null,
          frameUrl: frame.url() || null,
          frameSelector: frameSelectors.get(frame),
          isMainFrame: frame === page.mainFrame()
        });
      }
    } catch {
      continue;
    }
  }

  return collected;
}

async function collectCandidates(page, popupPages) {
  const primary = await collectCandidatesFromPage(page, "main");
  const popup = [];
  for (const popupPage of popupPages || []) {
    popup.push(...await collectCandidatesFromPage(popupPage, "popup"));
  }
  return [...primary, ...popup];
}

async function countLocator(locator) {
  try {
    return await locator.count();
  } catch {
    return 0;
  }
}

async function countMatchesForPage(page, action, pageKind) {
  const pageLocator = buildLocator(page, action.locator);
  const pageCount = pageLocator ? await countLocator(pageLocator) : 0;
  const frameMatches = [];

  if (action.locator && !["frameRole", "frameText"].includes(action.locator.kind)) {
    const frameSelectors = await resolveFrameSelectors(page);
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) {
        continue;
      }

      const locator = buildLocator(frame, action.locator);
      if (!locator) {
        continue;
      }

      const count = await countLocator(locator);
      if (count > 0) {
        frameMatches.push({
          name: frame.name() || null,
          url: frame.url() || null,
          frameSelector: frameSelectors.get(frame),
          count
        });
      }
    }
  }

  return {
    pageKind,
    pageCount,
    frameMatches,
    totalCount: pageCount + frameMatches.reduce((sum, item) => sum + item.count, 0)
  };
}

async function countRecordedActionMatches(page, action, popupPages) {
  const primary = await countMatchesForPage(page, action, "main");
  const popupMatches = [];
  for (const popupPage of popupPages || []) {
    popupMatches.push(await countMatchesForPage(popupPage, action, "popup"));
  }

  return {
    pageCount: primary.pageCount,
    frameMatches: primary.frameMatches,
    popupMatches,
    totalCount: primary.totalCount + popupMatches.reduce((sum, item) => sum + item.totalCount, 0)
  };
}

async function collectPageState(page) {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    url: page.url(),
    title,
    bodyText: String(bodyText || "").slice(0, 4000)
  };
}

function detectApplicationError(pageState) {
  const haystack = `${pageState.title}\n${pageState.bodyText}`.toLowerCase();
  const indicators = [];
  const patterns = [
    "internal server error",
    "server error",
    "an error occurred",
    "back to homepage",
    "service unavailable",
    "bad gateway",
    "page cannot be displayed"
  ];

  for (const pattern of patterns) {
    if (haystack.includes(pattern)) {
      indicators.push(pattern);
    }
  }

  return {
    detected: indicators.length > 0,
    indicators
  };
}

function chooseBestCandidate(action, candidates, matchCounts) {
  const desiredName = action.locator && (action.locator.name || action.locator.text) ? action.locator.name || action.locator.text : "";
  const desiredRole = action.locator && action.locator.role ? normalize(action.locator.role) : "";

  const scoped = candidates.filter((candidate) => {
    if (!candidate.visible) {
      return false;
    }
    if (!desiredRole) {
      return true;
    }
    return normalize(candidate.inferredRole) === desiredRole;
  });

  const pool = scoped.length ? scoped : candidates;
  const ranked = pool
    .map((candidate) => {
      const nameSimilarity = similarity(desiredName, candidate.name || candidate.text || candidate.title || candidate.placeholder);
      let score = 0;
      if (desiredRole && normalize(candidate.inferredRole) === desiredRole) {
        score += 30;
      }
      score += Math.round(nameSimilarity * 25);
      if (candidate.testId) {
        score += 20;
      }
      if (candidate.title) {
        score += 8;
      }
      if (candidate.placeholder) {
        score += 6;
      }
      if (candidate.frameSelector) {
        score += 5;
      }
      if (candidate.pageKind === "popup") {
        score += 7;
      }

      const roleNameKey = `${normalize(candidate.inferredRole)}|${normalize(candidate.name)}`;
      const uniqueRoleName = matchCounts.roleName.get(roleNameKey) === 1;
      const uniqueText = matchCounts.text.get(normalize(candidate.text)) === 1;
      const uniqueTitle = matchCounts.title.get(normalize(candidate.title)) === 1;
      const uniquePlaceholder = matchCounts.placeholder.get(normalize(candidate.placeholder)) === 1;
      const uniqueTestId = matchCounts.testId.get(normalize(candidate.testId)) === 1;

      let strategy = null;
      let value = null;

      if (candidate.testId && uniqueTestId) {
        strategy = "testid";
        value = candidate.testId;
        score += 40;
      } else if (candidate.name && uniqueRoleName && candidate.inferredRole) {
        strategy = "role";
        value = candidate.name;
        score += 30;
      } else if (candidate.ariaLabel) {
        strategy = "label";
        value = candidate.ariaLabel;
        score += 20;
      } else if (candidate.placeholder && uniquePlaceholder) {
        strategy = "placeholder";
        value = candidate.placeholder;
        score += 18;
      } else if (candidate.title && uniqueTitle) {
        strategy = "title";
        value = candidate.title;
        score += 16;
      } else if (candidate.id) {
        strategy = "css-id";
        value = candidate.id;
        score += 14;
      } else if (candidate.text && uniqueText) {
        strategy = "text";
        value = candidate.text;
        score += 10;
      }

      return {
        ...candidate,
        score,
        similarity: nameSimilarity,
        chosenStrategy: strategy,
        chosenValue: value,
        isUnique: Boolean(strategy)
      };
    })
    .filter((candidate) => candidate.chosenStrategy)
    .sort((left, right) => right.score - left.score);

  return ranked.length ? ranked[0] : null;
}

function buildMatchCounts(candidates) {
  const maps = {
    roleName: new Map(),
    text: new Map(),
    title: new Map(),
    placeholder: new Map(),
    testId: new Map()
  };

  for (const candidate of candidates) {
    const increment = (map, key) => {
      if (!key) {
        return;
      }
      map.set(key, (map.get(key) || 0) + 1);
    };

    increment(maps.roleName, `${normalize(candidate.inferredRole)}|${normalize(candidate.name)}`);
    increment(maps.text, normalize(candidate.text));
    increment(maps.title, normalize(candidate.title));
    increment(maps.placeholder, normalize(candidate.placeholder));
    increment(maps.testId, normalize(candidate.testId));
  }

  return maps;
}

function buildRelevantHtml(pageState, candidate) {
  if (candidate && candidate.outerHTML) {
    return candidate.outerHTML;
  }

  return pageState.bodyText.slice(0, 1000);
}

async function collectBrowserEvidence(options) {
  const codeFilePath = inferCodeFilePath(options.sourceFile, options.codeFilePath);
  if (!codeFilePath) {
    return {
      codeFilePath: "",
      available: false,
      reason: "Code.ts file not found for browser evidence replay."
    };
  }

  const actions = parseRecordedActions(safeRead(codeFilePath));
  const targetAction = actions.find((action) => Number(action.sourceLine) === Number(options.recordedSourceLine));
  if (!targetAction) {
    return {
      codeFilePath,
      available: false,
      reason: `No recorded action found for Code.ts line ${options.recordedSourceLine}.`
    };
  }

  const browser = await chromium.launch({ headless: true });
  const contextOptions = {};
  if (options.storageStateFile && fs.existsSync(options.storageStateFile)) {
    contextOptions.storageState = options.storageStateFile;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const popupPages = [];
  const dialogEvents = [];

  const attachPageListeners = (candidatePage) => {
    candidatePage.on("dialog", async (dialog) => {
      dialogEvents.push({
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
        pageUrl: candidatePage.url()
      });
      await dialog.dismiss().catch(() => undefined);
    });
  };

  attachPageListeners(page);
  context.on("page", async (popupPage) => {
    popupPages.push(popupPage);
    attachPageListeners(popupPage);
    await popupPage.waitForLoadState("domcontentloaded").catch(() => undefined);
  });

  try {
    for (const action of actions.filter((item) => item.sourceLine < targetAction.sourceLine)) {
      await executeRecordedAction(page, action).catch(() => undefined);
    }

    const pageState = await collectPageState(page);
    const immediate = await countRecordedActionMatches(page, targetAction, popupPages);
    const delayMs = Number(options.inspectionDelayMs || 1200);
    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }
    const delayed = await countRecordedActionMatches(page, targetAction, popupPages);
    const candidates = await collectCandidates(page, popupPages);
    const matchCounts = buildMatchCounts(candidates);
    const topCandidate = chooseBestCandidate(targetAction, candidates, matchCounts);
    const applicationError = detectApplicationError(pageState);

    return {
      available: true,
      codeFilePath,
      recordedAction: {
        sourceLine: targetAction.sourceLine,
        actionType: targetAction.actionType,
        locator: targetAction.locator,
        locatorStrategy: targetAction.locatorStrategy
      },
      pageState,
      applicationError,
      popupPages: popupPages.map((popupPage) => ({ url: popupPage.url() })),
      dialogs: dialogEvents,
      targetResolution: {
        pageCount: immediate.pageCount,
        frameMatches: immediate.frameMatches,
        popupMatches: immediate.popupMatches,
        totalCount: immediate.totalCount,
        delayedPageCount: delayed.pageCount,
        delayedFrameMatches: delayed.frameMatches,
        delayedPopupMatches: delayed.popupMatches,
        delayedTotalCount: delayed.totalCount,
        delayedAppearance: immediate.totalCount === 0 && delayed.totalCount > 0,
        inspectedAfterMs: delayMs
      },
      topCandidate,
      candidates: candidates.slice(0, 12),
      relevantHtml: buildRelevantHtml(pageState, topCandidate)
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  collectBrowserEvidence,
  inferCodeFilePath
};