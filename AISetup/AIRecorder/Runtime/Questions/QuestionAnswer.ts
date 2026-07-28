import { QuestionType } from "./QuestionType";

export interface QuestionAnswer {

    questionId: string;

    type: QuestionType;

    value: string;

}
