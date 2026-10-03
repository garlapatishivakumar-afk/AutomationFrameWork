import { RecommendationResult } from "../Learning/RecommendationEngine";

export interface FeedbackResult {

    ingestedCount: number;

    retrievedCount: number;

    recommendations: RecommendationResult[];

    knowledgeSize: number;

}
