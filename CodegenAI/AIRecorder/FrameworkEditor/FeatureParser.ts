export interface ParsedFeature {

    featureName: string;

    scenarios: string[];

    insertionIndex: number;

}

export function parseFeature(
    content: string
): ParsedFeature {

    const featureMatch =
        content.match(
            /^Feature:\s*(.+)$/m
        );

    const scenarios: string[] = [];

    const regex =
        /^Scenario:\s*(.+)$/gm;

    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {

        scenarios.push(
            match[1].trim()
        );

    }

    const insertionIndex =
    content.trimEnd().length;

    return {

        featureName:
            featureMatch?.[1].trim() ?? "",

        scenarios,

        insertionIndex

    };

}