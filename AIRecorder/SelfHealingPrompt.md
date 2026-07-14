Read:

1. ImprovementSummary.md
2. ExecutionSummary.md
3. Latest Playwright Trace
4. Existing framework code

Goal:

Generate safe fixes for automation failures.

Analyze:

1. Timeout failures
2. Locator failures
3. Missing waits
4. Validation failures
5. Synchronization issues
6. Reusable patterns

Generate:

1. Root cause
2. Proposed fix
3. Files affected
4. Exact code snippets
5. Risks of the change
6. Confidence score (0–100%)

Rules:

* Never use Thread.Sleep.
* Never use Task.Delay.
* Prefer Playwright waits.
* Do not modify business validations.
* Do not create duplicate steps.
* Prefer reusable framework methods.
* Output PatchProposal.md.