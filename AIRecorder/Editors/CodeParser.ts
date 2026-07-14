export type ParsedMethod = {
    name: string;
    signature: string;
    body: string;
};

export type ParsedLocator = {
    name: string;
    declaration: string;
};

export type ParsedClass = {
    name: string;
};

export type ParsedStep = {
    text: string;
    method: string;
};

export class CodeParser {

    public getMethods(code: string): ParsedMethod[] {

        const methods: ParsedMethod[] = [];

        const regex =
            /(public|private|protected)\s+async\s+Task(?:)?\s+(\w+)/g;

        let match;

        while ((match = regex.exec(code)) !== null) {

            methods.push({

                name: match[2],

                signature: match[0],

                body: ""

            });

        }

        return methods;

    }

    public getLocators(code: string): ParsedLocator[] {

        const locators: ParsedLocator[] = [];

        const regex =
            /(ILocator|Locator|IElementHandle)\s+(\w+)/g;

        let match;

        while ((match = regex.exec(code)) !== null) {

            locators.push({

                name: match[2],

                declaration: match[0]

            });

        }

        return locators;

    }

    public getClasses(code: string): ParsedClass[] {

        const classes: ParsedClass[] = [];

        const regex =
            /class\s+(\w+)/g;

        let match;

        while ((match = regex.exec(code)) !== null) {

            classes.push({

                name: match[1]

            });

        }

        return classes;

    }

    public getSteps(code: string): ParsedStep[] {

        const steps: ParsedStep[] = [];

        const regex =
            /\[(Given|When|Then)\(@"([^"]+)"\)\][\s\S]*?Task\s+(\w+)/g;

        let match;

        while ((match = regex.exec(code)) !== null) {

            steps.push({

                text: match[2],

                method: match[3]

            });

        }

        return steps;

    }

}
