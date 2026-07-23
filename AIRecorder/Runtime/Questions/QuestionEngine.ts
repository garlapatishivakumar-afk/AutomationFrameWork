import fs from "fs";
import path from "path";
import { QuestionBuilder } from "./QuestionBuilder";
import { QuestionSession } from "./QuestionSession";

export interface QuestionEngineResult {

    session: QuestionSession;

    findings: {
        statusField?: string;
        hasCapture: boolean;
        hasValidation: boolean;
    };

}

export class QuestionEngine {

    private readonly builder =
        new QuestionBuilder();

    public analyzeCodeFile(
        projectRoot: string,
        relativeCodePath: string = path.join("AIRecorder", "code.ts")
    ): QuestionEngineResult {

        const filePath = path.join(projectRoot, relativeCodePath);

        if (!fs.existsSync(filePath)) {
            return {
                session: new QuestionSession(),
                findings: {
                    hasCapture: false,
                    hasValidation: false
                }
            };
        }

        const raw = fs.readFileSync(filePath, "utf8");
        return this.analyzeContent(raw);

    }

    public analyzeContent(
        content: string
    ): QuestionEngineResult {

        const session = new QuestionSession();
        const lower = content.toLowerCase();

        const statusMatch = content.match(/status|workflow status|deal status/i);
        const statusField = statusMatch?.[0];

        const hasCapture = /(innertext|inputvalue|getattribute|selectedoption)/i.test(content)
            || /(transaction\s*id|workflow\s*id|deal\s*id|amount)/i.test(lower);

        const hasValidation = /(expect\(|validate|assert|success|error|grid|status)/i.test(lower);

        if (statusField) {
            for (const question of this.builder.buildStatusQuestions(statusField))
                session.addQuestion(question);
        }

        if (hasCapture)
            session.addQuestion(this.builder.buildCaptureQuestion());

        if (hasValidation)
            session.addQuestion(this.builder.buildValidationQuestion());

        return {
            session,
            findings: {
                statusField,
                hasCapture,
                hasValidation
            }
        };

    }

}
