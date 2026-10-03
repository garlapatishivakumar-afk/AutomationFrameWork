function buildDebugPoint(failure, browserEvidence, options) {
  const recordedAction = browserEvidence && browserEvidence.recordedAction ? browserEvidence.recordedAction : null;
  const topCandidate = browserEvidence && browserEvidence.topCandidate ? browserEvidence.topCandidate : null;

  return {
    testName: failure.testName || null,
    testCommand: options.testCommand || null,
    sourceFile: failure.sourceFile || null,
    sourceLine: failure.sourceLine || null,
    sourceCode: failure.sourceLineText || null,
    codeTsLine: failure.recordedSourceLine || null,
    action: failure.actionType || (recordedAction ? recordedAction.actionType : null),
    locator: failure.failedLocator || null,
    locatorStrategy: failure.locatorStrategy || (recordedAction ? recordedAction.locatorStrategy : null),
    url: failure.currentUrl || (browserEvidence && browserEvidence.pageState ? browserEvidence.pageState.url : null),
    pageTitle: failure.pageTitle || (browserEvidence && browserEvidence.pageState ? browserEvidence.pageState.title : null),
    frame: topCandidate && topCandidate.frameSelector ? {
      selector: topCandidate.frameSelector,
      name: topCandidate.frameName || null,
      url: topCandidate.frameUrl || null
    } : null,
    exception: failure.exceptionMessage || null,
    stackTrace: failure.stackTrace || null,
    timestamp: new Date().toISOString(),
    attempt: Number(options.attempt || 1),
    testDataReference: options.testDataReference || null,
    tableMetadata: failure.tableEvidence || null,
    observationMetadata: failure.observationEvidence || null,
    browserEvidenceSummary: browserEvidence ? {
      available: browserEvidence.available,
      applicationError: browserEvidence.applicationError,
      targetResolution: browserEvidence.targetResolution,
      candidateCount: Array.isArray(browserEvidence.candidates) ? browserEvidence.candidates.length : 0
    } : null
  };
}

module.exports = {
  buildDebugPoint
};