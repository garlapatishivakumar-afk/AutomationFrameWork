export class LocatorComparer {

    contains(
        existingLocators: string[],
        locatorName: string
    ): boolean {

        return existingLocators.some(

            existing =>

                existing.trim().toLowerCase() ===
                locatorName.trim().toLowerCase()

        );

    }

    find(
        existingLocators: string[],
        locatorName: string
    ): string | null {

        const locator = existingLocators.find(

            existing =>

                existing.trim().toLowerCase() ===
                locatorName.trim().toLowerCase()

        );

        return locator ?? null;

    }

}