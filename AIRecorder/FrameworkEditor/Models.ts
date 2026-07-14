export type { EditOperation } from "../Models/AIModels";

export interface EditResult {

    success: boolean;

    file: string;

    message: string;

}

export interface ParsedFile {

    file: string;

    content: string;

}