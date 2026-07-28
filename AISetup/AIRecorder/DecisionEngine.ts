import fs from "fs";
import path from "path";
import { AIArtifact } from "./Models/AIArtifact";
import { DuplicateDecision, DuplicateDetector } from "./Validators/DuplicateDetector";

type FrameworkIndexEntry = {
    pageAction?: string;
    pageObject?: string;
    stepDefinition?: string;
    feature?: string;
};

type FrameworkIndex = Record<string, FrameworkIndexEntry>;

export type DecisionItem = {
    artifactType: AIArtifact["artifactType"];
    targetFile: string;
    targetClass?: string;
    name: string;
    decision: DuplicateDecision["action"];
    reason: string;
};

export type DecisionPlan = {
    pages: string[];
    requested: DecisionItem[];
    toGenerate: DecisionItem[];
    toReuseOrSkip: DecisionItem[];
    notes: string[];
};

export class DecisionEngine {

    private duplicateDetector =
        new DuplicateDetector();

    public buildPlan(
        instruction: string,
        explicitPages: string[] = [],
        workspaceRoot: string = process.cwd()
    ): DecisionPlan {

        const frameworkIndex = this.loadFrameworkIndex(workspaceRoot);
        const pages = this.resolvePages(instruction, explicitPages, frameworkIndex);
        const requested = this.buildCandidates(instruction, pages, frameworkIndex);

        const evaluated = requested.map(item => {

            const probe = this.buildProbeArtifact(item);
            const absolute = path.join(workspaceRoot, item.targetFile);
            const decision = this.duplicateDetector.evaluate(probe, absolute);

            return {
                ...item,
                decision: decision.action,
                reason: decision.reason
            };

        });

        const toGenerate = evaluated.filter(x => x.decision === "generate");
        const toReuseOrSkip = evaluated.filter(x => x.decision !== "generate");

        const notes: string[] = [];

        notes.push(`Planned pages: ${pages.join(", ") || "none"}`);
        notes.push(`Requested fragments: ${evaluated.length}`);
        notes.push(`Generate now: ${toGenerate.length}`);
        notes.push(`Reuse/skip: ${toReuseOrSkip.length}`);

        return {
            pages,
            requested: evaluated,
            toGenerate,
            toReuseOrSkip,
            notes
        };

    }

    private loadFrameworkIndex(workspaceRoot: string): FrameworkIndex {

        const file = path.join(workspaceRoot, "AIRecorder", "FrameworkIndex.json");

        if (!fs.existsSync(file))
            return {};

        try {
            return JSON.parse(fs.readFileSync(file, "utf8")) as FrameworkIndex;
        } catch {
            return {};
        }

    }

    private resolvePages(
        instruction: string,
        explicitPages: string[],
        frameworkIndex: FrameworkIndex
    ): string[] {

        const normalized = instruction.toLowerCase();
        const pages = new Set<string>();

        for (const page of explicitPages) {
            if (page && page.trim())
                pages.add(page.trim());
        }

        for (const page of Object.keys(frameworkIndex)) {
            if (normalized.includes(page.toLowerCase()))
                pages.add(page);
        }

        if (pages.size === 0) {
            const first = Object.keys(frameworkIndex)[0];

            if (first)
                pages.add(first);
        }

        return Array.from(pages);

    }

    private buildCandidates(
        instruction: string,
        pages: string[],
        frameworkIndex: FrameworkIndex
    ): Array<Omit<DecisionItem, "decision" | "reason">> {

        const candidates: Array<Omit<DecisionItem, "decision" | "reason">> = [];

        for (const page of pages) {

            const map = frameworkIndex[page] || {};
            const actionName = this.buildMethodName(instruction);
            const locatorName = this.buildLocatorName(instruction);
            const stepName = this.buildStepText(instruction);
            const scenarioName = this.buildScenarioName(instruction);

            if (map.pageAction) {
                candidates.push({
                    artifactType: "Method",
                    targetFile: this.toWorkspacePath(map.pageAction),
                    targetClass: `${page}Methods`,
                    name: actionName
                });
            }

            if (map.pageObject) {
                candidates.push({
                    artifactType: "Locator",
                    targetFile: this.toWorkspacePath(map.pageObject),
                    targetClass: `${page}Objects`,
                    name: locatorName
                });
            }

            if (map.stepDefinition) {
                candidates.push({
                    artifactType: "Step",
                    targetFile: this.toWorkspacePath(map.stepDefinition),
                    targetClass: `${page}Steps`,
                    name: stepName
                });
            }

            if (map.feature) {
                candidates.push({
                    artifactType: "Scenario",
                    targetFile: this.toWorkspacePath(map.feature),
                    name: scenarioName
                });
            }

            if (this.needsHelper(instruction)) {
                candidates.push({
                    artifactType: "Helper",
                    targetFile: "Helpers/CommonActionsPage.cs",
                    targetClass: "CommonActionsPage",
                    name: `${actionName}Helper`
                });
            }

            if (this.needsExcel(instruction)) {
                candidates.push({
                    artifactType: "Excel",
                    targetFile: "DataFiles/data.json",
                    name: `${page}TestData`
                });
            }

        }

        return candidates;

    }

    private buildProbeArtifact(
        item: Omit<DecisionItem, "decision" | "reason">
    ): AIArtifact {

        return {
            artifactType: item.artifactType,
            targetFile: item.targetFile,
            targetClass: item.targetClass,
            name: item.name,
            content: this.buildProbeContent(item)
        };

    }

    private buildProbeContent(
        item: Omit<DecisionItem, "decision" | "reason">
    ): string {

        switch (item.artifactType) {
            case "Method":
            case "Helper":
                return `public async Task ${item.name}() { }`;

            case "Locator":
                return `public ILocator ${item.name} => _page.Locator(\"\");`;

            case "Step":
                return `[When(@"${item.name}")] public async Task ${this.toPascalCase(item.name)}() { }`;

            case "Scenario":
                return `Scenario: ${item.name}`;

            case "Excel":
                return "{}";
        }

    }

    private buildMethodName(instruction: string): string {

        const verbs = ["login", "save", "search", "verify", "create", "update", "delete", "submit"];
        const lowered = instruction.toLowerCase();
        const matched = verbs.find(x => lowered.includes(x));
        const base = matched || this.firstWord(instruction) || "Action";

        return `${this.toPascalCase(base)}Async`;

    }

    private buildLocatorName(instruction: string): string {

        const keywords = ["username", "password", "save", "search", "status", "submit"];
        const lowered = instruction.toLowerCase();
        const matched = keywords.find(x => lowered.includes(x));
        const base = matched || this.firstWord(instruction) || "Element";

        return `${this.toPascalCase(base)}Element`;

    }

    private buildStepText(instruction: string): string {

        const clean = instruction.replace(/\s+/g, " ").trim();

        if (!clean)
            return "user performs generated action";

        return clean.slice(0, 120);

    }

    private buildScenarioName(instruction: string): string {

        const clean = instruction.replace(/\s+/g, " ").trim();

        if (!clean)
            return "Generated scenario";

        return this.toPascalWords(clean).slice(0, 120);

    }

    private needsHelper(instruction: string): boolean {

        const lowered = instruction.toLowerCase();
        return /(helper|common|reuse|utility)/.test(lowered);

    }

    private needsExcel(instruction: string): boolean {

        const lowered = instruction.toLowerCase();
        return /(excel|data|test data|dataset)/.test(lowered);

    }

    private firstWord(text: string): string {

        const match = text.match(/[A-Za-z][A-Za-z0-9_]*/);
        return match ? match[0] : "";

    }

    private toPascalWords(text: string): string {

        return text
            .replace(/[^A-Za-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map(x => this.toPascalCase(x))
            .join(" ");

    }

    private toPascalCase(text: string): string {

        const parts = text
            .replace(/[^A-Za-z0-9\s_]/g, " ")
            .split(/[\s_]+/)
            .filter(Boolean);

        return parts
            .map(x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase())
            .join("");

    }

    private toWorkspacePath(value: string): string {

        return value.replace(/\\/g, "/");

    }

}
