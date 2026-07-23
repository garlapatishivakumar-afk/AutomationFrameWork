import type { Locator } from "@playwright/test";
import { SmartDropdownEngine } from "./SmartDropdownEngine";
import { SmartFillEngine } from "./SmartFillEngine";

export type SmartActionType =
    | "fill"
    | "dropdown";

export interface SmartAction {

    type: SmartActionType;

    locator: Locator;

    value: string;

}

export class SmartActionEngine {

    private readonly fillEngine =
        new SmartFillEngine();

    private readonly dropdownEngine =
        new SmartDropdownEngine();

    public async execute(
        action: SmartAction
    ): Promise<void> {

        switch (action.type) {
            case "fill":
                await this.fillEngine.fillAsync(action.locator, action.value);
                return;
            case "dropdown":
                await this.dropdownEngine.selectAsync(action.locator, action.value);
                return;
            default:
                throw new Error(`Unsupported action type: ${String(action.type)}`);
        }

    }

}
