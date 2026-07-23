import type { Locator } from "@playwright/test";
import { SmartWaitEngine } from "../Waits/SmartWaitEngine";
import { PlaywrightActionLibrary } from "./PlaywrightActionLibrary";

export class SmartFillEngine {

    private readonly waits =
        new SmartWaitEngine();

    private readonly actions =
        new PlaywrightActionLibrary();

    public async fillAsync(
        locator: Locator,
        value: string
    ): Promise<void> {

        await this.waits.waitForElementReady(locator);
        await this.actions.fill(locator, value);

    }

}
