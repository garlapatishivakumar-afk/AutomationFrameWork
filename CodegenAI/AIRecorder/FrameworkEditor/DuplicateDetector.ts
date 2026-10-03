import { ParsedClass } from "./CSharpParser";
import { ParsedFeature } from "./FeatureParser";

import { MethodComparer } from "./MethodComparer";
import { LocatorComparer } from "./LocatorComparer";
import { ScenarioComparer } from "./ScenarioComparer";

import { DuplicateResult } from "./DuplicateResult";

export class DuplicateDetector {

    private readonly methodComparer =
        new MethodComparer();

    private readonly locatorComparer =
        new LocatorComparer();

    private readonly scenarioComparer =
        new ScenarioComparer();

    checkClass(
        parsed: ParsedClass,
        methodName: string,
        locatorName: string
    ): DuplicateResult {

        return {

            hasDuplicate:

                this.methodComparer.contains(
                    parsed.methods,
                    methodName
                )

                ||

                this.locatorComparer.contains(
                    parsed.properties,
                    locatorName
                ),

            duplicateMethods:

                this.methodComparer.contains(
                    parsed.methods,
                    methodName
                )
                    ? [methodName]
                    : [],

            duplicateLocators:

                this.locatorComparer.contains(
                    parsed.properties,
                    locatorName
                )
                    ? [locatorName]
                    : [],

            duplicateScenarios: []

        };

    }

    checkFeature(
        parsed: ParsedFeature,
        scenarioName: string
    ): DuplicateResult {

        return {

            hasDuplicate:

                this.scenarioComparer.contains(
                    parsed.scenarios,
                    scenarioName
                ),

            duplicateMethods: [],

            duplicateLocators: [],

            duplicateScenarios:

                this.scenarioComparer.contains(
                    parsed.scenarios,
                    scenarioName
                )
                    ? [scenarioName]
                    : []

        };

    }

}