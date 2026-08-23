import fs from "fs";
import path from "path";
import { ActionType, FlowAction, FlowAnalysis } from "./Models/AIModels";

export type { ActionType, FlowAction, FlowAnalysis } from "./Models/AIModels";

function readCode(
    projectRoot: string
) {

    const file = path.join(
        projectRoot,
        "AIRecorder",
        "code.ts"
    );

    return fs.readFileSync(
        file,
        "utf8"
    );

}

function extractLocator(raw: string): string | undefined {

    const roleMatch = raw.match(/name:\s*['"`]([^'"`]+)['"`]/i);
    if (roleMatch)
        return roleMatch[1];

    const labelMatch = raw.match(/getByLabel\(\s*['"`]([^'"`]+)['"`]/i);
    if (labelMatch)
        return labelMatch[1];

    const locatorMatch = raw.match(/locator\(\s*['"`]([^'"`]+)['"`]/i);
    if (locatorMatch)
        return locatorMatch[1];

    return undefined;

}

/**
 * V2.1: Returns the full canonical locator expression used as the matching key
 * in LiveObservations. Must match exactly what LiveObserver.extractLocator() produces.
 *
 * getBy* calls → full expression, e.g. "getByRole('button', { name: 'Search Queue' })"
 * CSS/XPath    → the selector string, e.g. "#ctl00_ContentPlaceHolder1_ddlSearchUser"
 */
function extractCanonicalLocator(raw: string): string | undefined {
    // Full getBy* expression
    const getByMatch = raw.match(/getBy(?:Role|Label|Text|Placeholder|TestId)\([^)]+\)/i);
    if (getByMatch) return getByMatch[0];

    // CSS / XPath selector value
    const cssMatch = raw.match(/locator\(\s*['"`]([^'"`]+)['"`]/i);
    if (cssMatch) return cssMatch[1];

    return undefined;
}

function extractPage(raw: string): string | undefined {

    const pageMatch = raw.match(/goto\(\s*['"`]([^'"`]+)['"`]/i);

    if (!pageMatch)
        return undefined;

    return pageMatch[1];

}

function addAction(

    analysis: FlowAnalysis,

    line: number,

    type: ActionType,

    raw: string,

    locator?: string,

    value?: string,

    page?: string

) {

    analysis.actions.push({

        line,

        type,

        locator,

        canonicalLocator: extractCanonicalLocator(raw),

        value,

        page,

        raw

    });

}

export function analyzeFlow(
    projectRoot: string = process.cwd()
): FlowAnalysis {

    const code = readCode(projectRoot);

    const lines = code.split(/\r?\n/);

    const analysis: FlowAnalysis = {

        textboxLines: [],
        dropdownLines: [],
        clickLines: [],
        popupLines: [],
        gridLines: [],
        navigationLines: [],
        uploadLines: [],
        downloadLines: [],
        statusLines: [],
        textCaptureLines: [],
        actions: []
    };

    lines.forEach((line, index) => {

        const number = index + 1;

        const current = line.toLowerCase();

        if (
            current.includes("fill") ||
            current.includes("enter") ||
            current.includes("type")
        ) {
            analysis.textboxLines.push(number);

            addAction(

                analysis,

                number,

                "Textbox",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("select") ||
            current.includes("choose")
        ) {
            analysis.dropdownLines.push(number);

            addAction(

                analysis,

                number,

                "Dropdown",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("check(") ||
            current.includes("uncheck(")
        ) {
            addAction(

                analysis,

                number,

                "Checkbox",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("click") ||
            current.includes("press") ||
            current.includes("submit") ||
            current.includes("save")
        ) {
            analysis.clickLines.push(number);

            addAction(

                analysis,

                number,

                "Click",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("popup") ||
            current.includes("dialog")
        ) {
            analysis.popupLines.push(number);

            addAction(

                analysis,

                number,

                "Popup",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("grid") ||
            current.includes("table") ||
            current.includes("row")
        ) {
            analysis.gridLines.push(number);

            addAction(

                analysis,

                number,

                "Grid",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("goto") ||
            current.includes("navigate")
        ) {
            analysis.navigationLines.push(number);

            addAction(

                analysis,

                number,

                "Navigate",

                line,

                undefined,

                undefined,

                extractPage(line)

            );
        }

        if (
            current.includes("upload")
        ) {
            analysis.uploadLines.push(number);

            addAction(

                analysis,

                number,

                "Upload",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("download")
        ) {
            analysis.downloadLines.push(number);

            addAction(

                analysis,

                number,

                "Download",

                line,

                extractLocator(line)

            );
        }

        if (
            current.includes("innertext") ||
            current.includes("gettext") ||
            current.includes("readtext") ||
            current.includes("store")
        ) {
            analysis.textCaptureLines.push(number);

            addAction(

                analysis,

                number,

                "CaptureText",

                line,

                extractLocator(line)

            );
        }

        if (
            !current.startsWith("import") &&
            (
                current.includes("expect(") ||
                current.includes("verify") ||
                current.includes("validate") ||
                current.includes("tohave") ||
                current.includes("tobe") ||
                current.includes("waitfor")
            )
        ) {
            analysis.statusLines.push(number);

            addAction(

                analysis,

                number,

                "Validation",

                line,

                extractLocator(line)

            );
        }

    });

    return analysis;

}

if (require.main === module) {

    const result = analyzeFlow();

    fs.writeFileSync(
        "AIRecorder/FlowAnalysis.json",
        JSON.stringify(result, null, 4)
    );

    console.log(
        result
    );

}
