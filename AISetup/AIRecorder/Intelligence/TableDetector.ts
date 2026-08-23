// V2.1 Enhancement #3 — TableDetector
// Detects table/grid locators and analyses row-index fragility.

import { TableAnalysis } from "./TableModels";

// Patterns that indicate a locator is inside a table/grid control
const TABLE_LOCATOR_PATTERNS = [
    /rgrid/i,                // Telerik RadGrid
    /GridView/i,             // ASP.NET GridView
    /Repeater/i,             // ASP.NET Repeater
    /_ctl\d{2,}_ctl\d{2,}/i, // Double-indexed compound IDs (ctl04_ctl05)
    /\[role=['"`]grid['"`]\]/i,
    /\[role=['"`]row['"`]\]/i,
    /table/i
];

// Patterns that indicate a fragile row index dependency
const FRAGILE_ROW_PATTERNS = [
    /ctl\d{2,}_ctl\d{2,}/i,          // ctl04_ctl05
    /ctl\d{2,}__ctl\d{2,}/i,         // double-underscore variant
    /\[(\d+)\]/,                      // explicit nth-index
    /nth-child\(\d+\)/i,
    /:eq\(\d+\)/i
];

export class TableDetector {

    public analyse(locator: string, rawLine: string): TableAnalysis | null {

        if (!this.isTableLocator(locator)) return null;

        const tableId = this.extractTableId(locator);
        const fragileEvidence = this.detectFragileRowIndex(locator);

        const analysis: TableAnalysis = {
            locator,
            tableId,
            hasFragileRowIndex: fragileEvidence !== null,
            rowIndexEvidence: fragileEvidence ?? undefined,
            confidence: this.computeConfidence(locator, fragileEvidence),
            columns: [],
            suggestedRowIdentifier: undefined,
            warnings: []
        };

        if (analysis.hasFragileRowIndex) {
            analysis.warnings.push(
                `Fragile row index detected in locator: "${fragileEvidence}". ` +
                `Consider using a stable business row identifier (e.g. Deal Number, Investor ID).`
            );
        }

        return analysis;
    }

    public isTableLocator(locator: string): boolean {
        return TABLE_LOCATOR_PATTERNS.some(p => p.test(locator));
    }

    private detectFragileRowIndex(locator: string): string | null {
        for (const pattern of FRAGILE_ROW_PATTERNS) {
            const match = locator.match(pattern);
            if (match) return match[0];
        }
        return null;
    }

    private extractTableId(locator: string): string {
        // Extract the table/grid identifier from ASP.NET compound ID
        // e.g. #ctl00_ContentPlaceHolder1_rgridPackages_ctl00_ctl04_... → rgridPackages
        // Use [a-zA-Z0-9] to stop at underscore
        const rgridMatch = locator.match(/rgrid[a-zA-Z0-9]*/i);
        if (rgridMatch) return rgridMatch[0];

        const gridMatch = locator.match(/(?:GridView|Repeater)\w*/i);
        if (gridMatch) return gridMatch[0];

        // Fallback: first ctl segment
        const ctlMatch = locator.match(/#?(\w+)_ctl\d/i);
        if (ctlMatch) return ctlMatch[1];

        return "UnknownTable";
    }

    private computeConfidence(locator: string, fragileEvidence: string | null): number {
        let score = 0.5;
        if (/rgrid/i.test(locator)) score += 0.3;
        if (fragileEvidence) score += 0.1;
        return Math.min(score, 1.0);
    }
}
