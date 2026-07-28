import fs from "fs";

export function loadFile(
    file: string
): string {

    if (!fs.existsSync(file))
        return "";

    return fs.readFileSync(
        file,
        "utf8"
    );

}