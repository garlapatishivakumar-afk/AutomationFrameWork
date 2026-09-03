export function buildUploadExpression(fileName: string): string {
    return `path.resolve(process.cwd(), "Uploads", "${fileName}")`;
}
