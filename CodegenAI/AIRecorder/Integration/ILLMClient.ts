import { LLMRequest } from "./LLMRequest";
import { LLMExecutionResult } from "./LLMExecutionResult";

export interface ILLMClient {

    complete(
        request: LLMRequest
    ): Promise<LLMExecutionResult>;

}
