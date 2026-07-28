import { FileNode } from "./FileNode";
import { RelationshipType } from "./RelationshipType";

export interface RelationshipEdge {

    from: string;

    to: string;

    type: RelationshipType;

}

export interface RelationshipGraph {

    nodes: FileNode[];

    edges: RelationshipEdge[];

}
