import { FrameworkRule } from "./ContextModels";

export const FrameworkRules: FrameworkRule[] = [

    {
        id: "NoDuplicateMethods",
        description: "Do not generate duplicate method names in any class.",
        required: true
    },

    {
        id: "NoDuplicateLocators",
        description: "Do not generate duplicate locators in page object classes.",
        required: true
    },

    {
        id: "NoDuplicateSteps",
        description: "Do not generate duplicate BDD step definitions.",
        required: true
    },

    {
        id: "NoDuplicateScenarios",
        description: "Do not generate duplicate scenario names in feature files.",
        required: true
    },

    {
        id: "ReuseExistingCode",
        description: "Prefer reuse of existing methods, locators, helpers, and steps before creating new artifacts.",
        required: true
    },

    {
        id: "ExcelDrivenInputs",
        description: "Use Excel/data-driven values for user inputs when applicable.",
        required: true
    },

    {
        id: "PlaywrightAsyncOnly",
        description: "Use Playwright async APIs and await every asynchronous call.",
        required: true
    },

    {
        id: "NoThreadSleep",
        description: "Do not use Thread.Sleep; use explicit waits or Playwright wait mechanisms.",
        required: true
    },

    {
        id: "UseFrameworkLogger",
        description: "Use framework logging helpers instead of ad-hoc console statements where available.",
        required: false
    },

    {
        id: "UseExistingNaming",
        description: "Follow existing naming conventions for files, classes, methods, and locators.",
        required: true
    },

    {
        id: "POMPattern",
        description: "Keep Page Object Model separation between locators and actions.",
        required: true
    },

    {
        id: "BDDPattern",
        description: "Use Given/When/Then style in feature and step definition layers.",
        required: true
    },

    {
        id: "SingleResponsibility",
        description: "Each generated method should perform one clear responsibility.",
        required: true
    },

    {
        id: "LocatorNamingConvention",
        description: "Use descriptive and stable locator names aligned with domain language.",
        required: true
    },

    {
        id: "UseAwait",
        description: "Do not leave async methods without await usage.",
        required: true
    },

    {
        id: "NoHardcodedWait",
        description: "Avoid hardcoded wait durations unless absolutely necessary.",
        required: true
    },

    {
        id: "NoHardcodedUrls",
        description: "Do not hardcode URLs; consume them from framework configuration.",
        required: true
    },

    {
        id: "ReturnJsonOnly",
        description: "Return machine-parseable JSON output with no extra prose.",
        required: true
    },

    {
        id: "PreserveArchitecture",
        description: "Do not refactor unrelated framework structure while generating missing artifacts.",
        required: true
    },

    {
        id: "DeterministicAssertions",
        description: "Use deterministic assertions and avoid flaky checks.",
        required: true
    },

    {
        id: "ErrorHandling",
        description: "Include safe error handling for critical operations where framework patterns allow.",
        required: false
    },

    {
        id: "IdempotentGeneration",
        description: "Generated output should be idempotent across repeated runs.",
        required: true
    },

    {
        id: "MinimalChange",
        description: "Generate only required delta changes and avoid unrelated code churn.",
        required: true
    },

    {
        id: "ConsistentFormatting",
        description: "Keep formatting and indentation consistent with existing project style.",
        required: true
    },

    {
        id: "SafeSelectors",
        description: "Prefer resilient selectors over brittle index-based or deeply nested selectors.",
        required: true
    },

    {
        id: "NoMagicStrings",
        description: "Avoid unexplained magic strings; use constants or known framework sources.",
        required: false
    },

    {
        id: "NoSensitiveData",
        description: "Do not emit secrets, passwords, or tokens in generated artifacts.",
        required: true
    },

    {
        id: "Traceability",
        description: "Maintain clear traceability from scenario steps to methods and locators.",
        required: true
    }

];
