import { FlowAnalysis } from "../Models/AIModels";

export function detectLocators(
    flow: FlowAnalysis
): string[] {

    const locators = new Set<string>();

    for (const action of flow.actions) {
        if (action.locator)
            locators.add(action.locator);
    }

    return [...locators];
}
