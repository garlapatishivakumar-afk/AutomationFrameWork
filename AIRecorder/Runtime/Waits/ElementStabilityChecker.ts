import type { Locator } from "@playwright/test";

export class ElementStabilityChecker {

    public async waitForStable(
        locator: Locator,
        options: {
            timeoutMs?: number;
            pollMs?: number;
            stableForChecks?: number;
        } = {}
    ): Promise<void> {

        const timeoutMs = options.timeoutMs ?? 10000;
        const pollMs = options.pollMs ?? 200;
        const stableForChecks = options.stableForChecks ?? 3;
        const startedAt = Date.now();

        let stableCount = 0;
        let previous = "";

        while (Date.now() - startedAt < timeoutMs) {
            const box = await locator.boundingBox();
            const current = box
                ? `${box.x.toFixed(2)}:${box.y.toFixed(2)}:${box.width.toFixed(2)}:${box.height.toFixed(2)}`
                : "none";

            if (current === previous)
                stableCount += 1;
            else
                stableCount = 0;

            if (stableCount >= stableForChecks)
                return;

            previous = current;
            await locator.page().waitForTimeout(pollMs);
        }

        throw new Error("Element did not become stable within timeout.");

    }

}
