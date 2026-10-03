export class TokenAccumulator {

    private readonly tokens: string[] = [];

    public append(token: string): void {

        this.tokens.push(token);

    }

    public build(): string {

        return this.tokens.join("");

    }

}
