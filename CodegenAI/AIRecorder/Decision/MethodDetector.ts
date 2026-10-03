import { FlowAnalysis } from "../Models/AIModels";

export function detectMethodNames(
    flow: FlowAnalysis
): string[] {

    const methods = new Set<string>();

    for (const action of flow.actions) {

        switch (action.type) {
            case "Click":
                methods.add("Click");
                break;
            case "Textbox":
                methods.add("Fill");
                break;
            case "Checkbox":
                methods.add("Check");
                break;
            case "Dropdown":
                methods.add("Select");
                break;
            case "Navigate":
                methods.add("Navigate");
                break;
            case "Popup":
                methods.add("HandlePopup");
                break;
            case "Validation":
                methods.add("Validate");
                break;
            case "CaptureText":
                methods.add("CaptureText");
                break;
            default:
                break;
        }
    }

    return [...methods];

}
