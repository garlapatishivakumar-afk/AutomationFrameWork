import fs from "fs";
import path from "path";
import readline from "readline";
import { QuestionEngine } from "./Runtime/Questions/QuestionEngine";
import { RuntimeContext } from "./Runtime/Variables/RuntimeContext";

export type PlanningSession = {

    interactiveQuestions: string[];

    answers: Record<string, string>;

    runtimeVariables: {
        name: string;
        value: string;
        captureType: string;
    }[];

};

function ask(question: string): Promise<string> {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(`${question}\n`, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });

}

export async function buildPlanningSession(
    projectRoot: string = process.cwd()
): Promise<PlanningSession> {

    const questionEngine =
        new QuestionEngine();

    const runtimeContext =
        new RuntimeContext();

    const analysis =
        questionEngine.analyzeCodeFile(projectRoot);

    const answers: Record<string, string> = {};

    for (const question of analysis.session.questions) {
        const response = await ask(question.text);
        answers[question.id] = response;
    }

    if (answers.capture_values && answers.capture_values.length > 0) {
        runtimeContext.capture("capturedValues", answers.capture_values, "InnerText");
    }

    if (analysis.findings.statusField) {
        runtimeContext.capture("status", analysis.findings.statusField, "InnerText");
    }

    runtimeContext.persist(projectRoot);

    return {
        interactiveQuestions: analysis.session.questions.map(x => x.text),
        answers,
        runtimeVariables: runtimeContext
            .all()
            .map(variable => ({
                name: variable.name,
                value: variable.value,
                captureType: variable.captureType
            }))
    };

}

function saveSession(
    session: PlanningSession,
    projectRoot: string = process.cwd()
): void {

    const filePath = path.join(projectRoot, "AIRecorder", "PlanningSession.json");

    fs.writeFileSync(
        filePath,
        JSON.stringify(session, null, 4)
    );

}

if (require.main === module) {

    buildPlanningSession()
        .then(session => {
            saveSession(session);
            console.log(session);
        })
        .catch(error => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        });

}
