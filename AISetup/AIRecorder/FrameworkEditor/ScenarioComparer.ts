export class ScenarioComparer {

    contains(
        existingScenarios: string[],
        scenarioName: string
    ): boolean {

        return existingScenarios.some(

            existing =>

                existing.trim().toLowerCase() ===
                scenarioName.trim().toLowerCase()

        );

    }

    find(
        existingScenarios: string[],
        scenarioName: string
    ): string | null {

        const scenario = existingScenarios.find(

            existing =>

                existing.trim().toLowerCase() ===
                scenarioName.trim().toLowerCase()

        );

        return scenario ?? null;

    }

}