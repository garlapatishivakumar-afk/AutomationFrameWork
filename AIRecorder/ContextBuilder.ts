import fs from 'fs';
import path from 'path';
import { analyzeFlow } from './FlowAnalyzer';
import { BuildContext, FrameworkArtifact } from './Models/AIModels';

export type ContextBuildOptions = {
  explicitPages?: string[];
};

export type BuiltContext = BuildContext;

type PageRecord = {
  pageName: string;
  files: string[];
};

function normalize(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readText(projectRoot: string, relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return '';
  }

  return fs.readFileSync(absolutePath, 'utf8').trim();
}

function collectPageFiles(projectRoot: string): PageRecord[] {
  const pages: Record<string, PageRecord> = {};

  const folders = [
    { dir: 'PageActions', suffix: 'Methods.cs' },
    { dir: 'PageElements', suffix: 'Objects.cs' },
    { dir: 'StepDefinitions', suffix: 'Steps.cs' },
    { dir: 'Features', suffix: '.feature' }
  ];

  for (const folder of folders) {
    const absoluteDir = path.join(projectRoot, folder.dir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(folder.suffix)) {
        continue;
      }

      const pageName = entry.name.slice(0, -folder.suffix.length);
      const key = normalize(pageName);
      if (!pages[key]) {
        pages[key] = { pageName, files: [] };
      }

      pages[key].files.push(path.join(folder.dir, entry.name));
    }
  }

  return Object.values(pages).sort((a, b) => a.pageName.localeCompare(b.pageName));
}

function extractSignals(flow: string): string[] {
  const signals = new Set<string>();
  const patterns = [
    /getByRole\(\s*['"`]\w+['"`]\s*,\s*\{[^}]*name:\s*['"`]([^'"`]+)['"`]/gi,
    /getByText\(\s*['"`]([^'"`]+)['"`]/gi,
    /goto\(\s*['"`]([^'"`]+)['"`]/gi,
    /locator\(\s*['"`]([^'"`]+)['"`]/gi
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(flow)) !== null) {
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

function detectPages(flow: string, pageRecords: PageRecord[], explicitPages: string[] = []): string[] {
  if (explicitPages.length) {
    const explicitKeys = explicitPages.map((name) => normalize(name));
    return pageRecords
      .filter((record) => explicitKeys.includes(normalize(record.pageName)))
      .map((record) => record.pageName);
  }

  const signals = extractSignals(flow);
  const scored = pageRecords
    .map((record) => {
      const pageKey = normalize(record.pageName);
      let score = 0;

      for (const signal of signals) {
        const signalKey = normalize(signal);
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

      return { pageName: record.pageName, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return [];
  }

  const topScore = scored[0].score;
  return scored.filter((item) => item.score >= Math.max(3, topScore - 4)).slice(0, 4).map((item) => item.pageName);
}

function buildPageContext(projectRoot: string, pageRecords: PageRecord[], pages: string[]): { text: string; files: string[] } {
  const snippets: string[] = [];
  const files: string[] = [];

  for (const page of pages) {
    const matched = pageRecords.find((record) => normalize(record.pageName) === normalize(page));
    if (!matched) {
      continue;
    }

    for (const file of matched.files) {
      const content = readText(projectRoot, file);
      if (!content) {
        continue;
      }

      files.push(file);
      snippets.push(`FILE: ${file}\n${content}`);
    }
  }

  return {
    text: snippets.join('\n\n') || 'No page-specific context detected.',
    files
  };
}

function scanExistingFramework(projectRoot: string) {

  const methods: FrameworkArtifact[] = [];
  const locators: FrameworkArtifact[] = [];
  const steps: FrameworkArtifact[] = [];
  const scenarios: FrameworkArtifact[] = [];
  const helperMethods: FrameworkArtifact[] = [];

    const folders = [
        "PageActions",
        "PageElements",
        "StepDefinitions",
        "Features",
        "Helpers"
    ];

    for (const folder of folders) {

        const folderPath = path.join(projectRoot, folder);

        if (!fs.existsSync(folderPath))
            continue;

        const files = fs.readdirSync(folderPath);

        for (const file of files) {

            const relativeFile = path.join(folder, file);
            const content = readText(projectRoot, relativeFile);

            //----------------------------------
            // Methods
            //----------------------------------

            if (folder === "PageActions" || folder === "Helpers") {

                const regex = /(public|private|protected)\s+async\s+Task(?:<.*?>)?\s+(\w+)/g;

                let match;

                while ((match = regex.exec(content)) !== null) {

                    const method = {
                      name: match[2],
                      file: relativeFile,
                      content: match[0]
                    };

                    if (folder === "Helpers")
                        helperMethods.push(method);
                    else
                        methods.push(method);
                }
            }

            //----------------------------------
            // Locators
            //----------------------------------

            if (folder === "PageElements") {

                const regex = /(ILocator|Locator|IElementHandle)\s+(\w+)/g;

                let match;

                while ((match = regex.exec(content)) !== null) {

                    locators.push({
                      name: match[2],
                      file: relativeFile,
                      content: match[0]
                    });
                }
            }

            //----------------------------------
            // Steps
            //----------------------------------

            if (folder === "StepDefinitions") {

                const regex = /\[(Given|When|Then)\(@"([^"]+)"/g;

                let match;

                while ((match = regex.exec(content)) !== null) {

                    steps.push({
                      name: match[2],
                      file: relativeFile,
                      content: match[0]
                    });
                }
            }

            //----------------------------------
            // Scenarios
            //----------------------------------

            if (folder === "Features") {

                const regex = /Scenario:\s*(.+)/g;

                let match;

                while ((match = regex.exec(content)) !== null) {

                    scenarios.push({
                        name: match[1],
                      file: relativeFile,
                      content: match[0]
                    });
                }
            }
        }
    }

    return {

        methods,
        locators,
        steps,
        scenarios,
        helperMethods

    };
}

function getRelevantFilesFromIndex(
    detectedPages: string[],
    frameworkIndex: any,
    dependencyGraph: any
): string[] {

    const files = new Set<string>();

    for (const page of detectedPages) {

        const item = frameworkIndex[page];

        if (!item)
            continue;

        Object.values(item).forEach(file => {

            if (!file)
                return;

            files.add(file as string);

            const dependencies = dependencyGraph[file as string] || [];

            for (const dep of dependencies)
                files.add(dep);
        });
    }

    return [...files];
}

function readRelevantFiles(
    projectRoot: string,
    files: string[]
) {

    const snippets: string[] = [];

    for (const file of files) {

        const content = readText(projectRoot, file);

        if (!content)
            continue;

        snippets.push(
            `FILE: ${file}\n${content}`
        );
    }

    return snippets.join("\n\n");
}

export function buildPromptContext(projectRoot: string = process.cwd(), options: ContextBuildOptions = {}): BuiltContext {
  const frameworkPath = 'AIRecorder/FrameworkContext.md';
  const flowPath = 'AIRecorder/code.ts';
  const domPath = 'AIRecorder/LiveObservations.json';
  const frameworkIndexPath = "AIRecorder/FrameworkIndex.json";
  const dependencyGraphPath = "AIRecorder/DependencyGraph.json";
  const framework = readText(projectRoot, frameworkPath);
  const recordedFlow = readText(projectRoot, flowPath);
  const flow = analyzeFlow(projectRoot);
  const dom = readText(projectRoot, domPath) || '{}';
  const frameworkIndex = JSON.parse(readText(projectRoot, frameworkIndexPath) || "{}");
  const dependencyGraph = JSON.parse(readText(projectRoot, dependencyGraphPath) || "{}");
  const pageRecords = collectPageFiles(projectRoot);
  const detectedPages = detectPages(recordedFlow, pageRecords, options.explicitPages || []);
  const relevantFiles = getRelevantFilesFromIndex( detectedPages, frameworkIndex, dependencyGraph);
  const existing = scanExistingFramework(projectRoot);

  return {
    framework,
    recordedFlow,
    dom,
    flow,
    pageContext:
    readRelevantFiles(
        projectRoot,
        relevantFiles
    ),

    methods: existing.methods,
    locators: existing.locators,
    steps: existing.steps,
    scenarios: existing.scenarios,
    helpers: existing.helperMethods,

    detectedPages,
    includedFiles: [
    frameworkPath,
    flowPath,
    domPath,
    ...relevantFiles
]
};
}

