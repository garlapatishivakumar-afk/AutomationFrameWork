import fs from "fs";

export function saveFile(
    file: string,
    content: string
) {

    fs.writeFileSync(
        file,
        content,
        "utf8"
    );

}