import { LLMExecutionResult } from "./LLMExecutionResult";

export interface StreamingCallbacks {

    onStarted?(): void;

    onToken?(token: string): void;

    onCompleted?(result: LLMExecutionResult): void;

    onError?(error: Error): void;

}
