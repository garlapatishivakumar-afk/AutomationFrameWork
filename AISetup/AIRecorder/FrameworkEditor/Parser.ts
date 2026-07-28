export class Parser {

    findClassEnd(content: string): number {

        const classStart = content.search(
            /class\s+[A-Za-z0-9_]+/
        );

        if (classStart < 0)
            return -1;

        const firstBrace = content.indexOf(
            "{",
            classStart
        );

        if (firstBrace < 0)
            return -1;

        let depth = 1;

        for (
            let i = firstBrace + 1;
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

    findLastScenario(
        content: string
    ): number {

        return content.lastIndexOf("Scenario:");

    }

    findLastMethodEnd(
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

    let lastMethodEnd = -1;

    for (
        let i = classBrace + 1;
        i < content.length;
        i++
    ) {

        if (content[i] === "{")
            depth++;

        else if (content[i] === "}") {

            depth--;

            // every method ends at depth 1
            if (depth === 1)
                lastMethodEnd = i;

            // class ends
            if (depth === 0)
                break;
        }

    }

    return lastMethodEnd;

}

}
