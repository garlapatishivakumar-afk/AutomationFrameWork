export interface ImpactItem {

    target: string;

    changeType: string;

    impactLevel: "Low" | "Medium" | "High";

    reason: string;

}

export interface ImpactReport {

    summary: string;

    items: ImpactItem[];

}
