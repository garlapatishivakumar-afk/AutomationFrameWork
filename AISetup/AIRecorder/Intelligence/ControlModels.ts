// V2.1 Enhancement #2 — DOM/Control/Label Intelligence models
// These are internal metadata models. They are not user-facing artifacts.

export type ControlType =
    | "Button"
    | "TextBox"
    | "Dropdown"
    | "Checkbox"
    | "RadioButton"
    | "Link"
    | "Table"
    | "Grid"
    | "Tree"
    | "Tab"
    | "DatePicker"
    | "Custom";

export type LocatorStrategy =
    | "aria-label"
    | "data-testid"
    | "id"
    | "name"
    | "label"
    | "placeholder"
    | "text"
    | "role"
    | "xpath"
    | "css"
    | "unknown";

export interface TableHint {
    isTableLocator: boolean;
    // Evidence of a fragile row-index dependency, e.g. "ctl05", "ctl07"
    rowIndexEvidence?: string;
    // Suggested stable row identifier if detectable from context
    suggestedRowIdentifier?: string;
    confidence: number;
}

export interface ControlObservation {
    /** Original locator string extracted from code.ts */
    locator: string;
    /** Classified control type */
    controlType: ControlType;
    /** 0.0 – 1.0 */
    confidence: number;
    /** Semantic name suitable for use in PageElements, e.g. "SearchUserDropdown" */
    resolvedName?: string;
    /** Human-readable label from aria/label/id-derived/visible text */
    label?: string;
    placeholder?: string;
    visibleText?: string;
    ariaLabel?: string;
    title?: string;
    /** "text" | "password" | "checkbox" | "radio" | ... (for <input> elements) */
    inputType?: string;
    /** "input" | "select" | "button" | "a" | ... */
    tag?: string;
    /** URL of the page where this element appears */
    pageUrl?: string;
    /** The stripped ID portion, e.g. "ddlSearchUser" parsed from CSS selector */
    rawIdHint?: string;
    /** 0.0 – 1.0 higher = more stable */
    stabilityScore: number;
    /** Best strategy to use for this locator */
    preferredStrategy: LocatorStrategy;
    /** Ordered fallback strategies */
    fallbackStrategies: LocatorStrategy[];
    /** Whether this locator is associated with a table/grid */
    isTableControl: boolean;
    tableInfo?: TableHint;
    /** Playwright action that generated this locator */
    playwrightAction?: string;
}

export interface LiveObservations {
    capturedAt: string;
    /** Method used to produce these observations */
    method: "static-analysis";
    observations: ControlObservation[];
}
