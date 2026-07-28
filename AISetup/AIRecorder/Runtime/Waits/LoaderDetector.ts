import type { Page } from "@playwright/test";

export class LoaderDetector {

    private readonly selectors = [
        ".loader",
        ".loading",
        ".spinner",
        "[data-testid='loader']",
        "[aria-busy='true']"
    ];

    public async waitForLoaderToDisappear(
        page: Page,
        timeoutMs: number = 30000
    ): Promise<void> {

        for (const selector of this.selectors) {
            try {
                await page.locator(selector).first().waitFor({
                    state: "hidden",
                    timeout: timeoutMs
                });
            }
            catch {
                // Ignore individual selector misses and continue.
            }
        }

    }

}
