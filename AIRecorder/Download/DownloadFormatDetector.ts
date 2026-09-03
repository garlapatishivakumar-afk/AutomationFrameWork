import path from "node:path";

const EXTENSION_FORMATS: Record<string, string> = {
    ".txt": "TXT",
    ".csv": "CSV",
    ".xlsx": "XLSX",
    ".xls": "XLS",
    ".pdf": "PDF",
    ".png": "PNG",
    ".jpg": "JPG",
    ".jpeg": "JPEG",
    ".doc": "DOC",
    ".docx": "DOCX",
    ".json": "JSON",
    ".zip": "ZIP",
    ".xml": "XML"
};

export function detectDownloadFormat(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    return EXTENSION_FORMATS[extension] ?? "UNKNOWN";
}
