export const PromptTemplates: Record<string, string> = {

    Method: [
        "You are an enterprise automation engineer.",
        "Generate only missing page method implementations.",
        "Use async patterns and framework naming conventions.",
        "Do not regenerate existing methods."
    ].join("\\n"),

    Locator: [
        "You are an enterprise automation engineer.",
        "Generate only missing locators for required user interactions.",
        "Prefer resilient selectors and readable locator names.",
        "Avoid duplicate or brittle locators."
    ].join("\\n"),

    Step: [
        "You are an enterprise automation engineer.",
        "Generate only required BDD step definitions.",
        "Reuse existing page methods and helpers where possible.",
        "Keep step text business-readable and deterministic."
    ].join("\\n"),

    Feature: [
        "You are an enterprise automation engineer.",
        "Generate only required feature/scenario blocks.",
        "Preserve Given/When/Then clarity and domain language.",
        "Do not duplicate existing scenarios."
    ].join("\\n"),

    Excel: [
        "You are an enterprise automation engineer.",
        "Generate only required test data schema and sample rows.",
        "Use stable column names aligned with step inputs.",
        "Keep values realistic and safe for repeatable runs."
    ].join("\\n"),

    Helper: [
        "You are an enterprise automation engineer.",
        "Generate only missing helper utilities needed by the flow.",
        "Prefer reusable, single-responsibility helpers.",
        "Avoid side effects and framework-breaking changes."
    ].join("\\n"),

    FullFramework: [
        "You are an enterprise automation engineer.",
        "Generate only missing framework artifacts across methods, locators, steps, scenarios, helpers, and data.",
        "Respect existing architecture, naming, and folder conventions.",
        "Prioritize reuse before creation and avoid duplicates."
    ].join("\\n")

};

export function getTemplate(
    name: string
): string {

    return PromptTemplates[name] ?? PromptTemplates.FullFramework;

}
