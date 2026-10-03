import { HelperEntry, normalizeLookupKey } from './ContextCache';

type HelperMetadata = {
  helperName: string;
  keywords: string[];
};

const HELPER_METADATA: HelperMetadata[] = [
  {
    helperName: 'ExcelUtility',
    keywords: ['ExcelUtility', 'ReadExcel', 'GetCellValue', 'Worksheet', 'Workbook', 'xlsx']
  },
  {
    helperName: 'FileDataReaders',
    keywords: ['FileDataReaders', 'ReadJson', 'ReadDataFile', 'data.json']
  },
  {
    helperName: 'FileDataWriters',
    keywords: ['FileDataWriters', 'WriteJson', 'WriteDataFile']
  },
  {
    helperName: 'CommonActionsPage',
    keywords: ['CommonActionsPage', 'Login', 'Navigate', 'Click', 'Runasuser', 'Change User']
  },
  {
    helperName: 'ConfigReader',
    keywords: ['ConfigReader', 'appsettings', 'Urls', 'BaseUrl']
  },
  {
    helperName: 'SmartLocators',
    keywords: ['SmartLocators', 'SelfHeal', 'FallbackLocator']
  }
];

export function resolveHelpersFromMetadata(
  signals: string[],
  availableHelpers: Record<string, HelperEntry>
): HelperEntry[] {
  const signalKeys = signals.map((value) => normalizeLookupKey(value));
  const selected: HelperEntry[] = [];
  const selectedKeys = new Set<string>();

  for (const entry of HELPER_METADATA) {
    const helperKey = normalizeLookupKey(entry.helperName);
    const available = availableHelpers[helperKey];
    if (!available) {
      continue;
    }

    const keywordKeys = entry.keywords.map((keyword) => normalizeLookupKey(keyword));
    const matched = keywordKeys.some((keywordKey) => signalKeys.some((signalKey) => signalKey.includes(keywordKey)));
    if (!matched || selectedKeys.has(helperKey)) {
      continue;
    }

    selected.push(available);
    selectedKeys.add(helperKey);
  }

  return selected;
}
