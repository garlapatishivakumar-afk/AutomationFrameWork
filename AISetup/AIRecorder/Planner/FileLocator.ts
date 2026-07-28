import path from "path";

import { ArtifactType } from "./PlannerModels";

export class FileLocator {

    public locate(
        projectRoot: string,
        artifactType: ArtifactType,
        name: string
    ): string {

        switch (artifactType) {

            case "Method":
                return path.join(projectRoot, "PageActions", `${name}Methods.cs`);

            case "Locator":
                return path.join(projectRoot, "PageElements", `${name}Objects.cs`);

            case "Step":
                return path.join(projectRoot, "StepDefinitions", `${name}Steps.cs`);

            case "Scenario":
                return path.join(projectRoot, "Features", `${name}.feature`);

            case "Helper":
                return path.join(projectRoot, "Helpers", `${name}.cs`);

            case "Excel":
                return path.join(projectRoot, "DataFiles", "data.json");

            default:
                return projectRoot;

        }

    }

}
