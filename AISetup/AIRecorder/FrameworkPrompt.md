Read `AIRecorder/Code.ts`.

Convert the recorded Playwright script into my existing automation framework.

---

## URL Management Rules

Before generating any automation assets:

1. Read the first `page.goto()` URL from `Code.ts`.

2. Check whether the URL already exists in `appsettings.json` under the `Urls` section.

3. If the URL exists:

   * Reuse the existing URL key.
   * Never hardcode URLs in generated code.

4. If the URL does not exist:

   * Generate a meaningful key name from the URL.
   * Add the URL entry into `appsettings.json`.
   * Update `ConfigReader` only if the current URL structure requires modification.

5. All generated navigation methods must use `ConfigReader` URLs.

6. Never hardcode application URLs in generated classes.

7. Reuse existing ConfigReader settings whenever possible.

---

## Feature Selection Rules

Before generating automation assets:

1. Scan the `Features` folder.

2. Display all existing Feature files.

3. Always include an additional option:

   `[Create New Feature]`

Example:

Available Features:

1. Login.feature

2. ExternalWire.feature

3. Deals.feature

4. Portfolio.feature

5. Create New Feature

6. Ask the user to select one option.

---

## If an Existing Feature is Selected

1. Append only the new Scenario(s) to the selected Feature file.

2. Never modify existing Scenarios.

3. Never delete existing content.

4. Automatically identify related framework classes using naming conventions.

Example:

ExternalWire.feature

↓

ExternalWireSteps.cs

↓

ExternalWireMethods.cs

↓

ExternalWireObjects.cs

5. Append only the minimum required code.

6. Reuse existing methods whenever possible.

7. Generate only missing:

   * Locators
   * Methods
   * Step Definitions

8. Preserve all existing implementations.

9. Never rename existing methods.

10. Never remove existing code.

11. Do not change old scenarios.

12. Do not overwrite existing files.

---

## If "Create New Feature" is Selected

1. Determine the module name from `Code.ts`.

2. Generate a completely new automation set.

Example:

Reports.feature

ReportsSteps.cs

ReportsMethods.cs

ReportsObjects.cs

3. Follow all framework standards.

4. Use ConfigReader URLs.

5. Use Excel-driven test data.

6. Use reusable methods.

7. Do not duplicate existing utilities.

8. Preserve backward compatibility with existing framework classes.

---

## Framework Rules

1. Generate PageElements (Objects) class.

2. Generate PageActions (Methods) class.

3. Generate StepDefinitions class.

4. Use Playwright C#.

5. Use SpecFlow.

6. Follow Page Object Model.

7. Separate locators and actions.

8. Follow existing LoginObjects patterns.

9. Follow existing LoginMethods patterns.

10. Generate reusable methods.

11. Preserve backward compatibility.

12. Generate only minimum required changes.

13. Never duplicate existing utilities.

14. If similar methods already exist, reuse them instead of generating duplicates.

15. Generate only missing implementations.

16. Preserve all existing code.

---

## Waiting Rules

1. Never use `Thread.Sleep`.

2. Never use `Task.Delay`.

3. Use `WaitForAsync`.

4. Use `WaitForResponseAsync` for navigation and AJAX calls.

5. Use Playwright native waits.

6. Wait for loaders to disappear.

7. Wait for frames before interaction.

8. Wait for dynamic content refreshes.

9. Wait for grids to finish refreshing.

10. Wait for popup windows before interaction.

11. Wait for popup close completion before continuing.

---

## Assertion Rules

1. Use Expect assertions whenever possible.

2. Validate page navigations.

3. Validate field values after filling.

4. Validate dropdown selections.

5. Validate success messages.

6. Validate error messages.

7. Validate validation messages.

8. Validate transaction IDs.

9. Validate popup states.

10. Validate grid refresh completion.

11. Validate no unexpected inline errors exist.

---

## Excel Rules

1. Replace hardcoded test data with Excel-driven data.

2. Generate Excel readers only if missing.

3. Reuse existing Excel utilities whenever possible.

4. Preserve existing Excel implementation.

5. Generate data mapping methods only when necessary.

---

## Locator Rules

1. Separate locators into Objects classes.

2. Prefer stable locators.

3. Avoid absolute XPath.

4. Prefer:

   * getByRole
   * getByLabel
   * getByPlaceholder
   * CSS selectors
   * Relative XPath

5. Use `.First` only when necessary.

6. Avoid duplicate locators.

---

## Method Generation Rules

1. Generate reusable action methods.

2. Break large flows into smaller methods.

3. Reuse existing methods whenever possible.

4. Do not duplicate methods.

5. Preserve old implementations.

6. Generate only missing methods.

7. Follow existing naming conventions.

---

## Step Definition Rules

1. Reuse existing step definitions whenever possible.

2. Generate only missing bindings.

3. Avoid duplicate SpecFlow expressions.

4. Preserve all existing step definitions.

5. Append new steps without modifying old steps.

---

## Code Quality Rules

1. Follow existing project structure.

2. Preserve backward compatibility.

3. Never remove working code.

4. Never overwrite existing implementations.

5. Never rename existing classes.

6. Never change unrelated files.

7. Generate only minimum required changes.

8. Clearly indicate newly generated sections.

---

## Output Requirements

At completion, provide a summary containing:

* Selected Feature
* Feature Updated or Created
* Scenario(s) Added
* Existing Steps Reused
* New Steps Generated
* Existing Methods Reused
* New Methods Generated
* Existing Objects Reused
* New Objects Generated
* URLs Reused
* URLs Added
* appsettings.json Changes
* ConfigReader Changes
* Excel Changes
* Validation Rules Added
* Waits Added
* Assertions Added
* Files Modified
* Files Created

---

## Final Workflow

Code.ts

↓

Extract page.goto URL

↓

Validate appsettings.json

↓

Reuse/Add URL

↓

Display Feature List

(Login.feature,
ExternalWire.feature,
Deals.feature,
Portfolio.feature,
Create New Feature)

↓

User Selection

↓

Existing Feature?

├─ Yes

│

│ Feature

│ ↓

│ Related Steps

│ ↓

│ Related Methods

│ ↓

│ Related Objects

│ ↓

│ Append Minimum Required Code

│

└─ No

↓

Generate New Feature Set

↓

Feature

Steps

Methods

Objects

↓

Build

↓

Execute

↓

Generate Trace

↓

Analyze Trace

↓

Improve Framework

↓

Execution Summary
