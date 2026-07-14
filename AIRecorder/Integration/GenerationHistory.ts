import { GenerationSession } from "./GenerationSession";

export class GenerationHistory {

    private readonly sessions: GenerationSession[] = [];

    public add(session: GenerationSession): void {

        this.sessions.push(session);

    }

    public all(): GenerationSession[] {

        return [...this.sessions];

    }

    public latest(): GenerationSession | null {

        return this.sessions[this.sessions.length - 1] ?? null;

    }

    public size(): number {

        return this.sessions.length;

    }

    public clear(): void {

        this.sessions.length = 0;

    }

}
