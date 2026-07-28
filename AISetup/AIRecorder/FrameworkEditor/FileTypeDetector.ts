import path from "path";

export enum FrameworkFileType {

    CSharp,

    Feature,

    Unknown

}

export function detectFileType(file: string): FrameworkFileType {

    const extension = path.extname(file).toLowerCase();

    switch (extension) {

        case ".cs":
            return FrameworkFileType.CSharp;

        case ".feature":
            return FrameworkFileType.Feature;

        default:
            return FrameworkFileType.Unknown;
    }

}