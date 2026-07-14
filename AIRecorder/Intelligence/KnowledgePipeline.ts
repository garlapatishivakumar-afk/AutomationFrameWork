import {
    FrameworkKnowledgeEngine,
    FrameworkKnowledgeSnapshot
} from "./FrameworkKnowledgeEngine";

export class KnowledgePipeline {

    private readonly engine =
        new FrameworkKnowledgeEngine();

    public run(
        updates: Partial<FrameworkKnowledgeSnapshot>[]
    ): FrameworkKnowledgeSnapshot {

        for (const update of updates)
            this.engine.update(update);

        return this.engine.getSnapshot();

    }

    public getEngine(): FrameworkKnowledgeEngine {

        return this.engine;

    }

}
