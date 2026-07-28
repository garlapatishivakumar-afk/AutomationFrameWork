import { ContextCompressor } from "./ContextCompressor";
import { ContextWindow } from "./ContextWindow";
import { LearningEntry } from "./LearningModels";

export interface RAGContext {

    prompt: string;

    methods: LearningEntry[];

    locators: LearningEntry[];

    scenarios: LearningEntry[];

    helpers: LearningEntry[];

}

export class RAGContextBuilder {

    private readonly window =
        new ContextWindow();

    private readonly compressor =
        new ContextCompressor();

    public build(
        entries: LearningEntry[],
        maxItems = 10
    ): RAGContext {

        const window =
            this.window.build(entries, maxItems);

        return {

            prompt:
                this.compressor.compress(window),

            methods:
                window.methods,

            locators:
                window.locators,

            scenarios:
                window.scenarios,

            helpers:
                window.helpers

        };

    }

}
