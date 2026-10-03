import fs from "fs";
import path from "path";
import { CodeParser } from "./CodeParser";

type ClassBlock = {
    openBrace: number;
    closeBrace: number;
};

export class FrameworkEditor {

    private parser = new CodeParser();

    public insertMethod(
        file: string,
        methodName: string,
        methodCode: string,
        targetClass?: string
    ): boolean {

        let code = this.readFile(file);
        const methods = this.parser.getMethods(code);

        const resolvedMethodName = this.extractMethodName(methodCode) || methodName;

        const exists = methods.some(x => x.name === resolvedMethodName);

        if (exists)
            return false;

        if (!code.trim()) {
            const className = targetClass || "GeneratedMethods";
            const initial = this.createClassWithMember(className, methodCode);
            this.writeFile(file, this.formatCode(initial));
            return true;
        }

        const updated = this.insertIntoTargetClass(
            code,
            methodCode,
            targetClass,
            targetClass || "GeneratedMethods"
        );

        this.writeFile(file, this.formatCode(updated));

        return true;

    }

    public insertLocator(
        file: string,
        locatorName: string,
        locatorCode: string,
        targetClass?: string
    ): boolean {

        let code = this.readFile(file);
        const locators = this.parser.getLocators(code);

        const exists = locators.some(x => x.name === locatorName);

        if (exists)
            return false;

        if (!code.trim()) {
            const className = targetClass || "GeneratedObjects";
            const initial = this.createClassWithMember(className, locatorCode);
            this.writeFile(file, this.formatCode(initial));
            return true;
        }

        const updated = this.insertIntoTargetClass(
            code,
            locatorCode,
            targetClass,
            targetClass || "GeneratedObjects"
        );

        this.writeFile(file, this.formatCode(updated));

        return true;

    }

    public insertStep(
        file: string,
        stepName: string,
        stepCode: string,
        targetClass?: string
    ): boolean {

        let code = this.readFile(file);

        const existingSteps = this.parser.getSteps(code);
        const parsedIncoming = this.parser.getSteps(stepCode);

        const incomingText = parsedIncoming[0]?.text || stepName;
        const incomingMethod = parsedIncoming[0]?.method || this.extractMethodName(stepCode) || stepName;

        const exists = existingSteps.some(
            x => x.text === incomingText || x.method === incomingMethod
        );

        if (exists)
            return false;

        if (!code.trim()) {
            const className = targetClass || "GeneratedSteps";
            const initial = this.createClassWithMember(className, stepCode);
            this.writeFile(file, this.formatCode(initial));
            return true;
        }

        const updated = this.insertIntoTargetClass(
            code,
            stepCode,
            targetClass,
            targetClass || "GeneratedSteps"
        );

        this.writeFile(file, this.formatCode(updated));

        return true;

    }

    public insertScenario(
        file: string,
        scenarioName: string,
        scenarioText: string
    ): boolean {

        const existing = this.readFile(file);

        if (this.scenarioExists(existing, scenarioName))
            return false;

        const updated = existing.trim().length > 0
            ? `${existing.trimEnd()}\n\n${scenarioText.trim()}\n`
            : `${scenarioText.trim()}\n`;

        this.writeFile(file, this.formatCode(updated));

        return true;

    }

    public insertHelper(
        file: string,
        helperName: string,
        helperCode: string,
        targetClass?: string
    ): boolean {

        return this.insertMethod(
            file,
            helperName,
            helperCode,
            targetClass || "GeneratedHelpers"
        );

    }

    private readFile(file: string): string {

        if (!fs.existsSync(file))
            return "";

        return fs.readFileSync(file, "utf8");

    }

    private writeFile(file: string, content: string): void {

        const folder = path.dirname(file);

        if (!fs.existsSync(folder))
            fs.mkdirSync(folder, { recursive: true });

        fs.writeFileSync(file, content, "utf8");

    }

    private formatCode(code: string): string {

        const normalized = code.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
        return `${normalized}\n`;

    }

    private extractMethodName(code: string): string | undefined {

        const match = /(public|private|protected)\s+async\s+Task(?:)?\s+(\w+)/.exec(code);

        if (!match)
            return undefined;

        return match[2];

    }

    private scenarioExists(featureText: string, scenarioName: string): boolean {

        const escaped = scenarioName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const scenarioRegex = new RegExp(`^\\s*Scenario:\\s*${escaped}\\s*$`, "mi");

        return scenarioRegex.test(featureText);

    }

    private createClassWithMember(className: string, member: string): string {

        return `public class ${className}\n{\n${member.trim()}\n}\n`;

    }

    private insertIntoTargetClass(
        code: string,
        memberCode: string,
        targetClass: string | undefined,
        fallbackClass: string
    ): string {

        const classBlock = this.findClassBlock(code, targetClass)
            || this.findClassBlock(code, undefined);

        if (!classBlock) {
            return `${code.trimEnd()}\n\n${this.createClassWithMember(fallbackClass, memberCode)}`;
        }

        return code.slice(0, classBlock.closeBrace).trimEnd()
            + "\n\n"
            + memberCode.trim()
            + "\n"
            + code.slice(classBlock.closeBrace);

    }

    private findClassBlock(
        code: string,
        className?: string
    ): ClassBlock | undefined {

        const classRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
        let match: RegExpExecArray | null;

        while ((match = classRegex.exec(code)) !== null) {

            const foundName = match[1];

            if (className && foundName !== className)
                continue;

            const openBrace = code.indexOf("{", match.index);

            if (openBrace < 0)
                continue;

            const closeBrace = this.findMatchingBrace(code, openBrace);

            if (closeBrace < 0)
                continue;

            return {
                openBrace,
                closeBrace
            };

        }

        return undefined;

    }

    private findMatchingBrace(code: string, openBrace: number): number {

        let depth = 0;

        for (let i = openBrace; i < code.length; i++) {

            const ch = code[i];

            if (ch === "{")
                depth++;

            if (ch === "}") {
                depth--;

                if (depth === 0)
                    return i;
            }

        }

        return -1;

    }

}
