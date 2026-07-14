import { ReviewRule } from "./ReviewRule";

export const ReviewRules: ReviewRule[] = [

    {
        id: "NoThreadSleep",
        description: "Do not use Thread.Sleep in generated code.",
        severity: "High",
        enabled: true
    },

    {
        id: "UseAwait",
        description: "Async operations must be awaited.",
        severity: "High",
        enabled: true
    },

    {
        id: "NoDuplicateDefinitions",
        description: "Do not generate duplicate methods or locators.",
        severity: "Medium",
        enabled: true
    }

];
