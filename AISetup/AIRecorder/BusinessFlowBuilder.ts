import fs from "fs";
import { FlowAction, FlowAnalysis } from "./Models/AIModels";

export type BusinessStep = {

    step:number;

    type:string;

    businessAction:string;

    line:number;
};

function convertAction(action: FlowAction): string {

    switch(action.type){

        case "Navigate":
            return "Open Application";

        case "Textbox":
            return `Enter ${action.locator ?? "Value"}`;

        case "Dropdown":
            return `Select ${action.locator ?? "Option"}`;

        case "Click":
            return `Click ${action.locator ?? "Button"}`;

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
            return `Capture ${action.locator ?? "Text"}`;

        default:
            return action.type;
    }

}

export function buildBusinessFlow(
    analysis:FlowAnalysis
):BusinessStep[]{

    return analysis.actions.map((a,index)=>({

        step:index+1,

        type:a.type,

        businessAction:convertAction(a),

        line:a.line

    }));

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