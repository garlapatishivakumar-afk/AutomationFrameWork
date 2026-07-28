import { LearningPipeline } from "./LearningPipeline";

const pipeline =
    new LearningPipeline();

pipeline.run(

    [

        {
            key: "OpenDealsPage",
            value: "OpenDealsCompletionStatusPageAsync",
            source: "PageAction",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "ApproveDeal",
            value: "ApproveDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "RejectDeal",
            value: "RejectDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "AmountLocator",
            value: "DealViewAmountLinks",
            source: "Locator",
            usageCount: 0,
            lastUsed: ""
        }

    ],

    "Open Deal Page"

);

pipeline.run(

    [

        {
            key: "OpenDealsPage",
            value: "OpenDealsCompletionStatusPageAsync",
            source: "PageAction",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "ApproveDeal",
            value: "ApproveDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "RejectDeal",
            value: "RejectDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "AmountLocator",
            value: "DealViewAmountLinks",
            source: "Locator",
            usageCount: 0,
            lastUsed: ""
        }

    ],

    "Open Deal Page"

);

pipeline.run(

    [

        {
            key: "OpenDealsPage",
            value: "OpenDealsCompletionStatusPageAsync",
            source: "PageAction",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "ApproveDeal",
            value: "ApproveDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "RejectDeal",
            value: "RejectDealAsync",
            source: "Method",
            usageCount: 0,
            lastUsed: ""
        },

        {
            key: "AmountLocator",
            value: "DealViewAmountLinks",
            source: "Locator",
            usageCount: 0,
            lastUsed: ""
        }

    ],

    "Open Deal Page"

);

console.log(

    pipeline

        .getLearningEngine()

        .getKnowledgeBase()

        .statistics()

);

const result =
    pipeline.run(

        [

            {
                key: "OpenDealsPage",
                value: "OpenDealsCompletionStatusPageAsync",
                source: "PageAction",
                usageCount: 0,
                lastUsed: ""
            },

            {
                key: "ApproveDeal",
                value: "ApproveDealAsync",
                source: "Method",
                usageCount: 0,
                lastUsed: ""
            },

            {
                key: "RejectDeal",
                value: "RejectDealAsync",
                source: "Method",
                usageCount: 0,
                lastUsed: ""
            },

            {
                key: "AmountLocator",
                value: "DealViewAmountLinks",
                source: "Locator",
                usageCount: 0,
                lastUsed: ""
            }

        ],

        "Open Deal Page"

    );

console.log(result);
