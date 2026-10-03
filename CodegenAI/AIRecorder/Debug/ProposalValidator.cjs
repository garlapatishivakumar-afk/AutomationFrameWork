function createSignature(proposal) {
  return JSON.stringify({
    file: proposal.file || null,
    line: proposal.line || proposal.location || null,
    changeType: proposal.changeType || null,
    newCode: proposal.newCode || null
  });
}

function validateProposal(proposal, context) {
  if (!proposal) {
    return {
      valid: false,
      reason: "No proposal generated."
    };
  }

  const previous = Array.isArray(context.previousRetryResults) ? context.previousRetryResults : [];
  const signature = createSignature(proposal);
  if (context.failure && proposal.file && context.failure.sourceFile && proposal.file !== context.failure.sourceFile) {
    return {
      valid: false,
      reason: "Proposal targets a different source file.",
      signature
    };
  }

  if (previous.some((item) => item.proposal && createSignature(item.proposal) === signature)) {
    return {
      valid: false,
      reason: "Proposal duplicates a previous unsuccessful attempt.",
      signature
    };
  }

  if (proposal.changeType === "ReplaceLocatorExpression") {
    const candidate = context.browserEvidence && context.browserEvidence.topCandidate;
    if (!candidate || !candidate.isUnique || !candidate.chosenStrategy) {
      return {
        valid: false,
        reason: "Replacement candidate is not uniquely validated.",
        signature
      };
    }

    return {
      valid: true,
      unique: true,
      reason: `Validated unique ${candidate.chosenStrategy} candidate from browser evidence.`,
      signature
    };
  }

  if (proposal.changeType === "ReplaceLocator") {
    const tableEvidence = context.failure && context.failure.tableEvidence ? context.failure.tableEvidence : null;
    const uniqueMatch = Boolean(tableEvidence && (tableEvidence.uniqueMatch || (tableEvidence.validation && tableEvidence.validation.unique)));
    return {
      valid: uniqueMatch,
      unique: uniqueMatch,
      reason: uniqueMatch ? "Validated by table metadata uniqueness evidence." : "Table metadata did not confirm uniqueness.",
      signature
    };
  }

  if (proposal.changeType === "InsertWaitBeforeAction") {
    const resolution = context.browserEvidence && context.browserEvidence.targetResolution;
    const delayed = Boolean(resolution && resolution.delayedAppearance);
    return {
      valid: delayed,
      unique: false,
      reason: delayed ? "Target appears after delay during replay; wait proposal is justified." : "No delayed appearance was observed.",
      signature
    };
  }

  if (proposal.changeType === "WrapInFrameLocator") {
    const candidate = context.browserEvidence && context.browserEvidence.topCandidate;
    const popupPage = context.browserEvidence && context.browserEvidence.popupPages && context.browserEvidence.popupPages.length > 0;
    const valid = Boolean(candidate && candidate.frameSelector) || Boolean(popupPage);
    return {
      valid,
      unique: valid,
      reason: valid ? "Matching element was validated inside a frame or secondary page context." : "No single frame candidate was validated.",
      signature
    };
  }

  return {
    valid: false,
    reason: "Proposal requires manual review.",
    signature
  };
}

module.exports = {
  validateProposal
};