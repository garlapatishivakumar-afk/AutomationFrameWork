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
