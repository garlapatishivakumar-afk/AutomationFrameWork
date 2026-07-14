import fs from "fs";
import path from "path";

import { parseCSharp } from "./CSharpParser";
import { ParsedClass } from "./CSharpParser";
import { ParsedFeature } from "./FeatureParser";

export class InsertEngine {

    private indentCSharpBlock(
        snippet: string
    ): string {

        return snippet
            .split("\n")
            .map(line => "        " + line)
            .join("\n");

    }

    private normalizeFeatureScenario(
        scenario: string
    ): string {

        const trimmed =
            scenario.trim();

        if (/^Scenario(?:\s+Outline)?:/m.test(trimmed))
            return trimmed;

        return `Scenario: ${trimmed}`;

    }

    private findClassEnd(
        content: string
    ): number {

        const classStart =
            content.search(
                /class\s+[A-Za-z0-9_]+/
            );

        if (classStart < 0)
            return -1;

        const classBrace =
            content.indexOf(
                "{",
                classStart
            );

        if (classBrace < 0)
            return -1;

        let depth = 1;

        for (
            let i = classBrace + 1;
            i < content.length;
            i++
        ) {

            if (content[i] === "{")
                depth++;

            else if (content[i] === "}")
                depth--;

            if (depth === 0)
                return i;

        }

        return -1;

    }

    insertMethod(
        content: string,
        parsed: ParsedClass,
        method: string
    ): string {

        if (parsed.lastMethodEnd < 0)
    return content;

        const formattedMethod =
            this.indentCSharpBlock(method);

        return (

content.substring(
0,
parsed.lastMethodEnd + 1
)

+

"\n\n"

+

formattedMethod

+

"\n"

+

content.substring(
parsed.lastMethodEnd + 1
)

);

    }

    insertLocator(
    content: string,
    parsed: ParsedClass,
    locator: string
): string {

    const classStart =
        content.indexOf("{");

    if (classStart < 0)
        return content;

    const insertPos =
        content.indexOf("\n", classStart);

    return (

        content.substring(
            0,
            insertPos
        )

        +

        "\n"

        +

        this.indentCSharpBlock(locator)

        +

        "\n"

        +

        content.substring(
            insertPos
        )

    );

}

    insertStep(
    content: string,
    parsed: ParsedClass,
    step: string
): string {

    return this.insertMethod(
        content,
        parsed,
        step
    );

}

    insertScenario(
    content: string,
    parsed: ParsedFeature,
    scenario: string
): string {

    const text =
        this.normalizeFeatureScenario(
            scenario
        );

    return (

        content.substring(
            0,
            parsed.insertionIndex
        )

        +

        "\n\n"

        +

        text

        +

        "\n"

        +

        content.substring(
            parsed.insertionIndex
        )

    );

}
}

if (require.main === module) {

    const file = path.join(
        process.cwd(),
        "PageActions",
        "DealsCompletionStatusMethods.cs"
    );

    const content = fs.readFileSync(
        file,
        "utf8"
    );

    const parsed =
        parseCSharp(content);

    const engine =
        new InsertEngine();

    const updated =
        engine.insertMethod(

            content,

            parsed,

`public async Task DemoMethodAsync()
{
    Console.WriteLine("AI");
}`

        );

    fs.writeFileSync(
        "TestOutput.cs",
        updated
    );

    console.log(
        "Generated TestOutput.cs"
    );

}