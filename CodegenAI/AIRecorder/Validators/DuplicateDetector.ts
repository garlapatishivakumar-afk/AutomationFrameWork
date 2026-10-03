import fs from "fs";
import { AIArtifact } from "../Models/AIArtifact";
import { CodeParser } from "../Editors/CodeParser";

export type DuplicateDecision = {
    action: "reuse" | "skip" | "generate";
    reason: string;
};

type MethodSignature = {
    returnType: string;
    name: string;
    parameters: string;
};

type LocatorInfo = {
    name: string;
    selector?: string;
};

export class DuplicateDetector {

    private parser = new CodeParser();

    public evaluate(
        artifact: AIArtifact,
        file: string
    ): DuplicateDecision {

        if (!fs.existsSync(file)) {
            return {
                action: "generate",
                reason: "Target file does not exist."
            };
        }

        const code = fs.readFileSync(file, "utf8");

        switch (artifact.artifactType) {

            case "Method":
            case "Helper":
                return this.evaluateMethodLike(artifact, code);

            case "Locator":
                return this.evaluateLocator(artifact, code);

            case "Step":
                return this.evaluateStep(artifact, code);

            case "Scenario":
                return this.evaluateScenario(artifact, code);

            case "Excel":
                return {
                    action: "generate",
                    reason: "Excel artifacts are file-level outputs."
                };
        }

    }

    private evaluateMethodLike(
        artifact: AIArtifact,
        code: string
    ): DuplicateDecision {

        const incoming = this.extractMethodSignature(artifact.content, artifact.name);

        if (!incoming) {
            return {
                action: "generate",
                reason: "Unable to parse incoming method signature."
            };
        }

        const existing = this.extractMethodSignatures(code);

        const exact = existing.find(
            x => x.name === incoming.name
                && this.normalizeType(x.returnType) === this.normalizeType(incoming.returnType)
                && this.normalizeParams(x.parameters) === this.normalizeParams(incoming.parameters)
        );

        if (exact) {
            return {
                action: "reuse",
                reason: `Exact method exists: ${incoming.name}`
            };
        }

        const similar = existing.find(
            x => x.name === incoming.name
                || (
                    this.normalizeType(x.returnType) === this.normalizeType(incoming.returnType)
                    && this.paramCount(x.parameters) === this.paramCount(incoming.parameters)
                )
        );

        if (similar) {
            return {
                action: "skip",
                reason: `Similar method signature exists for ${incoming.name}`
            };
        }

        return {
            action: "generate",
            reason: `No matching method found for ${incoming.name}`
        };

    }

    private evaluateLocator(
        artifact: AIArtifact,
        code: string
    ): DuplicateDecision {

        const incoming = this.extractLocatorInfo(artifact.content, artifact.name);
        const existing = this.extractLocatorInfos(code);

        const exact = existing.find(
            x => x.name === incoming.name
                && this.normalizeSelector(x.selector) === this.normalizeSelector(incoming.selector)
        );

        if (exact) {
            return {
                action: "reuse",
                reason: `Exact locator exists: ${incoming.name}`
            };
        }

        const similar = existing.find(
            x => x.name === incoming.name
                || (
                    x.selector
                    && incoming.selector
                    && this.normalizeSelector(x.selector) === this.normalizeSelector(incoming.selector)
                )
        );

        if (similar) {
            return {
                action: "skip",
                reason: `Similar locator exists for ${incoming.name}`
            };
        }

        return {
            action: "generate",
            reason: `No matching locator found for ${incoming.name}`
        };

    }

    private evaluateStep(
        artifact: AIArtifact,
        code: string
    ): DuplicateDecision {

        const existing = this.parser.getSteps(code);
        const incoming = this.parser.getSteps(artifact.content);

        const incomingStepText = incoming[0]?.text || artifact.name;
        const incomingMethod = incoming[0]?.method || artifact.name;

        const exact = existing.find(
            x => this.normalizeText(x.text) === this.normalizeText(incomingStepText)
                && x.method === incomingMethod
        );

        if (exact) {
            return {
                action: "reuse",
                reason: `Exact step exists: ${incomingStepText}`
            };
        }

        const similar = existing.find(
            x => this.normalizeText(x.text) === this.normalizeText(incomingStepText)
                || x.method === incomingMethod
        );

        if (similar) {
            return {
                action: "skip",
                reason: `Similar step exists for ${incomingStepText}`
            };
        }

        return {
            action: "generate",
            reason: `No matching step found for ${incomingStepText}`
        };

    }

    private evaluateScenario(
        artifact: AIArtifact,
        code: string
    ): DuplicateDecision {

        const incoming = this.normalizeText(artifact.name);
        const lines = code.split(/\r?\n/)
            .map(x => x.trim())
            .filter(x => x.startsWith("Scenario:"));

        const scenarioNames = lines.map(x => this.normalizeText(x.replace(/^Scenario:\s*/i, "")));

        if (scenarioNames.includes(incoming)) {
            return {
                action: "reuse",
                reason: `Exact scenario exists: ${artifact.name}`
            };
        }

        const similar = scenarioNames.find(x => x.includes(incoming) || incoming.includes(x));

        if (similar) {
            return {
                action: "skip",
                reason: `Similar scenario exists for ${artifact.name}`
            };
        }

        return {
            action: "generate",
            reason: `No matching scenario found for ${artifact.name}`
        };

    }

    private extractMethodSignatures(code: string): MethodSignature[] {

        const signatures: MethodSignature[] = [];
        const regex = /(public|private|protected)\s+(async\s+)?([A-Za-z_][A-Za-z0-9_<>,\[\]\?\.]*)\s+(\w+)\s*\(([^)]*)\)/g;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(code)) !== null) {
            signatures.push({
                returnType: match[3],
                name: match[4],
                parameters: match[5]
            });
        }

        return signatures;

    }

    private extractMethodSignature(
        code: string,
        fallbackName: string
    ): MethodSignature | undefined {

        const first = this.extractMethodSignatures(code)[0];

        if (first)
            return first;

        if (!fallbackName)
            return undefined;

        return {
            returnType: "Task",
            name: fallbackName,
            parameters: ""
        };

    }

    private extractLocatorInfos(code: string): LocatorInfo[] {

        const locators: LocatorInfo[] = [];
        const regex = /(ILocator|Locator|IElementHandle)\s+(\w+)[\s\S]*?(?:Locator\("([^"]+)"\)|GetBy[A-Za-z]+\("([^"]+)"\))/g;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(code)) !== null) {
            locators.push({
                name: match[2],
                selector: match[3] || match[4]
            });
        }

        return locators;

    }

    private extractLocatorInfo(
        code: string,
        fallbackName: string
    ): LocatorInfo {

        const first = this.extractLocatorInfos(code)[0];

        if (first)
            return first;

        return {
            name: fallbackName,
            selector: this.extractSelector(code)
        };

    }

    private extractSelector(code: string): string | undefined {

        const locatorMatch = /Locator\("([^"]+)"\)/.exec(code);

        if (locatorMatch)
            return locatorMatch[1];

        const getByMatch = /GetBy[A-Za-z]+\("([^"]+)"\)/.exec(code);

        if (getByMatch)
            return getByMatch[1];

        return undefined;

    }

    private normalizeParams(value: string): string {

        return value.replace(/\s+/g, " ").trim().toLowerCase();

    }

    private paramCount(value: string): number {

        const trimmed = value.trim();

        if (!trimmed)
            return 0;

        return trimmed.split(",").filter(Boolean).length;

    }

    private normalizeType(value: string): string {

        return value.replace(/\s+/g, "").toLowerCase();

    }

    private normalizeSelector(value?: string): string {

        if (!value)
            return "";

        return value.replace(/\s+/g, "").toLowerCase();

    }

    private normalizeText(value: string): string {

        return value.replace(/\s+/g, " ").trim().toLowerCase();

    }

}
