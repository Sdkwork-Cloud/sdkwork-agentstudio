import { parseJson5 } from '@sdkwork/local-api-proxy';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}
export type JsonArray = JsonValue[];

export interface OpenClawConfigDocumentSection {
  key: string;
  kind: 'object' | 'array' | 'scalar';
  entryCount: number;
  fieldNames: string[];
  formattedValue: string;
  preview: string;
}

export interface OpenClawConfigDocumentAnalysis {
  parseError: string | null;
  sections: OpenClawConfigDocumentSection[];
}

export interface OpenClawParsedConfigDocument {
  parsed: JsonObject | null;
  parseError: string | null;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function truncateConfigDocumentPreview(value: string, maxLength = 96) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

export function buildConfigDocumentPreview(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Empty list';
    }

    return truncateConfigDocumentPreview(
      value
        .slice(0, 3)
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          if (isJsonObject(entry as JsonValue | undefined)) {
            return Object.keys(entry as JsonObject)
              .slice(0, 2)
              .join(', ');
          }
          return String(entry);
        })
        .filter(Boolean)
        .join(', '),
    );
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    const keys = Object.keys(value as JsonObject);
    if (keys.length === 0) {
      return 'Empty object';
    }

    return truncateConfigDocumentPreview(keys.slice(0, 4).join(', '));
  }

  if (value == null) {
    return 'No value';
  }

  if (typeof value === 'string') {
    return truncateConfigDocumentPreview(value || 'Empty string');
  }

  return truncateConfigDocumentPreview(String(value));
}

export function getConfigDocumentSectionKind(
  value: unknown,
): OpenClawConfigDocumentSection['kind'] {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return 'object';
  }

  return 'scalar';
}

export function countConfigDocumentSectionEntries(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return Object.keys(value as JsonObject).length;
  }

  return value == null ? 0 : 1;
}

export function collectConfigDocumentFieldNames(value: unknown) {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map((_, index) => `[${index}]`);
  }

  if (isJsonObject(value as JsonValue | undefined)) {
    return Object.keys(value as JsonObject);
  }

  return [];
}

export function formatConfigDocumentValue(value: unknown) {
  const formatted = JSON.stringify(value, null, 2);
  return typeof formatted === 'string' ? formatted : String(value);
}

export function analyzeOpenClawConfigDocument(raw: string): OpenClawConfigDocumentAnalysis {
  const parsedDocument = parseOpenClawConfigDocument(raw);
  if (!parsedDocument.parsed) {
    return {
      parseError: parsedDocument.parseError,
      sections: [],
    };
  }

  return {
    parseError: null,
    sections: Object.entries(parsedDocument.parsed).map(([key, value]) => ({
      key,
      kind: getConfigDocumentSectionKind(value),
      entryCount: countConfigDocumentSectionEntries(value),
      fieldNames: collectConfigDocumentFieldNames(value),
      formattedValue: formatConfigDocumentValue(value),
      preview: buildConfigDocumentPreview(value),
    })),
  };
}

export function parseOpenClawConfigDocument(raw: string): OpenClawParsedConfigDocument {
  const normalized = raw.trim();
  if (!normalized) {
    return {
      parsed: {},
      parseError: null,
    };
  }

  try {
    const parsed = parseJson5<JsonValue>(raw);
    if (!isJsonObject(parsed)) {
      return {
        parsed: null,
        parseError: 'OpenClaw config document must contain a top-level object.',
      };
    }

    return {
      parsed,
      parseError: null,
    };
  } catch (error: any) {
    const rawErrorMessage =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Failed to parse openclaw.json draft.';
    return {
      parsed: null,
      parseError: /openclaw\.json|json5|json/i.test(rawErrorMessage)
        ? rawErrorMessage
        : `Invalid openclaw.json JSON5: ${rawErrorMessage}`,
    };
  }
}

export function serializeOpenClawConfigDocument(root: Record<string, unknown>) {
  return `${JSON.stringify(root, null, 2).trimEnd()}\n`;
}

export function requireOpenClawConfigDocumentRoot(raw: string): JsonObject {
  const parsedDocument = parseOpenClawConfigDocument(raw);
  if (!parsedDocument.parsed) {
    throw new Error(
      parsedDocument.parseError || 'OpenClaw config document must contain a top-level object.',
    );
  }

  return parsedDocument.parsed;
}

export function mutateOpenClawConfigDocument(raw: string, mutate: (root: JsonObject) => void) {
  const root = requireOpenClawConfigDocumentRoot(raw);
  mutate(root);
  return serializeOpenClawConfigDocument(root);
}
