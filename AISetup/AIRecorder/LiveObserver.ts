// V2.1 Enhancement #2 — LiveObserver
// Performs static analysis of AIRecorder/code.ts locators and writes
// AIRecorder/LiveObservations.json for consumption by ContextBuilder/PromptBuilder.
//
// NOTE: This uses static analysis only. Live-browser DOM inspection is not performed
// because the target applications require authenticated sessions. Static analysis
// extracts semantic information from Playwright selector patterns and ASP.NET ID conventions.

import fs from "fs";
import path from "path";
import { DomClassifier } from "./Intelligence/DomClassifier";
import { LabelResolver } from "./Intelligence/LabelResolver";
import { LocatorNamingEngine } from "./Intelligence/LocatorNamingEngine";
import { LocatorStabilityRanker } from "./Intelligence/LocatorStabilityRanker";
import { TableDetector } from "./Intelligence/TableDetector";
import { ControlObservation, LiveObservations } from "./Intelligence/ControlModels";

const classifier     = new DomClassifier();
const labelResolver  = new LabelResolver();
const namingEngine   = new LocatorNamingEngine();
const stabilityRanker = new LocatorStabilityRanker();
const tableDetector  = new TableDetector();

// ─────────────────────────────────────────────────────────────────────────────
// Regex patterns to extract locator strings from a code.ts line
// ─────────────────────────────────────────────────────────────────────────────
const LOCATOR_EXTRACTION_PATTERNS = [
    /locator\(\s*['"`]([^'"`]+)['"`]/i,
    /getByRole\(\s*['"`]\w+['"`][^)]*\)/i,
    /getByLabel\(\s*['"`]([^'"`]+)['"`]/i,
    /getByText\(\s*['"`]([^'"`]+)['"`]/i,
    /getByPlaceholder\(\s*['"`]([^'"`]+)['"`]/i
];

function extractLocator(line: string): string | null {
    // Full getBy* calls — return the whole match as the locator descriptor
    const getByMatch = line.match(/getBy(?:Role|Label|Text|Placeholder|TestId)\([^)]+\)/i);
    if (getByMatch) return getByMatch[0];

    // CSS / XPath locator
    const cssMatch = line.match(/locator\(\s*['"`]([^'"`]+)['"`]/i);
    if (cssMatch) return cssMatch[1];

    return null;
}

function extractPageUrl(line: string): string | undefined {
    const gotoMatch = line.match(/goto\(\s*['"`]([^'"`]+)['"`]/i);
    return gotoMatch?.[1];
}

export function buildObservations(projectRoot: string = process.cwd()): ControlObservation[] {
    const codePath = path.join(projectRoot, "AIRecorder", "code.ts");
    if (!fs.existsSync(codePath)) return [];

    const lines = fs.readFileSync(codePath, "utf8").split(/\r?\n/);
    const observations: ControlObservation[] = [];
    const seen = new Set<string>();

    let currentPage: string | undefined;

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith("//")) continue;

        // Track current page from goto()
        const pageUrl = extractPageUrl(trimmed);
        if (pageUrl) currentPage = pageUrl;

        const locator = extractLocator(trimmed);
        if (!locator || seen.has(locator)) continue;
        seen.add(locator);

        // Classification
        const classification = classifier.classify(locator, trimmed);

        // Label resolution
        const resolved = labelResolver.resolve(locator, trimmed);

        // Semantic name
        const resolvedName = namingEngine.derive(
            resolved.label,
            classification.controlType,
            Math.min(classification.confidence, resolved.confidence)
        );

        // Locator stability
        const stability = stabilityRanker.rank(locator, trimmed);

        // Table detection
        const tableAnalysis = tableDetector.analyse(locator, trimmed);

        // Extract rawIdHint for CSS selectors
        const idHintMatch = locator.match(/#([^\s#\[\]]+)/);
        const rawId = idHintMatch?.[1] ?? "";
        const rawIdHint = rawId.replace(/^(ctl\d+_)+/i, "") || undefined;

        observations.push({
            locator,
            controlType:        classification.controlType,
            confidence:         classification.confidence,
            resolvedName,
            label:              resolved.label || undefined,
            tag:                classification.tag,
            pageUrl:            currentPage,
            rawIdHint,
            stabilityScore:     stability.stabilityScore,
            preferredStrategy:  stability.preferredStrategy,
            fallbackStrategies: stability.fallbackStrategies,
            isTableControl:     tableAnalysis !== null,
            tableInfo: tableAnalysis
                ? {
                    isTableLocator:        tableAnalysis.hasFragileRowIndex || true,
                    rowIndexEvidence:      tableAnalysis.rowIndexEvidence,
                    suggestedRowIdentifier: tableAnalysis.suggestedRowIdentifier,
                    confidence:            tableAnalysis.confidence
                  }
                : undefined,
            playwrightAction: trimmed.length > 120 ? trimmed.slice(0, 120) + "…" : trimmed
        });
    }

    return observations;
}

export function runLiveObserver(projectRoot: string = process.cwd()): void {
    const observations = buildObservations(projectRoot);

    const output: LiveObservations = {
        capturedAt: new Date().toISOString(),
        method:     "static-analysis",
        observations
    };

    const outputPath = path.join(projectRoot, "AIRecorder", "LiveObservations.json");
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

    console.log(`LiveObserver: wrote ${observations.length} observations → ${outputPath}`);
    for (const obs of observations) {
        if (obs.resolvedName) {
            console.log(`  ${obs.locator} → ${obs.resolvedName} [${obs.controlType}, stability=${obs.stabilityScore.toFixed(2)}]`);
        }
        if (obs.isTableControl && obs.tableInfo?.rowIndexEvidence) {
            console.log(`  ⚠  Fragile table locator: ${obs.locator} (${obs.tableInfo.rowIndexEvidence})`);
        }
    }
}

// Allow running directly: npx ts-node AISetup/AIRecorder/LiveObserver.ts
if (require.main === module) {
    runLiveObserver();
}
