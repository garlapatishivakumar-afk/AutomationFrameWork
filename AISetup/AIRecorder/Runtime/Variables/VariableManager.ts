import { RuntimeVariable } from "./RuntimeVariable";
import { VariableScope } from "./VariableScope";

export class VariableManager {

    private readonly variables =
        new Map<string, RuntimeVariable>();

    public set(
        name: string,
        value: string,
        captureType: RuntimeVariable["captureType"],
        scope: VariableScope = "session"
    ): RuntimeVariable {

        const variable: RuntimeVariable = {
            name,
            value,
            captureType,
            scope,
            createdAt: new Date().toISOString()
        };

        this.variables.set(name, variable);
        return variable;

    }

    public get(name: string): RuntimeVariable | undefined {

        return this.variables.get(name);

    }

    public resolve(name: string): string {

        const variable = this.variables.get(name);

        if (!variable)
            throw new Error(`Variable not found: ${name}`);

        return variable.value;

    }

    public toJSON(): RuntimeVariable[] {

        return [...this.variables.values()];

    }

}
