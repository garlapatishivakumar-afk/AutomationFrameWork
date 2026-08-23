export type ActionType =
    | "Navigate"
    | "Click"
    | "Textbox"
    | "Dropdown"
    | "Checkbox"
    | "Radio"
    | "Popup"
    | "Grid"
    | "Upload"
    | "Download"
    | "Validation"
    | "CaptureText"
    | "Unknown";

export interface FlowAction {

    line: number;

    type: ActionType;

    /** Human-readable display name extracted from the locator (e.g. "Search Queue") */
    locator?: string;

    /**
     * V2.1: Full canonical locator expression as it appears in code.ts.
     * Used as the matching key against LiveObservations.
     * For getBy* calls: the full expression, e.g. "getByRole('button', { name: 'Search Queue' })"
     * For CSS/XPath: same as locator.
     */
    canonicalLocator?: string;

    value?: string;

    page?: string;

    raw: string;

}

export interface FlowAnalysis {

    textboxLines: number[];

    dropdownLines: number[];

    clickLines: number[];

    popupLines: number[];

    gridLines: number[];

    navigationLines: number[];

    uploadLines: number[];

    downloadLines: number[];

    statusLines: number[];

    textCaptureLines: number[];

    actions: FlowAction[];

}

export interface FrameworkArtifact {

    name: string;

    file: string;

    content: string;

}

export interface BuildContext {

    framework: string;

    dom: string;

    recordedFlow: string;

    flow: FlowAnalysis;

    pageContext: string;

    detectedPages: string[];

    includedFiles: string[];

    methods: FrameworkArtifact[];

    locators: FrameworkArtifact[];

    helpers: FrameworkArtifact[];

    scenarios: FrameworkArtifact[];

    steps: FrameworkArtifact[];

}

export interface GenerationDecision {

    createMethods: string[];

    createLocators: string[];

    createSteps: string[];

    createScenarios: string[];

    createHelpers: string[];

    createExcel: boolean;

    reuseMethods: string[];

    reuseLocators: string[];

    reuseSteps: string[];

    reuseScenarios: string[];

}

export interface AIRequest {

    task: string;

    context: BuildContext;

    decision: GenerationDecision;

}

export interface AIResponse {

    pageMethods: string[];

    locators: string[];

    steps: string[];

    scenarios: string[];

    helpers: string[];

    excel: string[];

}

export interface EditOperation {

    file: string;

    type:
        | "Method"
        | "Locator"
        | "Step"
        | "Scenario"
        | "Helper"
        | "Excel";

    content: string;

}
