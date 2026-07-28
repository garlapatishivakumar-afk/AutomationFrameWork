import { QuestionAnswer } from "./QuestionAnswer";

export interface SessionQuestion {

    id: string;

    type: string;

    text: string;

    options?: string[];

}

export class QuestionSession {

    public readonly questions: SessionQuestion[] = [];

    public readonly answers: QuestionAnswer[] = [];

    public addQuestion(question: SessionQuestion): void {

        this.questions.push(question);

    }

    public addAnswer(answer: QuestionAnswer): void {

        this.answers.push(answer);

    }

    public getAnswer(questionId: string): QuestionAnswer | undefined {

        return this.answers.find(x => x.questionId === questionId);

    }

}
