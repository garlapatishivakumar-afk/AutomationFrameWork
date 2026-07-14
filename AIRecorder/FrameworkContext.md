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
