import type { Locator, Page } from "@playwright/test";
import { ElementStabilityChecker } from "./ElementStabilityChecker";
import { LoaderDetector } from "./LoaderDetector";
import { WaitOptions } from "./WaitStrategy";

export class SmartWaitEngine {

    private readonly loaderDetector =
        new LoaderDetector();

    private readonly stabilityChecker =
        new ElementStabilityChecker();

    public async waitForPageReady(
        page: Page,
        options: WaitOptions = {}
    ): Promise<void> {

        const strategy = options.strategy ?? "loader-hidden";
        const timeoutMs = options.timeoutMs ?? 30000;

        switch (strategy) {
            case "domcontentloaded":
                await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
                return;
            case "networkidle":
                await page.waitForLoadState("networkidle", { timeout: timeoutMs });
                return;
            case "loader-hidden":
                await this.loaderDetector.waitForLoaderToDisappear(page, timeoutMs);
                return;
            case "none":
                return;
            default:
                await this.loaderDetector.waitForLoaderToDisappear(page, timeoutMs);
        }

    }

    public async waitForElementReady(
        locator: Locator,
        options: WaitOptions = {}
    ): Promise<void> {

        const timeoutMs = options.timeoutMs ?? 10000;
        const strategy = options.strategy ?? "element-stable";

        await locator.waitFor({
            state: "visible",
            timeout: timeoutMs
        });

        if (strategy === "element-stable") {
            await this.stabilityChecker.waitForStable(locator, {
                timeoutMs,
                pollMs: options.pollMs
            });
        }

    }

}
