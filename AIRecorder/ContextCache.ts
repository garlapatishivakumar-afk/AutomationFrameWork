// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';

declare const process: {
  cwd: () => string;
};

export type PageEntry = {
  page: string;
  methodsFile?: string;
  objectsFile?: string;
  stepsFile?: string;
  featureFile?: string;
};

export type HelperEntry = {
  name: string;
  file: string;
};

export type ProjectSnapshot = {
  pages: Record<string, PageEntry>;
  helpers: Record<string, HelperEntry>;
};

type CacheState = {
  root: string;
  signature: string;
  snapshot: ProjectSnapshot;
};

const TRACKED_DIRS = ['Features', 'StepDefinitions', 'PageActions', 'PageElements', 'Helpers'];

let cacheState: CacheState | null = null;

function normalizeKey(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function removeSuffix(value: string, suffix: string): string {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
}

function listFiles(projectRoot: string, relativeDir: string, suffix: string): string[] {
  const absoluteDir = path.join(projectRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry: fs.Dirent) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry: fs.Dirent) => toPosix(path.join(relativeDir, entry.name)));
}

function ensurePage(dictionary: Record<string, PageEntry>, pageName: string): PageEntry {
  const key = normalizeKey(pageName);
  if (!dictionary[key]) {
    dictionary[key] = { page: pageName };
  }

  return dictionary[key];
}

function buildSignature(projectRoot: string): string {
  const parts: string[] = [];

  for (const relativeDir of TRACKED_DIRS) {
    const absoluteDir = path.join(projectRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) {
      parts.push(`${relativeDir}:missing`);
      continue;
    }

    const entries = fs
      .readdirSync(absoluteDir, { withFileTypes: true })
      .filter((entry: fs.Dirent) => entry.isFile())
      .map((entry: fs.Dirent) => {
        const absolutePath = path.join(absoluteDir, entry.name);
        const stat = fs.statSync(absolutePath);
        return `${entry.name}|${stat.mtimeMs}|${stat.size}`;
      })
      .sort();

    parts.push(`${relativeDir}:${entries.join(',')}`);
  }

  return parts.join(';');
}

function buildSnapshot(projectRoot: string): ProjectSnapshot {
  const pages: Record<string, PageEntry> = {};

  const methodsFiles = listFiles(projectRoot, 'PageActions', 'Methods.cs');
  for (const file of methodsFiles) {
    const pageName = removeSuffix(path.basename(file), 'Methods.cs');
    ensurePage(pages, pageName).methodsFile = file;
  }

  const objectsFiles = listFiles(projectRoot, 'PageElements', 'Objects.cs');
  for (const file of objectsFiles) {
    const pageName = removeSuffix(path.basename(file), 'Objects.cs');
    ensurePage(pages, pageName).objectsFile = file;
  }

  const stepsFiles = listFiles(projectRoot, 'StepDefinitions', 'Steps.cs');
  for (const file of stepsFiles) {
    const pageName = removeSuffix(path.basename(file), 'Steps.cs');
    ensurePage(pages, pageName).stepsFile = file;
  }

  const featureFiles = listFiles(projectRoot, 'Features', '.feature');
  for (const file of featureFiles) {
    const pageName = removeSuffix(path.basename(file), '.feature');
    ensurePage(pages, pageName).featureFile = file;
  }

  const helpers: Record<string, HelperEntry> = {};
  const helperFiles = listFiles(projectRoot, 'Helpers', '.cs');
  for (const file of helperFiles) {
    const name = removeSuffix(path.basename(file), '.cs');
    helpers[normalizeKey(name)] = { name, file };
  }

  return { pages, helpers };
}

export function getProjectSnapshot(projectRoot = process.cwd(), forceRefresh = false): ProjectSnapshot {
  const signature = buildSignature(projectRoot);

  if (!forceRefresh && cacheState && cacheState.root === projectRoot && cacheState.signature === signature) {
    return cacheState.snapshot;
  }

  const snapshot = buildSnapshot(projectRoot);
  cacheState = {
    root: projectRoot,
    signature,
    snapshot
  };

  return snapshot;
}

export function clearProjectSnapshotCache(): void {
  cacheState = null;
}

export function readFileText(projectRoot: string, relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return '';
  }

  return fs.readFileSync(absolutePath, 'utf8');
}

export function normalizeLookupKey(value: string): string {
  return normalizeKey(value);
}
