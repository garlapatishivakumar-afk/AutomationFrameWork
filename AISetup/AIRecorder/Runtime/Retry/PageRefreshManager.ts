import type { Page } from "@playwright/test";

export class PageRefreshManager {

    public async refresh(page: Page): Promise<void> {

        await page.reload({ waitUntil: "domcontentloaded" });

    }

}
