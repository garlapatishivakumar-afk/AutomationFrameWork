import { FrameworkRule } from "./ContextModels";

export const FrameworkRules: FrameworkRule[] = [

    {
        id: "NoDuplicateMethods",
        description: "Do not generate duplicate method names in any class.",
        required: true
    },

    {
        id: "NoDuplicateLocators",
        description: "Do not generate duplicate locators in page object classes. Reuse existing locators only on exact locator-expression matches.",
        required: true
    },

    {
        id: "ExactLocatorReuseOnly",
        description: "If a new locator exactly matches an existing locator expression, reuse it; otherwise create a new locator. Never reuse based on partial similarity.",
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
        id: "MethodNamingConvention",
        description: "Use PascalCase for method names, append Async for asynchronous methods, and start method names with a clear verb describing intent.",
        required: true
    },

    {
        id: "EnterpriseMethodNamePattern",
        description: "For enterprise split flows, use domain-oriented orchestration names (for example Navigate/Open/Apply/Select/Complete) and use deterministic PartNAsync suffixes for segmented sub-methods.",
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
        id: "EnterpriseActionSegmentation",
        description: "Split long recorded flows into smaller enterprise-level methods and keep each method focused on one business intent.",
        required: true
    },

    {
        id: "ReusableSubFlowExtraction",
        description: "When action patterns repeat, extract reusable sub-flow methods and call them instead of duplicating action blocks.",
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
        id: "LocatorAttributePriority",
        description: "Generate locators using this priority: stable id, stable data/test attributes, stable name, stable aria attributes, other stable custom attributes, then stable DOM relationship. Use text only as last resort.",
        required: true
    },

    {
        id: "NoPrimaryTextLocator",
        description: "Do not use innerText/text() as primary locator when stable attribute-based locator exists.",
        required: true
    },

    {
        id: "NoTestDataLocator",
        description: "Do not use business/test data values as primary locator keys for rows/cells/actions.",
        required: true
    },

    {
        id: "NoAbsoluteOrPositionalXPath",
        description: "Avoid absolute XPath and brittle positional XPath indexes unless structurally guaranteed and no stable alternative exists.",
        required: true
    },

    {
        id: "StableXPathOnly",
        description: "When XPath is required, prefer shortest unique relative XPath using tag + stable attributes + stable values.",
        required: true
    },

    {
        id: "DynamicIdHandling",
        description: "For dynamic IDs, do not use full volatile IDs blindly; use stable unique segments only when uniqueness is validated.",
        required: true
    },

    {
        id: "TableLocatorStrategy",
        description: "For tables, identify table by stable attribute, row by stable row attribute, then target element relative to row. Avoid row indexes and displayed business data where possible.",
        required: true
    },

    {
        id: "LocatorUniquenessValidation",
        description: "Every generated locator must uniquely match the intended element. Refine with stable attributes or stable parent-child relationships if multiple matches are found.",
        required: true
    },

    {
        id: "NoInventedAttributes",
        description: "Use only attributes present in the captured DOM. Do not invent data-testid, automation-id, or other attributes.",
        required: true
    },

    {
        id: "ClassStabilityCheck",
        description: "Do not rely on framework-generated or unstable class names without validation.",
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
