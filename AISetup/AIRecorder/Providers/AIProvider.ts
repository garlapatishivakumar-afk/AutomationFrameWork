export type AIProvider = {

    generate(
        prompt: string
    ): Promise<string>;

};