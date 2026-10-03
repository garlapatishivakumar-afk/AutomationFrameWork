import { FlowAnalysis } from "../Models/AIModels";

export function requiresExcel(
    flow: FlowAnalysis
): boolean {

    return flow.actions.some(action =>
        action.type === "Textbox"
        || action.type === "Dropdown"
    );

}
