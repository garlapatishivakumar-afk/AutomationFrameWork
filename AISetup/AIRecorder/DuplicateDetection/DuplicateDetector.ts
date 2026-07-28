import fs from "fs";

type DuplicateResult = {

    exists: boolean;

    reason: string;

};

export class DuplicateDetector {

    exists(
        file: string,
        content: string
    ): DuplicateResult {

        if (!fs.existsSync(file))

            return {

                exists: false,

                reason: "File not found"

            };

        const source =
            fs.readFileSync(
                file,
                "utf8"
            );

        if (
            source.includes(content)
        ) {

            return {

                exists: true,

                reason: "Exact match"

            };

        }

        return {

            exists: false,

            reason: ""

        };

    }

}