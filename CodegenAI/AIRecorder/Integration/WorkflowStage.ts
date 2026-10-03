export type WorkflowStage =
    | "Planning"
    | "KnowledgeRetrieval"
    | "PromptBuild"
    | "LLM"
    | "Review"
    | "AutoFix"
    | "Approval"
    | "ArtifactGeneration"
    | "WriteFiles"
    | "History"
    | "Done";
