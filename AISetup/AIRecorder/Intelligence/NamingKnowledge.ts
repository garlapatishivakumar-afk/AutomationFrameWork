export interface NamingKnowledge {
    conventions: Record<string, string>;
    reservedPrefixes: string[];
    reservedSuffixes: string[];
}

export function createEmptyNamingKnowledge(): NamingKnowledge {

    return {
        conventions: {},
        reservedPrefixes: [],
        reservedSuffixes: []
    };

}
