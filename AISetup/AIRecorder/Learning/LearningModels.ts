export interface LearningEntry {

    key: string;

    value: string;

    source: string;

    score?: number;

    usageCount: number;

    lastUsed: string;

}

export interface LearningSnapshot {

    entries: LearningEntry[];

    indexedAt: string;

}
