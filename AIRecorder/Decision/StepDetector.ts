import { FlowAnalysis } from "../Models/AIModels";

export function detectSteps(flow: FlowAnalysis): string[] {

    const steps = new Set<string>();

    for (const action of flow.actions) {

        if (action.type === "Navigate")
            steps.add("User navigates to application");

        if (action.type === "Textbox")
            steps.add("User enters data");

        if (action.type === "Click")
            steps.add("User clicks button");

        if (action.type === "Dropdown")
            steps.add("User selects option");

        if (action.type === "Checkbox")
            steps.add("User selects checkbox");

    }

    return [...steps];
}
