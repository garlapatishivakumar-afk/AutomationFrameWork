import { ExistingCodeSnapshot } from "./ContextModels";

export class ExistingCodeCollector {

    public collect(): ExistingCodeSnapshot {

        // TODO Phase 6: collect existing artifacts from PageActions/, PageElements/, StepDefinitions/, Features/, and Helpers/.

        return {

            methods: [],

            locators: [],

            steps: [],

            scenarios: [],

            helpers: [],

            excelFiles: [],

            pageObjects: [],

            methodFiles: [],

            featureFiles: []

        };

    }

}
