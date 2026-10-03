import fs from "fs";
import path from "path";
import { SplitArtifact } from "./ArtifactSplitter";

export class ArtifactWriter {

    public write(
        rootPath: string,
        artifacts: SplitArtifact[]
    ): string[] {

        const written: string[] = [];

        for (const artifact of artifacts) {

            const directory =
                path.join(rootPath, this.folderFor(artifact.type));

            fs.mkdirSync(directory, { recursive: true });

            const absolute =
                path.join(directory, artifact.fileName);

            fs.writeFileSync(absolute, artifact.content, "utf8");

            written.push(path.relative(rootPath, absolute).replace(/\\/g, "/"));

        }

        return written;

    }

    private folderFor(type: SplitArtifact["type"]): string {

        switch (type) {
            case "Feature":
                return "Features";
            case "Step":
                return "StepDefinitions";
            case "Page":
                return "PageActions";
            case "Locator":
                return "PageElements";
            case "Excel":
                return "TestData";
            case "Helper":
                return "Helpers";
            case "Config":
                return "config";
            case "Test":
                return "Tests";
            case "Report":
                return "Reports";
            default:
                return "Generated";
        }

    }

}
