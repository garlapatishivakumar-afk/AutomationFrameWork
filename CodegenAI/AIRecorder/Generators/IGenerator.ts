import { GeneratedArtifact } from "../Models/GeneratedArtifact";

export interface IGenerator {

    generate(): Promise<GeneratedArtifact[]>;
}
