// V2.1 Enhancement #2 — DomClassifier
// Classifies controls from Playwright locator strings and action patterns.
// Does NOT require a live browser — uses static analysis only.

import { ControlType, LocatorStrategy } from "./ControlModels";

// ─────────────────────────────────────────────────────────────────────────────
// ASP.NET WebForms ID prefix → control type
// ─────────────────────────────────────────────────────────────────────────────
const ID_PREFIX_MAP: Record<string, ControlType> = {
    ddl:    "Dropdown",
    ddr:    "Dropdown",
    ddx:    "Dropdown",
    txt:    "TextBox",
    tb:     "TextBox",
    inp:    "TextBox",
    btn:    "Button",
    but:    "Button",
    ibtn:   "Button",
    lnkbtn: "Button",
    lnk:    "Link",
    hpl:    "Link",
    chk:    "Checkbox",
    cb:     "Checkbox",
    rdl:    "RadioButton",
    rdo:    "RadioButton",
    grd:    "Grid",
    rgrid:  "Grid",
    dg:     "Grid",
    tbl:    "Table",
    tab:    "Tab",
    cal:    "DatePicker",
    dp:     "DatePicker",
    lbl:    "Custom",   // label — skip naming
    pnl:    "Custom",
    img:    "Custom"
};

// ─────────────────────────────────────────────────────────────────────────────
// Playwright action keyword → control type hint
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_TYPE_MAP: Record<string, ControlType> = {
    fill:          "TextBox",
    type:          "TextBox",
    presssequentially: "TextBox",
    selectoption:  "Dropdown",
    "check(":      "Checkbox",
    "uncheck(":    "Checkbox",
    click:         "Button",
    dblclick:      "Button",
    tap:           "Button",
    goto:          "Link"
};

export interface ClassificationResult {
    controlType: ControlType;
    confidence: number;
    source: "id-prefix" | "playwright-action" | "role-attribute" | "tag-inferred" | "fallback";
    tag?: string;
    inputType?: string;
}

export class DomClassifier {

    /**
     * Classify a control given its raw locator string and the
     * Playwright source line it came from.
     */
    public classify(locator: string, rawLine: string): ClassificationResult {

        // 1. Playwright role selector has explicit type
        const roleResult = this.classifyByRole(rawLine);
        if (roleResult) return roleResult;

        // 2. CSS ID prefix
        const idResult = this.classifyByCssIdPrefix(locator);
        if (idResult) return idResult;

        // 3. Playwright action keyword
        const actionResult = this.classifyByAction(rawLine);
        if (actionResult) return actionResult;

        return {
            controlType: "Custom",
            confidence: 0.3,
            source: "fallback"
        };
    }

    private classifyByRole(line: string): ClassificationResult | null {
        const lower = line.toLowerCase();

        // getByRole('button') or getByRole("button")
        const roleMatch = line.match(/getByRole\(\s*['"`](\w+)['"`]/i);
        if (!roleMatch) return null;

        const role = roleMatch[1].toLowerCase();

        const roleMap: Record<string, ControlType> = {
            button:      "Button",
            link:        "Link",
            checkbox:    "Checkbox",
            radio:       "RadioButton",
            textbox:     "TextBox",
            combobox:    "Dropdown",
            listbox:     "Dropdown",
            option:      "Dropdown",
            tab:         "Tab",
            grid:        "Grid",
            row:         "Grid",
            cell:        "Grid",
            table:       "Table",
            treeitem:    "Tree"
        };

        const ct = roleMap[role];
        if (!ct) return { controlType: "Custom", confidence: 0.6, source: "role-attribute" };

        return { controlType: ct, confidence: 0.95, source: "role-attribute" };
    }

    private classifyByCssIdPrefix(locator: string): ClassificationResult | null {
        // Extract last segment of compound ContentPlaceHolder ID
        // e.g. #ctl00_ContentPlaceHolder1_ddlSearchUser → ddlSearchUser
        const idMatch = locator.match(/#[^#\s]+$/);
        if (!idMatch) return null;

        const rawId = idMatch[0].replace('#', '');

        // Take the LAST underscore-delimited segment to skip ASP.NET wrapper prefixes
        const segments = rawId.split('_');
        const cleanId = segments[segments.length - 1];

        for (const prefix of Object.keys(ID_PREFIX_MAP).sort((a, b) => b.length - a.length)) {
            if (cleanId.toLowerCase().startsWith(prefix)) {
                return {
                    controlType: ID_PREFIX_MAP[prefix],
                    confidence: 0.85,
                    source: "id-prefix",
                    tag: this.guessTagFromType(ID_PREFIX_MAP[prefix])
                };
            }
        }

        return null;
    }

    private classifyByAction(line: string): ClassificationResult | null {
        const lower = line.toLowerCase();

        for (const [action, ct] of Object.entries(ACTION_TYPE_MAP)) {
            if (lower.includes(action)) {
                return {
                    controlType: ct,
                    confidence: 0.7,
                    source: "playwright-action"
                };
            }
        }

        return null;
    }

    private guessTagFromType(ct: ControlType): string {
        switch (ct) {
            case "Dropdown":     return "select";
            case "TextBox":      return "input";
            case "Checkbox":     return "input";
            case "RadioButton":  return "input";
            case "Button":       return "button";
            case "Link":         return "a";
            case "Grid":         return "table";
            case "Table":        return "table";
            default:             return "div";
        }
    }

    /**
     * Returns the strategy most likely to produce a stable selector
     * for the given locator string.
     */
    public rankStrategy(locator: string): LocatorStrategy {
        const lower = locator.toLowerCase();

        if (lower.includes("data-testid"))   return "data-testid";
        if (lower.startsWith("aria"))         return "aria-label";
        if (lower.includes("getbyrole"))      return "role";
        if (lower.includes("getbylabel"))     return "label";
        if (lower.includes("getbyplaceholder")) return "placeholder";
        if (lower.includes("getbytext"))      return "text";
        if (lower.startsWith("#"))            return "id";
        if (lower.includes("[name="))         return "name";
        if (lower.startsWith("//") || lower.includes("xpath")) return "xpath";
        if (lower.includes("css:"))           return "css";

        return "unknown";
    }
}
