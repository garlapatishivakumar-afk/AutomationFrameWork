import { FlowAnalysis } from "../Models/AIModels";

const detectScenarios = (
    flow: FlowAnalysis
): string[] => {

    const scenarios = new Set<string>();

    const types = new Set(flow.actions.map(x => x.type));
    const rawLines = flow.actions.map(x => x.raw.toLowerCase()).join("\n");

    if (rawLines.includes("login") && types.has("Click")) {
        scenarios.add("User Login");
    }

    if (rawLines.includes("search")) {
        scenarios.add("Search Customer");
    }

    if (rawLines.includes("approve")) {
        scenarios.add("Approve Deal");
    }

    if (rawLines.includes("logout")) {
        scenarios.add("User Logout");
    }

    return [...scenarios];
};

export { detectScenarios };
export default detectScenarios;