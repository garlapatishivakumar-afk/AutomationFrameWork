export class ValidationBuilder {

    public validateSuccessMessageAsync(message: string, expected: string): Promise<void> {

        if (!message.includes(expected))
            throw new Error(`Expected success message '${expected}', found '${message}'.`);

        return Promise.resolve();

    }

    public validateStatusAsync(actual: string, expected: string): Promise<void> {

        if (actual.trim().toLowerCase() !== expected.trim().toLowerCase())
            throw new Error(`Expected status '${expected}', found '${actual}'.`);

        return Promise.resolve();

    }

    public validateGridValueAsync(actual: string, expected: string): Promise<void> {

        if (actual.trim() !== expected.trim())
            throw new Error(`Expected grid value '${expected}', found '${actual}'.`);

        return Promise.resolve();

    }

}
