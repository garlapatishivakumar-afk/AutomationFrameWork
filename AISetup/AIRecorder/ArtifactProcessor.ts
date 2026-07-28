import path from "path";
import { AIArtifact } from "./Models/AIArtifact";
import { FrameworkEditor } from "./Editors/FrameworkEditor";
import { ExcelGenerator } from "./Generators/ExcelGenerator";
import { DuplicateDetector } from "./Validators/DuplicateDetector";

export class ArtifactProcessor {

    private frameworkEditor =
        new FrameworkEditor();

    private duplicateDetector =
        new DuplicateDetector();

    private excelGenerator =
        new ExcelGenerator();

    public process(
        artifacts: AIArtifact[]
    ) {

        for (const artifact of artifacts) {

            const file = path.join(
                process.cwd(),
                artifact.targetFile
            );

            const decision = this.duplicateDetector.evaluate(
                artifact,
                file
            );

            if (decision.action !== "generate") {
                console.log(`[DuplicateDetector] ${decision.reason}`);
                continue;
            }

            switch (artifact.artifactType) {

                case "Method":
                    this.frameworkEditor.insertMethod(
                        file,
                        artifact.name,
                        artifact.content,
                        artifact.targetClass
                    );
                    break;

                case "Locator":
                    this.frameworkEditor.insertLocator(
                        file,
                        artifact.name,
                        artifact.content,
                        artifact.targetClass
                    );
                    break;

                case "Step":
                    this.frameworkEditor.insertStep(
                        file,
                        artifact.name,
                        artifact.content,
                        artifact.targetClass
                    );
                    break;

                case "Scenario":
                    this.frameworkEditor.insertScenario(
                        file,
                        artifact.name,
                        artifact.content
                    );
                    break;

                case "Helper":
                    this.frameworkEditor.insertHelper(
                        file,
                        artifact.name,
                        artifact.content,
                        artifact.targetClass
                    );
                    break;

                case "Excel":
                    this.excelGenerator.generate(
                        file,
                        artifact.content
                    );
                    break;
            }

        }

    }

}
