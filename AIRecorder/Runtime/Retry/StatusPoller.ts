import type { Locator, Page } from "@playwright/test";
import { BusinessRetryContext } from "./BusinessRetryContext";
import { PageRefreshManager } from "./PageRefreshManager";
import { RetryEngine } from "./RetryEngine";

export class StatusPoller {

    private readonly retries =
        new RetryEngine();

    private readonly refresh =
        new PageRefreshManager();

    public async waitForStatus(
        page: Page,
        statusLocator: Locator,
        context: BusinessRetryContext
    ): Promise<string> {

        return this.retries.waitUntilAsync(
            async () => {
                if (context.refreshBeforePoll)
                    await this.refresh.refresh(page);

                return await statusLocator.innerText();
            },
            context.expectedValue,
            context.policy
        );

    }

}
