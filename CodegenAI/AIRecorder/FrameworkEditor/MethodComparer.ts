export class MethodComparer {

    contains(
        existingMethods: string[],
        methodName: string
    ): boolean {

        return existingMethods.some(

            existing =>

                existing.trim().toLowerCase() ===
                methodName.trim().toLowerCase()

        );

    }

    find(
        existingMethods: string[],
        methodName: string
    ): string | null {

        const method = existingMethods.find(

            existing =>

                existing.trim().toLowerCase() ===
                methodName.trim().toLowerCase()

        );

        return method ?? null;

    }

}