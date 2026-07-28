export interface ReviewRule {

    id: string;

    description: string;

    severity: "Low" | "Medium" | "High";

    enabled: boolean;

}
