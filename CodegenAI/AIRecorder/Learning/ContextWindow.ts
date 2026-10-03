import { LearningEntry } from "./LearningModels";

export interface ContextWindowResult {

    methods: LearningEntry[];

    locators: LearningEntry[];

    scenarios: LearningEntry[];

    helpers: LearningEntry[];

}

export class ContextWindow {

    public build(
        entries: LearningEntry[],
        maxItems = 10
    ): ContextWindowResult {

        const top =
            entries.slice(0, maxItems);

        return {

            methods:
                top.filter(x => x.source === "Method"),

            locators:
                top.filter(x => x.source === "Locator"),

            scenarios:
                top.filter(x => x.source === "Scenario"),

            helpers:
                top.filter(x => x.source === "Helper")

        };

    }

}
