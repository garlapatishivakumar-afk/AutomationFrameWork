// V2.1 Enhancement #3 — TableModels
// Data models for table/grid intelligence.

export interface TableColumnInfo {
    index: number;
    /** Header text if detectable */
    header?: string;
    /** Inferred cell type in this column */
    cellType?: "Text" | "Checkbox" | "Link" | "Button" | "Dropdown" | "Unknown";
}

export interface TableAnalysis {
    /** Raw locator string that triggered table detection */
    locator: string;
    /** Detected table/grid identifier from locator */
    tableId: string;
    /** Whether the row is identified by a fragile numeric index */
    hasFragileRowIndex: boolean;
    /** The fragile index evidence, e.g. "ctl05" */
    rowIndexEvidence?: string;
    /** 0.0 – 1.0 */
    confidence: number;
    /** Detected column information */
    columns: TableColumnInfo[];
    /**
     * Suggested stable row identifier if one can be inferred.
     * Low-confidence → undefined (let QuestionEngine ask).
     */
    suggestedRowIdentifier?: string;
    /** Warnings to include in validation output */
    warnings: string[];
}
