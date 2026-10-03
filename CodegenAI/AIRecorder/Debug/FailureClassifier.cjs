function classifyFailure(evidence) {
  const browserEvidence = evidence.browserEvidence || {};
  const pageState = browserEvidence.pageState || {};
  const resolution = browserEvidence.targetResolution || {};
  const topCandidate = browserEvidence.topCandidate || null;
  const applicationError = browserEvidence.applicationError || { detected: false, indicators: [] };
  const popupPages = Array.isArray(browserEvidence.popupPages) ? browserEvidence.popupPages : [];
  const dialogs = Array.isArray(browserEvidence.dialogs) ? browserEvidence.dialogs : [];
  const text = [
    evidence.exceptionMessage,
    evidence.stackTrace,
    evidence.executionOutput,
    evidence.stepText,
    evidence.actionType,
    evidence.failedLocator,
    evidence.locatorStrategy
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const build = (category, confidence, reason, recommendedAction) => ({
    category,
    confidence,
    reason,
    evidence: {
      locator: evidence.failedLocator || null,
      sourceFile: evidence.sourceFile || null,
      sourceLine: evidence.sourceLine || null,
      currentUrl: evidence.currentUrl || pageState.url || null,
      codeTsLine: evidence.recordedSourceLine || null
    },
    recommendedAction
  });

  if (applicationError.detected) {
    return build(
      "application-defect",
      0.96,
      `The page content indicates an application error page: ${applicationError.indicators.join(", ")}.`,
      "Do not change the locator. Investigate the application or navigation failure first."
    );
  }

  if (/page\.goto:|net::|dns|econn|err_|navigation/i.test(text)) {
    return build("navigation", 0.88, "The failure occurred during navigation or page load before the target interaction could complete.", "Validate target URL, environment reachability, and the returned application page.");
  }

  if (dialogs.length > 0) {
    return build("popup", 0.88, `A browser dialog (${dialogs[0].type}) was observed during replay and may be blocking the action.`, "Handle the blocking browser dialog explicitly before interacting with the next element.");
  }

  if (
    popupPages.length > 0 &&
    (
      (Array.isArray(resolution.popupMatches) && resolution.popupMatches.some((item) => item.totalCount > 0)) ||
      (Array.isArray(resolution.delayedPopupMatches) && resolution.delayedPopupMatches.some((item) => item.totalCount > 0))
    )
  ) {
    return build("popup", 0.9, "The target action resolves on a popup or newly opened page rather than the main page.", "Switch to the popup page context before locating the target element.");
  }

  if (resolution.delayedAppearance) {
    return build("timing", 0.9, "The target appears after a delay during replay, which indicates a synchronization issue rather than a broken locator.", "Add a condition-based wait before the action.");
  }

  if (
    ((topCandidate && topCandidate.frameSelector) || (Array.isArray(resolution.frameMatches) && resolution.frameMatches.length > 0)) &&
    (!resolution.pageCount || resolution.pageCount === 0)
  ) {
    return build("iframe", 0.89, "The closest validated candidate exists inside a frame while the current action is not resolving in the main frame.", "Use FrameLocator scoped to the validated frame.");
  }

  if (evidence.tableEvidence) {
    const tableStrategy = String(evidence.tableEvidence.strategy || "").toUpperCase();
    if (tableStrategy.includes("TABLE")) {
      return build("table/grid", 0.87, "The failing action is associated with table metadata and should use existing table locator intelligence for repair.", "Use the validated table/grid locator candidate from existing table intelligence.");
    }
  }

  if (topCandidate && topCandidate.chosenStrategy) {
    return build("locator", 0.92, `The recorded locator does not resolve, while a validated ${topCandidate.chosenStrategy} candidate is available.`, "Replace the failing locator with the validated stable candidate.");
  }

  if (/strict mode violation|did not resolve|cannot find|no node found|locator resolved to|resolved to \d+ element|locator failed/i.test(text)) {
    return build("locator", 0.84, "The failure indicates a locator that is missing, ambiguous, or no longer stable.", "Use stable locator evidence or table metadata to replace the locator.");
  }

  if (/not visible|element is not visible|waiting for .* visible/i.test(text)) {
    return build("timing", 0.83, "The target element exists but is not visible when the action runs.", "Add a condition-based visibility wait or loader synchronization before the action.");
  }

  if (/not enabled|element is disabled|disabled/i.test(text)) {
    return build("timing", 0.82, "The target control is present but disabled.", "Wait for the control to become enabled before interacting.");
  }

  if (/timeouterror|timed out|timeout /i.test(text)) {
    return build("timing", 0.76, "The action timed out before the expected condition completed.", "Add event-driven synchronization based on the target action.");
  }

  if (/framelocator|contentframe|frame/i.test(text)) {
    return build("iframe", 0.75, "The failing action appears to be targeting the wrong frame or a missing frame context.", "Resolve the correct frame and scope the locator through FrameLocator.");
  }

  if (/popup|new page|waitforpopup|dialog|alert|confirm|prompt/i.test(text)) {
    return build("popup", 0.82, "The flow requires popup or dialog handling that is missing or mistimed.", "Add explicit popup or dialog handling before interacting with the new surface.");
  }

  if (/selectoption|combobox|dropdown|option/i.test(text)) {
    return build("test-data", 0.62, "The failing step involves dropdown selection or option availability.", "Validate whether the expected option and test data are available before changing the locator.");
  }

  if (/assert|expected:/i.test(text)) {
    return build("automation-defect", 0.7, "The failure is an assertion mismatch rather than a locator interaction problem.", "Inspect the business expectation before changing the assertion.");
  }

  if (/401|403|login|not authenticated|session expired|forbidden|unauthorized/i.test(text)) {
    return build("navigation", 0.9, "The failure points to an expired or missing authenticated session.", "Refresh the session state rather than changing the automation code.");
  }

  if (/unsupported/i.test(text)) {
    return build("automation-defect", 0.74, "The recorded action is not supported by the current automation mapping.", "Handle the unsupported action manually or extend the mapper.");
  }

  return build("unknown", 0.5, "The failure did not match a known diagnostic pattern.", "Review the captured evidence and source context manually.");
}

module.exports = {
  classifyFailure
};