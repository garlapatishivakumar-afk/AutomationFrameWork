import fs from "fs";
import path from "path";

type FrameworkItem = {
    pageAction?: string;
    pageObject?: string;
    stepDefinition?: string;
    feature?: string;
    methods: string[];
    locators: string[];
    steps: string[];
    scenarios: string[];
    helpers: string[];
};

function normalize(name: string): string {
    return name
        .replace("Methods", "")
        .replace("Objects", "")
        .replace("Steps", "")
        .replace(".feature", "")
        .trim();
}

function extractMetadata(filePath: string) {

    const content = fs.readFileSync(filePath, "utf8");

    return {

        methods:
            [...content.matchAll(/(?:public|private|protected)\s+async\s+Task(?:<.*?>)?\s+(\w+)/g)]
                .map(x => x[1]),

        locators:
            [...content.matchAll(/(?:ILocator|Locator|IElementHandle)\s+(\w+)/g)]
                .map(x => x[1]),

        steps:
            [...content.matchAll(/\[(?:Given|When|Then)\(@"([^"]+)"/g)]
                .map(x => x[1]),

        scenarios:
            [...content.matchAll(/Scenario:\s*(.+)/g)]
                .map(x => x[1]),

        helpers:
            [...content.matchAll(/(?:public|private|protected)\s+async\s+Task(?:<.*?>)?\s+(\w+)/g)]
                .map(x => x[1])

    };

}

export function buildFrameworkIndex(
    projectRoot: string = process.cwd()
) {

    const folders = [

        {
            folder: "PageActions",
            suffix: "Methods.cs",
            property: "pageAction"
        },

        {
            folder: "PageElements",
            suffix: "Objects.cs",
            property: "pageObject"
        },

        {
            folder: "StepDefinitions",
            suffix: "Steps.cs",
            property: "stepDefinition"
        },

        {
            folder: "Features",
            suffix: ".feature",
            property: "feature"
        }

    ];

    const index: Record<string, FrameworkItem> = {};

    for (const item of folders) {

        const folderPath = path.join(projectRoot, item.folder);

        if (!fs.existsSync(folderPath))
            continue;

        const files = fs.readdirSync(folderPath);

        for (const file of files) {

            if (!file.endsWith(item.suffix))
                continue;

            const pageName = normalize(
                file.replace(item.suffix, "")
            );
const metadata = extractMetadata(
    path.join(folderPath, file)
);
            if (!index[pageName])
                index[pageName] = {
                    methods: [],
                    locators: [],
                    steps: [],
                    scenarios: [],
                    helpers: []
                };

            (index[pageName] as any)[item.property] =
                path.join(item.folder, file);

            index[pageName].methods.push(...metadata.methods);
            index[pageName].locators.push(...metadata.locators);
            index[pageName].steps.push(...metadata.steps);
            index[pageName].scenarios.push(...metadata.scenarios);
            index[pageName].helpers.push(...metadata.helpers);
        }
    }

    const outputFile = path.join(
        projectRoot,
        "AIRecorder",
        "FrameworkIndex.json"
    );

    fs.writeFileSync(
        outputFile,
        JSON.stringify(index, null, 4)
    );

    console.log(
        `FrameworkIndex generated with ${Object.keys(index).length} pages.`
    );
}
if (require.main === module) {
    buildFrameworkIndex();
}