export interface PromptContext {

    featureName: string;

    pageName: string;

    application: string;

    objective: string;

    constraints: string[];

}

export interface PromptRequest {

    templateName: string;

    context: PromptContext;

}

export interface PromptResult {

    prompt: string;

    metadata: Record<string, string>;

}

export interface AIResponse {

    raw: string;

}

export interface ParsedAIResponse {

    methods: string[];

    locators: string[];

    steps: string[];

    scenarios: string[];

    helpers: string[];

}
