import {
    FrameworkIntelligenceEngine,
    IntelligenceResult
} from "./FrameworkIntelligenceEngine";

export class IntelligencePipeline {

    private readonly engine =
        new FrameworkIntelligenceEngine();

    public run(rootPath: string): IntelligenceResult {

        return this.engine.scanAndAnalyze(rootPath);

    }

    public getEngine(): FrameworkIntelligenceEngine {

        return this.engine;

    }

}
