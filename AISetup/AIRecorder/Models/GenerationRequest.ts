import { GeneratorType } from "./GeneratorType";

export interface GenerationRequest {

    type: GeneratorType;

    taskInstruction?: string;

    explicitPages?: string[];

    instruction: string;

    pages: string[];

    businessFlow: any;
}
