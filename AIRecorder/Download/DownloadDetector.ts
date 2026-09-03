export interface DownloadOperation {
    downloadVariable: string;
    promiseVariable?: string;
    assignmentStart: number;
    assignmentEnd: number;
    lineNumber: number;
}

const waitForDownloadRegex = /const\s+(\w+)\s*=\s*(?:await\s+)?page\.waitForEvent\(\s*['\"]download['\"]\s*\)\s*;?/g;
const awaitPromiseRegex = /const\s+(\w+)\s*=\s*await\s+(\w+)\s*;?/g;
const directDownloadRegex = /const\s+(\w+)\s*=\s*await\s+page\.waitForEvent\(\s*['\"]download['\"]\s*\)\s*;?/g;

export function detectDownloadOperations(code: string): DownloadOperation[] {
    const promiseVariables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = waitForDownloadRegex.exec(code)) !== null) {
        if (!match[0].includes("await page.waitForEvent")) {
            promiseVariables.add(match[1]);
        }
    }

    const operations: DownloadOperation[] = [];

    while ((match = awaitPromiseRegex.exec(code)) !== null) {
        const downloadVariable = match[1];
        const awaitedVariable = match[2];

        if (!promiseVariables.has(awaitedVariable)) {
            continue;
        }

        const start = match.index;
        const end = start + match[0].length;
        const lineNumber = code.slice(0, start).split(/\r?\n/).length;

        operations.push({
            downloadVariable,
            promiseVariable: awaitedVariable,
            assignmentStart: start,
            assignmentEnd: end,
            lineNumber
        });
    }

    while ((match = directDownloadRegex.exec(code)) !== null) {
        const downloadVariable = match[1];
        const start = match.index;
        const end = start + match[0].length;
        const lineNumber = code.slice(0, start).split(/\r?\n/).length;

        operations.push({
            downloadVariable,
            assignmentStart: start,
            assignmentEnd: end,
            lineNumber
        });
    }

    const unique = new Map<string, DownloadOperation>();
    for (const op of operations) {
        unique.set(`${op.assignmentStart}:${op.downloadVariable}`, op);
    }

    return [...unique.values()].sort((a, b) => a.assignmentStart - b.assignmentStart);
}

export function hasDownloadWaitEvent(code: string): boolean {
    return /page\.waitForEvent\(\s*['\"]download['\"]\s*\)/.test(code);
}
