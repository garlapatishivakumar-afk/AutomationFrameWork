# Automation framework context

C# / Playwright / Reqnroll / xUnit; Page Object Model.
Folders: Features, StepDefinitions, PageActions, PageElements, Helpers, Hooks.
Reference implementation: DealsCompletionStatus feature, Steps, Page and Locators.

Read FrameworkPrompt.md for the full code rules. SprintPrompt.md controls the
approval workflow. Use async/await, thin bindings and existing shared helpers;
business actions live in PageActions and locators in PageElements. Excel data is
keyed by TestCaseId, not row position. Draft recordings are input, not framework classes.

## Dialog handling
- For alerts/confirm/prompt, subscribe to Page.Dialog before the triggering action.
- Use a one-time TaskCompletionSource with asynchronous continuations to capture
  the dialog. Start the triggering action without immediately awaiting it (it can
  wait for the dialog to close), await the dialog task, then await AcceptAsync or
  DismissAsync, and finally await the triggering action. Use bounded waits.
- Unsubscribe in finally. Do not use fire-and-forget dialog calls such as
  `_ = dialog.AcceptAsync()` or unawaited DismissAsync. Propagate failures.
- Do not modify Hooks or session behavior to implement generated flows.