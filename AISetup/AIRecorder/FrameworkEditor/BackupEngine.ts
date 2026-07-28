import fs from "fs";

export function createBackup(
    file: string
): boolean {

    if (!fs.existsSync(file))
        return false;

    const backup = file + ".bak";

    if (fs.existsSync(backup))
        return false;

    fs.copyFileSync(file, backup);

    return true;

}

export function restoreBackup(
    file: string
) {

    const backup = file + ".bak";

    if (!fs.existsSync(backup))
        return;

    fs.copyFileSync(backup, file);

}

export function backupFile(
    file: string
) {

    createBackup(file);

}