import { VariableManager } from "./VariableManager";

export class VariableResolver {

    constructor(
        private readonly manager: VariableManager
    ) {
    }

    public resolveTemplate(
        input: string
    ): string {

        return input.replace(/\{\{([a-zA-Z0-9_\-.]+)\}\}/g, (_, name: string) => {
            return this.manager.resolve(name.trim());
        });

    }

}
