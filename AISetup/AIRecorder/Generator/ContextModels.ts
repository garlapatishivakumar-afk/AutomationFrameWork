export interface ExistingCodeSnapshot {

    methods: string[];

    locators: string[];

    steps: string[];

    scenarios: string[];

    helpers: string[];

    excelFiles: string[];

    pageObjects: string[];

    methodFiles: string[];

    featureFiles: string[];

}

export interface FrameworkRule {

    id: string;

    description: string;

    required: boolean;

}

export interface GeneratorContext {

    featureName: string;

    pageName: string;

    application: string;

    objective: string;

    existingCode: ExistingCodeSnapshot;

    rules: FrameworkRule[];

}
