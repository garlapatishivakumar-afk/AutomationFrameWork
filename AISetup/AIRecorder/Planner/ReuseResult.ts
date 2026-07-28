export interface ReuseCandidate {

    name: string;

    filePath: string;

    score: number;

}

export interface ReuseResult {

    reuse: ReuseCandidate[];

    create: string[];

}
