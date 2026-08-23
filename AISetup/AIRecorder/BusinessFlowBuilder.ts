import fs from "fs";
import path from "path";
import { FlowAction, FlowAnalysis } from "./Models/AIModels";

export type BusinessStep = {

    step:number;

    type:string;

    businessAction:string;

    line:number;

    // V2.1 Enhancement #5: semantic label when available from LiveObservations
    semanticLabel?: string;
};

// V2.1 Enhancement #5: load resolved names from LiveObservations.json if available
function loadResolvedNames(projectRoot: string = process.cwd()): Map<string, string> {
    const obsPath = path.join(projectRoot, "AIRecorder", "LiveObservations.json");
    const names = new Map<string, string>();
    try {
        if (!fs.existsSync(obsPath)) return names;
        const obs = JSON.parse(fs.readFileSync(obsPath, "utf8"));
        for (const o of (obs.observations ?? [])) {
            if (o.locator && o.resolvedName) {
                names.set(o.locator, o.resolvedName);
            }
        }
    } catch {
        // observations not available — degrade gracefully
    }
    return names;
}

function convertAction(action: FlowAction, resolvedNames: Map<string, string>): string {

    // V2.1: prefer semantic name when available
    const semantic = action.locator ? resolvedNames.get(action.locator) : undefined;
    const displayName = semantic ?? action.locator;

    switch(action.type){

        case "Navigate":
            return "Open Application";

        case "Textbox":
            return `Enter ${displayName ?? "Value"}`;

        case "Dropdown":
            return `Select ${displayName ?? "Option"}`;

        case "Click":
            return `Click ${displayName ?? "Button"}`;

        case "Popup":
            return "Handle Popup";

        case "Grid":
            return "Interact With Grid";

        case "Upload":
            return "Upload File";

        case "Download":
            return "Download File";

        case "Validation":
            return "Validate Page";

        case "CaptureText":
            return `Capture ${displayName ?? "Text"}`;

        default:
            return action.type;
    }

}

export function buildBusinessFlow(
    analysis:FlowAnalysis,
    projectRoot: string = process.cwd()
):BusinessStep[]{

    const resolvedNames = loadResolvedNames(projectRoot);

    return analysis.actions.map((a,index) => {

        const semantic = a.locator ? resolvedNames.get(a.locator) : undefined;

        return {
            step: index + 1,
            type: a.type,
            businessAction: convertAction(a, resolvedNames),
            line: a.line,
            semanticLabel: semantic
        };
    });

}

export function saveBusinessFlow(
    flow:BusinessStep[]
){

    fs.writeFileSync(

        "AIRecorder/BusinessFlow.json",

        JSON.stringify(flow,null,4)

    );

}

if(require.main===module){

    const analysis:FlowAnalysis=

        JSON.parse(

            fs.readFileSync(
                "AIRecorder/FlowAnalysis.json",
                "utf8"
            )
        );

    const flow=

        buildBusinessFlow(analysis);

    saveBusinessFlow(flow);

    console.log(flow);

}