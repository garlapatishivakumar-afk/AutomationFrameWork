import { VariableScope } from "./VariableScope";

export interface RuntimeVariable {

    name: string;

    value: string;

    captureType:
        | "InnerText"
        | "InputValue"
        | "SelectedValue"
        | "Attribute"
        | "TransactionId"
        | "WorkflowId"
        | "DealId"
        | "Amount"
        | "UserName";

    scope: VariableScope;

    createdAt: string;

}
