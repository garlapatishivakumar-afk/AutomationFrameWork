export interface PlannerContext {

    projectRoot: string;

    detectedPages: string[];

    requiredMethods: string[];

    requiredLocators: string[];

    requiredSteps: string[];

    requiredScenarios: string[];

    requiredHelpers: string[];

    createExcel: boolean;

    featureName: string;

    pageName: string;

    application: string;

}
