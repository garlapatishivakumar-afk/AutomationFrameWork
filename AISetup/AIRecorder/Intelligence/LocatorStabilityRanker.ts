// V2.1 Enhancement #4 — LocatorStabilityRanker
// Scores locators by stability and determines the preferred strategy.

import { LocatorStrategy } from "./ControlModels";

// Stability order: highest = most stable
const STRATEGY_SCORE: Record<LocatorStrategy, number> = {
    "data-testid": 1.0,
    "aria-label":  0.92,
    "role":        0.88,
    "label":       0.85,
    "id":          0.75,
    "name":        0.70,
    "placeholder": 0.60,
    "text":        0.55,
    "xpath":       0.40,
    "css":         0.35,
    "unknown":     0.20
};

export interface StabilityResult {
    preferredStrategy: LocatorStrategy;
    stabilityScore: number;
    fallbackStrategies: LocatorStrategy[];
    warnings: string[];
}

export class LocatorStabilityRanker {

    public rank(locator: string, rawLine: string): StabilityResult {
        const strategies = this.detectAvailableStrategies(locator, rawLine);
        const sorted = [...strategies].sort(
            (a, b) => STRATEGY_SCORE[b] - STRATEGY_SCORE[a]
        );

        const preferred = sorted[0] ?? "unknown";
        const fallbacks = sorted.slice(1);
        const warnings = this.buildWarnings(locator, preferred);

        return {
            preferredStrategy: preferred,
            stabilityScore: STRATEGY_SCORE[preferred] ?? 0.2,
            fallbackStrategies: fallbacks,
            warnings
        };
    }

    private detectAvailableStrategies(locator: string, rawLine: string): LocatorStrategy[] {
        const strategies: LocatorStrategy[] = [];

        if (/data-testid/i.test(locator))            strategies.push("data-testid");
        if (/aria-label/i.test(locator + rawLine))   strategies.push("aria-label");
        if (/getByRole/i.test(rawLine))               strategies.push("role");
        if (/getByLabel/i.test(rawLine))              strategies.push("label");
        if (/getByPlaceholder/i.test(rawLine))        strategies.push("placeholder");
        if (/getByText/i.test(rawLine))               strategies.push("text");
        if (/#[a-zA-Z]/.test(locator))                strategies.push("id");
        if (/\[name=/i.test(locator))                 strategies.push("name");
        if (/^\/\//i.test(locator))                   strategies.push("xpath");
        if (/^[a-z]/i.test(locator) && !strategies.length) strategies.push("css");

        return strategies.length ? strategies : ["unknown"];
    }

    private buildWarnings(locator: string, strategy: LocatorStrategy): string[] {
        const warnings: string[] = [];

        // Fragile: indexed ASP.NET generated IDs
        if (/ctl\d{2,}/i.test(locator)) {
            warnings.push("Locator contains generated ASP.NET control ID (ctl00...) — may be fragile.");
        }

        // Fragile: positional selectors
        if (/nth-child|nth-of-type|:eq\(/i.test(locator)) {
            warnings.push("Positional selector detected — fragile with DOM changes.");
        }

        if (strategy === "css" || strategy === "xpath") {
            warnings.push("Low-stability strategy in use. Consider adding data-testid or aria-label.");
        }

        return warnings;
    }
}
