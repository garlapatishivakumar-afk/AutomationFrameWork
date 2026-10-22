# Automation Framework

Language: C#

Framework: Playwright

Test Runner: xUnit

BDD: Cucumber

Pattern: Page Object Model

Folder Structure

Features
StepDefinitions
PageObjects
PageActions
PageElements
Helpers
Hooks

Rules

- Use async/await.
- Never use Thread.Sleep().
- Use Playwright auto waiting.
- Store locators in PageElements.
- Store business methods in PageActions.
- StepDefinitions should only call PageActions.
- Read all test data from Excel.
- Use existing helper methods before creating new ones.
- Reuse page classes if they already exist.
- For browser alerts/confirm/prompt in Playwright C#, subscribe to Page.Dialog with a one-time TaskCompletionSource, trigger the action, await the dialog task, then await dialog.AcceptAsync() or dialog.DismissAsync(), and unsubscribe in finally.
- Do not use fire-and-forget dialog calls such as _ = dialog.AcceptAsync() or dialog.DismissAsync() without await.
- For textbox/input actions from Code.ts, use reusable common fill methods (do not inline FillAsync everywhere).
- For dropdown actions from Code.ts, use reusable common dropdown selection methods (do not inline SelectOptionAsync everywhere).
- Reuse existing common fill/select methods first; create them only once if missing.
- Split long recorded action chains into enterprise-level methods with single responsibility.
- If the same action chain repeats in one recording, extract it into one reusable sub-flow method and call it wherever needed.
- Use PascalCase for method names and keep verb-first business intent naming.
- Every asynchronous method name must end with Async.
- For segmented enterprise methods, use deterministic suffixes such as Part1Async, Part2Async.
- Avoid vague method names (for example Method1Async or ActionAsync); use domain-specific names.

Locator Generation Rules

- Golden rule: locate by what an element is (tag + stable attribute + stable value), not by what it currently displays.
- Priority order: stable id, stable data/test attribute in DOM, stable name, stable aria attribute, other stable custom attributes, stable parent-child relationship, relative XPath, text as last resort.
- Prefer shortest stable unique locator.
- Do not use text/innerText as primary locator when stable attributes are available.
- Do not use business/test data values as primary locator keys.
- Avoid positional locators and absolute XPath unless no stable alternative exists.
- For dynamic IDs, avoid full volatile IDs and use stable unique segments only after uniqueness validation.
- Do not depend on unstable framework-generated classes without validation.
- Use only attributes that exist in captured DOM; never invent attributes.
- Every locator must be unique; if multiple matches exist, refine using additional stable attributes or stable DOM relationships.
- Table strategy: identify table via stable attribute, row via stable row attribute, and target relative to row; avoid hardcoded row indexes.
- If text must be used, treat it as fallback only when static, unique, and not business data.
