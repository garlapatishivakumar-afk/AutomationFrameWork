import { Parser } from "./Parser";

const parser = new Parser();

export interface ParsedClass {

    namespaceName: string;

    className: string;

    methods: string[];

    properties: string[];

    lastMethodEnd: number;

}

export function parseCSharp(
    content: string
): ParsedClass {

    const namespaceMatch =
        content.match(
            /namespace\s+([A-Za-z0-9_.]+)/
        );

    const classMatch =
        content.match(
            /class\s+([A-Za-z0-9_]+)/
        );

    const methods = new Set<string>();

    const methodRegex =
        /(public|private|protected)\s+async\s+Task(?:<.*?>)?\s+([A-Za-z0-9_]+)/g;

    let match: RegExpExecArray | null;

    while ((match = methodRegex.exec(content)) !== null) {

        methods.add(match[2]);

    }

    const properties: string[] = [];

    const propertyRegex =
        /(ILocator|Locator|IElementHandle)\s+([A-Za-z0-9_]+)/g;

    while ((match = propertyRegex.exec(content)) !== null) {

        properties.push(match[2]);

    }

    return {

        namespaceName:
            namespaceMatch?.[1] ?? "",

        className:
            classMatch?.[1] ?? "",

        methods:
            [...methods],

        properties,

        lastMethodEnd:
            parser.findLastMethodEnd(content)

    };

}