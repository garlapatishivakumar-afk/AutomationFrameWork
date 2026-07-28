import { BuiltContext } from "../ContextBuilder";
import { requiresExcel } from "./ExcelDetector";
import { detectLocators } from "./LocatorDetector";
import { detectMethodNames } from "./MethodDetector";
import detectScenarios from "./ScenarioDetector";
import { detectSteps } from "./StepDetector";
import { GenerationDecision } from "./DecisionModels";

export class DecisionEngine {

    public decide(
        context: BuiltContext
    ): GenerationDecision {

        const decision: GenerationDecision = {

            createMethods: [],

            createLocators: [],

            createSteps: [],

            createHelpers: [],

            createScenarios: [],

            createExcel: false,

            reuseMethods: [],

            reuseLocators: [],

            reuseSteps: [],

            reuseScenarios: []

        };

        const methodCandidates = detectMethodNames(context.flow);
        const locatorCandidates = detectLocators(context.flow);
        const stepCandidates = detectSteps(context.flow);
        const scenarioCandidates = detectScenarios(context.flow);

        for (const action of methodCandidates) {

            const exists =
                context.methods.some(x =>
                    x.name.toLowerCase().includes(action.toLowerCase())
                );

            if (exists)
                decision.reuseMethods.push(action);
            else
                decision.createMethods.push(action);

        }

        for (const locator of locatorCandidates) {

            const exists =
                context.locators.some(x =>
                    x.name.toLowerCase().includes(locator.toLowerCase())
                );

            if (exists)
                decision.reuseLocators.push(locator);
            else
                decision.createLocators.push(locator);

        }

        for (const step of stepCandidates) {

            const exists =
                context.steps.some(x =>
                    x.name.toLowerCase() === step.toLowerCase()
                );

            if (exists)
                decision.reuseSteps.push(step);
            else
                decision.createSteps.push(step);

        }

        for (const scenario of scenarioCandidates) {

            const exists =
                context.scenarios.some(x =>
                    x.name.toLowerCase() === scenario.toLowerCase()
                );

            if (exists)
                decision.reuseScenarios.push(scenario);
            else
                decision.createScenarios.push(scenario);

        }

        decision.createExcel =
            requiresExcel(context.flow);

        return decision;

    }

}