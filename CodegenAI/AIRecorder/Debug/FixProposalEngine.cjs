const fs = require("fs");

function extractActionExpression(sourceLineText) {
  const match = String(sourceLineText || "").match(/await\s+(.+)\.(ClickAsync|DblClickAsync|HoverAsync|CheckAsync|UncheckAsync|FillAsync|PressAsync|SelectOptionAsync|WaitForAsync)\(/);
  return match ? match[1] : null;
}

function escapeCSharpString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function buildLocatorExpressionProposal(evidence, browserEvidence) {
  const candidate = browserEvidence && browserEvidence.topCandidate ? browserEvidence.topCandidate : null;
  if (!candidate || !candidate.chosenStrategy || !evidence.sourceLineText || !evidence.sourceFile) {
    return null;
  }

  let newExpression = null;
  if (candidate.frameSelector) {
    if (candidate.chosenStrategy === "testid") {
      newExpression = `Page.FrameLocator("${escapeCSharpString(candidate.frameSelector)}").GetByTestId("${escapeCSharpString(candidate.chosenValue)}")`;
    } else if (candidate.chosenStrategy === "role") {
      newExpression = `Page.FrameLocator("${escapeCSharpString(candidate.frameSelector)}").GetByRole(AriaRole.${String(candidate.inferredRole || "Element").replace(/(^|\s)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase())}, new() { Name = "${escapeCSharpString(candidate.chosenValue)}" })`;
    } else if (candidate.chosenStrategy === "title") {
      newExpression = `Page.FrameLocator("${escapeCSharpString(candidate.frameSelector)}").GetByTitle("${escapeCSharpString(candidate.chosenValue)}")`;
    }
  } else if (candidate.chosenStrategy === "testid") {
    newExpression = `Page.GetByTestId("${escapeCSharpString(candidate.chosenValue)}")`;
  } else if (candidate.chosenStrategy === "role") {
    newExpression = `Page.GetByRole(AriaRole.${String(candidate.inferredRole || "Element").replace(/(^|\s)([a-z])/g, (_, prefix, char) => prefix + char.toUpperCase())}, new() { Name = "${escapeCSharpString(candidate.chosenValue)}" })`;
  } else if (candidate.chosenStrategy === "label") {
    newExpression = `Page.GetByLabel("${escapeCSharpString(candidate.chosenValue)}")`;
  } else if (candidate.chosenStrategy === "placeholder") {
    newExpression = `Page.GetByPlaceholder("${escapeCSharpString(candidate.chosenValue)}")`;
  } else if (candidate.chosenStrategy === "title") {
    newExpression = `Page.GetByTitle("${escapeCSharpString(candidate.chosenValue)}")`;
  } else if (candidate.chosenStrategy === "css-id") {
    newExpression = `Page.Locator("#${escapeCSharpString(candidate.chosenValue)}")`;
  } else if (candidate.chosenStrategy === "text") {
    newExpression = `Page.GetByText("${escapeCSharpString(candidate.chosenValue)}")`;
  }

  if (!newExpression) {
    return null;
  }

  const oldExpressionMatch = String(evidence.sourceLineText).match(/await\s+(.+)\.(ClickAsync|DblClickAsync|HoverAsync|CheckAsync|UncheckAsync|FillAsync|PressAsync|SelectOptionAsync|WaitForAsync)\(/);
  if (!oldExpressionMatch) {
    return null;
  }

  const oldExpression = oldExpressionMatch[1];
  return {
    file: evidence.sourceFile,
    line: evidence.sourceLine,
    location: `line ${evidence.sourceLine}`,
    changeType: candidate.frameSelector ? "WrapInFrameLocator" : "ReplaceLocatorExpression",
    oldCode: evidence.sourceLineText,
    newCode: evidence.sourceLineText.replace(oldExpression, newExpression),
    reason: `Validated ${candidate.chosenStrategy} candidate ${candidate.frameSelector ? "inside frame" : "on current page"}.`,
    confidence: Math.min(0.97, Math.max(0.78, Number(candidate.score || 78) / 100)),
    expectedEffect: "The generated action should target the validated candidate discovered during replay.",
    safeToApply: true,
    candidate
  };
}

function buildLocatorReplacementProposal(evidence) {
  const tableEvidence = evidence.tableEvidence || {};
  const stableLocator = tableEvidence.locator;
  if (!stableLocator || !evidence.sourceLineText || !evidence.failedLocator) {
    return null;
  }

  if (!evidence.sourceLineText.includes(evidence.failedLocator)) {
    return null;
  }

  return {
    file: evidence.sourceFile,
    location: `line ${evidence.sourceLine}`,
    changeType: "ReplaceLocator",
    oldCode: evidence.sourceLineText,
    newCode: evidence.sourceLineText.replace(evidence.failedLocator, stableLocator),
    reason: tableEvidence.reason || "Use stable locator evidence captured during live table analysis.",
    confidence: Math.max(0.75, Number(tableEvidence.confidence || 0.75)),
    safeToApply: true
  };
}

function buildWaitProposal(evidence) {
  const expression = extractActionExpression(evidence.sourceLineText);
  if (!expression || !evidence.sourceFile) {
    return null;
  }

  return {
    file: evidence.sourceFile,
    location: `line ${evidence.sourceLine}`,
    changeType: "InsertWaitBeforeAction",
    insertBeforeLine: evidence.sourceLine,
    newCode: `await ${expression}.WaitForAsync(); // DebugEngine synchronization before failing action`,
    oldCode: null,
    reason: "Wait for the target locator before repeating the action.",
    confidence: 0.72,
    safeToApply: true
  };
}

function buildManualProposal(evidence, classification) {
  return {
    file: evidence.sourceFile,
    line: evidence.sourceLine,
    location: `line ${evidence.sourceLine}`,
    changeType: "ManualReview",
    oldCode: evidence.sourceLineText,
    newCode: evidence.sourceLineText,
    reason: classification.recommendedAction,
    confidence: classification.confidence,
    safeToApply: false
  };
}

function proposeFix(evidence, classification, browserEvidence) {
  if (classification.category === "table/grid") {
    const tableReplacement = buildLocatorReplacementProposal(evidence);
    if (tableReplacement) {
      return tableReplacement;
    }

    const tableExpressionProposal = buildLocatorExpressionProposal(evidence, browserEvidence);
    if (tableExpressionProposal) {
      return tableExpressionProposal;
    }
  }

  if (classification.category === "locator") {
    const locatorExpressionProposal = buildLocatorExpressionProposal(evidence, browserEvidence);
    if (locatorExpressionProposal) {
      return locatorExpressionProposal;
    }

    const replacement = buildLocatorReplacementProposal(evidence);
    if (replacement) {
      return replacement;
    }
  }

  if (classification.category === "iframe") {
    const frameProposal = buildLocatorExpressionProposal(evidence, browserEvidence);
    if (frameProposal) {
      return frameProposal;
    }
  }

  if (classification.category === "popup") {
    return {
      file: evidence.sourceFile,
      line: evidence.sourceLine,
      location: `line ${evidence.sourceLine}`,
      changeType: "ManualReview",
      oldCode: evidence.sourceLineText,
      newCode: evidence.sourceLineText,
      reason: classification.recommendedAction,
      confidence: classification.confidence,
      expectedEffect: "Developer can apply popup or dialog handling using the captured browser evidence.",
      safeToApply: false
    };
  }

  if (["timing"].includes(classification.category)) {
    const waitProposal = buildWaitProposal(evidence);
    if (waitProposal) {
      return waitProposal;
    }
  }

  if (classification.category === "navigation") {
    return {
      file: evidence.sourceFile,
      line: evidence.sourceLine,
      location: `line ${evidence.sourceLine}`,
      changeType: "ManualReview",
      oldCode: null,
      newCode: null,
      reason: "The failure points to navigation, session, or application state rather than a safe locator repair.",
      confidence: classification.confidence,
      expectedEffect: "No source patch will be applied until the environment or application issue is resolved.",
      safeToApply: false
    };
  }

  return buildManualProposal(evidence, classification);
}

function applyProposal(proposal, sessionDir) {
  if (!proposal || !proposal.safeToApply || !proposal.file) {
    return {
      applied: false,
      backupFilePath: null,
      reason: "Proposal is not auto-applicable."
    };
  }

  const source = fs.readFileSync(proposal.file, "utf8");
  const backupFilePath = `${sessionDir.replace(/\\/g, "/")}/${proposal.file.split(/[/\\]/).pop()}.bak`;
  fs.writeFileSync(backupFilePath, source, "utf8");

  let updated = source;

  if (["ReplaceLocator", "ReplaceLocatorExpression", "WrapInFrameLocator"].includes(proposal.changeType)) {
    updated = source.replace(proposal.oldCode, proposal.newCode);
  }

  if (proposal.changeType === "InsertWaitBeforeAction") {
    const lines = source.split(/\r?\n/);
    const targetIndex = Math.max(0, Math.min(lines.length, Number(proposal.insertBeforeLine || 1) - 1));
    const targetLine = lines[targetIndex] || "";
    const indent = (targetLine.match(/^\s*/) || [""])[0];
    lines.splice(targetIndex, 0, `${indent}${proposal.newCode}`);
    updated = lines.join("\n");
  }

  fs.writeFileSync(proposal.file, updated, "utf8");

  return {
    applied: true,
    backupFilePath,
    reason: proposal.reason
  };
}

function revertProposal(proposal, applyResult) {
  if (!proposal || !applyResult || !applyResult.backupFilePath || !fs.existsSync(applyResult.backupFilePath)) {
    return false;
  }

  fs.copyFileSync(applyResult.backupFilePath, proposal.file);
  return true;
}

module.exports = {
  applyProposal,
  extractActionExpression,
  proposeFix,
  revertProposal
};