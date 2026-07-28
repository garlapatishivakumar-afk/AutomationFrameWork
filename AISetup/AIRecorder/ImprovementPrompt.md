Read:

1. ExecutionSummary.md
2. Latest Playwright Trace
3. Latest Extent Report
4. Existing framework methods

Analyze:

1. Failed scenarios
2. Stack traces
3. Timeout failures
4. Locator failures
5. Validation failures
6. Network failures
7. Trace evidence
8. Report evidence

Generate:

1. Root cause of each failure
2. Recommended waits
3. Recommended assertions
4. Locator improvements
5. Framework improvements
6. Whether issue is application defect or automation defect
7. Code snippets for improvements

Rules:

* Use evidence from traces and reports.
* Never recommend Thread.Sleep.
* Prefer Playwright waits.
* Explain why each recommendation is required.
* Distinguish flaky tests from application bugs.
* Highlight reusable improvements.