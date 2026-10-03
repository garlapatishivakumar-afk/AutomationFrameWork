import { ContextWindowResult } from "./ContextWindow";

export class ContextCompressor {

    public compress(
        context: ContextWindowResult
    ): string {

        const output: string[] = [];

        if (context.methods.length) {

            output.push("Methods:");

            output.push(
                ...context.methods.map(x => `- ${x.value}`)
            );

        }

        if (context.locators.length) {

            output.push("");

            output.push("Locators:");

            output.push(
                ...context.locators.map(x => `- ${x.value}`)
            );

        }

        if (context.scenarios.length) {

            output.push("");

            output.push("Scenarios:");

            output.push(
                ...context.scenarios.map(x => `- ${x.value}`)
            );

        }

        if (context.helpers.length) {

            output.push("");

            output.push("Helpers:");

            output.push(
                ...context.helpers.map(x => `- ${x.value}`)
            );

        }

        return output.join("\n");

    }

}
