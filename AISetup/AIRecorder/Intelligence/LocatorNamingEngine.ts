// V2.1 Enhancement #4 — LocatorNamingEngine
// Produces a semantic PascalCase name for a control.
// e.g. label="Search User" + type=Dropdown → "SearchUserDropdown"

import { ControlType } from "./ControlModels";

// Control type suffix map matching the project's existing naming conventions
const TYPE_SUFFIX: Record<ControlType, string> = {
    Button:      "Button",
    TextBox:     "Textbox",
    Dropdown:    "Dropdown",
    Checkbox:    "Checkbox",
    RadioButton: "RadioButton",
    Link:        "Link",
    Table:       "Table",
    Grid:        "Grid",
    Tree:        "Tree",
    Tab:         "Tab",
    DatePicker:  "DatePicker",
    Custom:      ""
};

export class LocatorNamingEngine {

    /**
     * Derives a semantic name like "SearchUserDropdown" from label + control type.
     * Returns undefined when no confident name can be derived.
     */
    public derive(label: string, controlType: ControlType, confidence: number): string | undefined {

        if (confidence < 0.4 || !label) return undefined;

        const cleanLabel = this.toPascalCaseWords(label);
        if (!cleanLabel) return undefined;

        const suffix = TYPE_SUFFIX[controlType] ?? "";

        // Avoid redundancy: "SearchQueueButton" not "SearchQueueButtonButton"
        if (suffix && cleanLabel.toLowerCase().endsWith(suffix.toLowerCase())) {
            return cleanLabel;
        }

        return `${cleanLabel}${suffix}`;
    }

    /**
     * "Search User" → "SearchUser"
     * "deal number" → "DealNumber"
     */
    private toPascalCaseWords(text: string): string {
        return text
            .replace(/[^a-zA-Z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join("");
    }
}
