import type { Locator, Page } from "@playwright/test";

export class PlaywrightActionLibrary {

    public async fill(
        locator: Locator,
        value: string
    ): Promise<void> {

        await locator.fill(value);

    }

    public async selectByLabel(
        locator: Locator,
        label: string
    ): Promise<void> {

        await locator.selectOption({ label });

    }

    public async click(
        locator: Locator
    ): Promise<void> {

        await locator.click();

    }

    public async reload(
        page: Page
    ): Promise<void> {

        await page.reload();

    }

}
