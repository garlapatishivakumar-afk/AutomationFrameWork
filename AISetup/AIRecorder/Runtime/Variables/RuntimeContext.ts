import fs from "fs";
import path from "path";
import { RuntimeVariable } from "./RuntimeVariable";
import { VariableManager } from "./VariableManager";

export class RuntimeContext {

    private readonly manager =
        new VariableManager();

    public capture(
        name: string,
        value: string,
        captureType: RuntimeVariable["captureType"]
    ): RuntimeVariable {

        return this.manager.set(name, value, captureType, "session");

    }

    public get(name: string): string | undefined {

        return this.manager.get(name)?.value;

    }

    public persist(projectRoot: string): void {

        const filePath = path.join(projectRoot, "AIRecorder", "RuntimeContext.json");
        fs.writeFileSync(filePath, JSON.stringify(this.manager.toJSON(), null, 2));

    }

    public all(): RuntimeVariable[] {

        return this.manager.toJSON();

    }

}
