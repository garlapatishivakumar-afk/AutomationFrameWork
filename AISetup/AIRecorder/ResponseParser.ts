import { AIResponse } from "./Models/AIResponse";

export function parseAIResponse(
    response: string
): AIResponse {

    return JSON.parse(response);

}
