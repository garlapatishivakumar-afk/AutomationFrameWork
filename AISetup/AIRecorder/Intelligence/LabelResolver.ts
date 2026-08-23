// V2.1 Enhancement #2 — LabelResolver
// Resolves the most meaningful human-readable label for a control,
// using a deterministic priority chain.

export interface ResolvedLabel {
    label: string;
    source: "aria-label" | "playwright-name" | "id-derived" | "action-value" | "fallback";
    confidence: number;
}

// Known ASP.NET ID prefixes to strip when deriving label from ID
const STRIP_PREFIXES = [
    "ctl00_contentplaceholder1_",
    "ctl00_",
    "contentplaceholder1_"
];

// Control-type prefixes to strip from ID segments
const CONTROL_PREFIXES = [
    "ddl", "ddr", "ddx", "txt", "tb", "inp", "btn", "but", "ibtn", "lnkbtn",
    "lnk", "hpl", "chk", "cb", "rdl", "rdo", "grd", "rgrid", "dg", "tbl",
    "tab", "cal", "dp", "lbl", "pnl", "img"
];

export class LabelResolver {

    /**
     * Resolve the best label for a control given its locator string
     * and the raw Playwright line.
     *
     * Priority:
     *   1. aria-label attribute in locator
     *   2. Playwright getByRole name option
     *   3. getByLabel / getByText value
     *   4. Placeholder value
     *   5. ID-derived (strip prefixes, split camelCase)
     *   6. Action value (e.g. selectOption value)
     */
    public resolve(locator: string, rawLine: string): ResolvedLabel {

        // 1. aria-label
        const ariaMatch = rawLine.match(/aria-label['"]\s*:\s*['"`]([^'"`]+)['"`]/i)
            ?? locator.match(/\[aria-label=['"`]([^'"`]+)['"`]\]/i);
        if (ariaMatch) {
            return { label: ariaMatch[1].trim(), source: "aria-label", confidence: 0.97 };
        }

        // 2. getByRole name option
        const roleNameMatch = rawLine.match(/getByRole\([^)]+name:\s*['"`]([^'"`]+)['"`]/i);
        if (roleNameMatch) {
            return { label: roleNameMatch[1].trim(), source: "playwright-name", confidence: 0.95 };
        }

        // 3. getByLabel / getByText
        const labelMatch = rawLine.match(/getByLabel\(\s*['"`]([^'"`]+)['"`]/i)
            ?? rawLine.match(/getByText\(\s*['"`]([^'"`]+)['"`]/i);
        if (labelMatch) {
            return { label: labelMatch[1].trim(), source: "playwright-name", confidence: 0.9 };
        }

        // 4. placeholder
        const placeholderMatch = rawLine.match(/placeholder\s*['"`]([^'"`]+)['"`]/i);
        if (placeholderMatch) {
            return { label: placeholderMatch[1].trim(), source: "action-value", confidence: 0.75 };
        }

        // 5. ID-derived
        const idLabel = this.deriveFromId(locator);
        if (idLabel) {
            return { label: idLabel, source: "id-derived", confidence: 0.65 };
        }

        // 6. selectOption / fill value as last resort
        const valueMatch = rawLine.match(/(?:selectOption|fill)\(\s*['"`]([^'"`]{2,40})['"`]/i);
        if (valueMatch) {
            return { label: valueMatch[1].trim(), source: "action-value", confidence: 0.4 };
        }

        return { label: "", source: "fallback", confidence: 0.0 };
    }

    private deriveFromId(locator: string): string {
        const idMatch = locator.match(/#([^\s#\[\]]+)/);
        if (!idMatch) return "";

        // Keep original casing — take the LAST underscore segment to skip ASP.NET wrappers
        const rawId = idMatch[1];
        const segments = rawId.split('_');
        let id = segments[segments.length - 1];

        if (!id) return "";

        // Strip control-type prefix (case-insensitive match, preserve remaining casing)
        for (const prefix of CONTROL_PREFIXES.sort((a, b) => b.length - a.length)) {
            if (id.toLowerCase().startsWith(prefix)) {
                id = id.slice(prefix.length);
                break;
            }
        }

        if (!id) return "";

        // Split camelCase / PascalCase into words
        return this.splitCamelCase(id);
    }

    /**
     * Splits "DealNumber" → "Deal Number"
     * Splits "searchUser" → "Search User"
     */
    public splitCamelCase(identifier: string): string {
        const words = identifier
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
            .trim();

        if (!words) return identifier;

        return words.charAt(0).toUpperCase() + words.slice(1);
    }
}
