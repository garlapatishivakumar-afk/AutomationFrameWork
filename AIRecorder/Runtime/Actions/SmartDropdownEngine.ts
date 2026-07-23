import type { Locator } from "@playwright/test";
import { SmartWaitEngine } from "../Waits/SmartWaitEngine";
import { PlaywrightActionLibrary } from "./PlaywrightActionLibrary";

export class SmartDropdownEngine {

    private readonly waits =
        new SmartWaitEngine();

    private readonly actions =
        new PlaywrightActionLibrary();

    public async selectAsync(
        locator: Locator,
        label: string
    ): Promise<void> {

        await this.waits.waitForElementReady(locator);
        await this.actions.selectByLabel(locator, label);

    }

}
