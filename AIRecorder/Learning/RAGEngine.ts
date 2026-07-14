import { KnowledgeBase } from "./KnowledgeBase";
import { LearningEntry } from "./LearningModels";
import { SemanticSearch } from "./SemanticSearch";

export class RAGEngine {

    private readonly search =
        new SemanticSearch();

    public retrieve(
        knowledgeBase: KnowledgeBase,
        query: string
    ): LearningEntry[] {

        return this.search.search(
            knowledgeBase.all(),
            query
        );

    }

}
