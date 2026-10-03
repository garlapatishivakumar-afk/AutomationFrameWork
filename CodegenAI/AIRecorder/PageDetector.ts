import { normalizeLookupKey } from './ContextCache';

export type PageScore = {
  page: string;
  score: number;
};

export function extractFlowSignals(code: string): string[] {
  const signals = new Set<string>();

  const regexes = [
    /getByRole\(\s*['"`]\w+['"`]\s*,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`]/gi,
    /getByText\(\s*['"`]([^'"`]+)['"`]/gi,
    /goto\(\s*['"`]([^'"`]+)['"`]/gi,
    /locator\(\s*['"`]([^'"`]+)['"`]/gi
  ];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const value = (match[1] || '').trim();
      if (!value) {
        continue;
      }

      signals.add(value);

      value
        .split(/[^a-zA-Z0-9]+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3)
        .forEach((part) => signals.add(part));
    }
  }

  return [...signals];
}

function scorePageName(page: string, signals: string[]): number {
  const pageKey = normalizeLookupKey(page);
  let score = 0;

  for (const signal of signals) {
    const signalKey = normalizeLookupKey(signal);
    if (!signalKey) {
      continue;
    }

    if (signalKey === pageKey) {
      score += 6;
      continue;
    }

    if (pageKey.includes(signalKey) || signalKey.includes(pageKey)) {
      score += 3;
    }
  }

  return score;
}

export function detectRelevantPages(
  code: string,
  availablePages: string[],
  explicitPages: string[] = []
): PageScore[] {
  const signals = extractFlowSignals(code);
  const explicitKeys = explicitPages.map((value) => normalizeLookupKey(value));

  const scored = availablePages.map((page) => {
    const pageKey = normalizeLookupKey(page);
    const explicitBonus = explicitKeys.includes(pageKey) ? 100 : 0;
    const score = explicitBonus + scorePageName(page, signals);
    return { page, score };
  });

  const ranked = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    return [];
  }

  const best = ranked[0].score;
  return ranked.filter((entry) => entry.score >= Math.max(3, best - 4)).slice(0, 4);
}
