import { FileNode } from "./FileNode";
import { RelationshipGraph } from "./RelationshipGraph";

export class RelationshipAnalyzer {

    public build(
        nodes: FileNode[]
    ): RelationshipGraph {

        return {

            nodes,

            edges: []

        };

    }

}
