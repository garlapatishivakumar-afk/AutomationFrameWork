import { SessionQuestion } from "./QuestionSession";

export class QuestionBuilder {

    public buildStatusQuestions(statusField: string): SessionQuestion[] {

        return [
            {
                id: "status_change",
                type: "status-change",
                text: `I found a status field (${statusField}). Does this status change during execution? (Y/N)`
            },
            {
                id: "status_retry",
                type: "retry",
                text: "Do you want retry until status becomes Completed? (Y/N)"
            }
        ];

    }

    public buildCaptureQuestion(): SessionQuestion {

        return {
            id: "capture_values",
            type: "capture",
            text: "Should I capture any value from this page?",
            options: [
                "Transaction Id",
                "Workflow Id",
                "Deal Id",
                "Amount",
                "Status",
                "User Name"
            ]
        };

    }

    public buildValidationQuestion(): SessionQuestion {

        return {
            id: "validation_types",
            type: "validation",
            text: "Do you need validation?",
            options: [
                "Success Message",
                "Error Message",
                "Grid Value",
                "Status",
                "Database",
                "API",
                "File Download"
            ]
        };

    }

}
