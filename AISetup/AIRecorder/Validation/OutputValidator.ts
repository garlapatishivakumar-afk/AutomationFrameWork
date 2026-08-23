type ValidationError = {

    rule: string;

    message: string;

};

type ValidationResult = {

    success: boolean;

    errors: ValidationError[];

};

export class OutputValidator {

    private hasBalancedPair(
        code: string,
        openChar: string,
        closeChar: string
    ): boolean {

        let depth = 0;

        for (const ch of code) {

            if (ch === openChar)
                depth++;

            if (ch === closeChar) {
                depth--;

                if (depth < 0)
                    return false;
            }

        }

        return depth === 0;

    }

    public validate(
        code: string
    ): ValidationResult {

        const errors: ValidationError[] = [];

        const trimmed = code.trim();

        if (!trimmed) {

            errors.push({

                rule: "EmptyCode",

                message:
                    "Generated content is empty."

            });

            return {

                success: false,

                errors

            };

        }

        if (!this.hasBalancedPair(code, "{", "}")) {

            errors.push({

                rule: "Braces",

                message:
                    "Unbalanced curly braces detected."

            });

        }

        if (!this.hasBalancedPair(code, "(", ")")) {

            errors.push({

                rule: "Parentheses",

                message:
                    "Unbalanced parentheses detected."

            });

        }

        const methodRegex =
            /(public|private|protected)\s+(?:async\s+)?(?:Task(?:<[^>]+>)?|void|bool|int|string|double|decimal|[A-Za-z0-9_<>,\[\]]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

        const methodNames = new Set<string>();

        let match: RegExpExecArray | null;

        while ((match = methodRegex.exec(code)) !== null) {

            const name = match[2].toLowerCase();

            if (methodNames.has(name)) {

                errors.push({

                    rule: "DuplicateMethod",

                    message:
                        `Duplicate method signature found: ${match[2]}.`

                });

                break;

            }

            methodNames.add(name);

        }

        if (/^\s*Scenario(?:\s+Outline)?:/m.test(code)) {

            if (!/^\s*(Given|When|Then|And|But)\b/m.test(code)) {

                errors.push({

                    rule: "ScenarioSteps",

                    message:
                        "Scenario block must include at least one Given/When/Then/And/But line."

                });

            }

        }

        if (/\b(class|public|private|protected)\b/.test(code)) {

            const hasTerminator =
                /[;{}]\s*$/.test(trimmed);

            if (!hasTerminator) {

                errors.push({

                    rule: "Syntax",

                    message:
                        "Code appears truncated or missing a statement/block terminator."

                });

            }

        }

        if (
            code.includes("Thread.Sleep")
        ) {

            errors.push({

                rule: "ThreadSleep",

                message:
                    "Thread.Sleep is not allowed."

            });

        }

        if (
            code.includes("async") &&
            !code.includes("await")
        ) {

            errors.push({

                rule: "Await",

                message:
                    "Async method without await."

            });

        }

        if (
            code.includes("fill(") &&
            !code.includes("Excel")
        ) {

            errors.push({

                rule: "Excel",

                message:
                    "Input values should come from Excel."

            });

        }

        return {

            success:
                errors.length === 0,

            errors

        };

    }

    // V2.1 Enhancement #8: locator quality validation
    // Validates that generated C# code does not use hardcoded raw technical locators
    // when better semantic names should be used.
    public validateLocatorQuality(code: string): { warnings: string[]; errors: string[] } {

        const warnings: string[] = [];
        const errors: string[] = [];

        // Warn: raw ASP.NET generated IDs directly in Playwright locator calls
        const rawCtlPattern = /Locator\(\s*["']#ctl\d{2,}/gi;
        const rawCtlMatches = code.match(rawCtlPattern);
        if (rawCtlMatches && rawCtlMatches.length > 0) {
            warnings.push(
                `${rawCtlMatches.length} locator(s) use raw ASP.NET generated IDs (ctl00...). ` +
                `Consider using semantic names from LiveObservations.`
            );
        }

        // Warn: hardcoded numeric table row indexes
        const fragileRowPattern = /ctl\d{2,}_ctl\d{2,}/gi;
        const fragileMatches = code.match(fragileRowPattern);
        if (fragileMatches && fragileMatches.length > 0) {
            warnings.push(
                `${fragileMatches.length} locator(s) contain fragile double-indexed table row selectors. ` +
                `Use a stable business-key row strategy instead.`
            );
        }

        // Error: duplicate locator variable names
        const locatorNamePattern = /ILocator\s+(\w+)\s*\(/g;
        const locatorNames = new Set<string>();
        let locMatch: RegExpExecArray | null;
        while ((locMatch = locatorNamePattern.exec(code)) !== null) {
            const name = locMatch[1].toLowerCase();
            if (locatorNames.has(name)) {
                errors.push(`Duplicate locator definition: ${locMatch[1]}.`);
            }
            locatorNames.add(name);
        }

        return { warnings, errors };
    }

}