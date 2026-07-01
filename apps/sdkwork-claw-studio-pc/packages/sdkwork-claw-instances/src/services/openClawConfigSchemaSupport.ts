import { buildInstanceConfigWorkbenchSectionDescriptors } from './instanceConfigWorkbench.ts';

export type ConfigUiHint = {
  label?: string;
  help?: string;
  tags?: string[];
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  itemTemplate?: unknown;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  tags?: string[];
  'x-tags'?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: JsonSchema | boolean;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
};

export type ConfigSchemaAnalysis = {
  schema: JsonSchema | null;
  unsupportedPaths: string[];
};

export type ConfigSearchCriteria = {
  text: string;
  tags: string[];
};

const META_KEYS = new Set(['title', 'description', 'default', 'nullable']);
const SENSITIVE_KEY_WHITELIST_SUFFIXES = [
  'maxtokens',
  'maxoutputtokens',
  'maxinputtokens',
  'maxcompletiontokens',
  'contexttokens',
  'totaltokens',
  'tokencount',
  'tokenlimit',
  'tokenbudget',
  'passwordfile',
] as const;
const SENSITIVE_PATTERNS = [/token$/i, /password/i, /secret/i, /api.?key/i, /serviceaccount(?:ref)?$/i];
const ENV_VAR_PLACEHOLDER_PATTERN = /^\$\{[^}]*\}$/;

export const REDACTED_PLACEHOLDER = '[redacted - click reveal to view]';

export function schemaType(schema: JsonSchema): string | undefined {
  if (!schema) {
    return undefined;
  }
  if (Array.isArray(schema.type)) {
    const filtered = schema.type.filter((t) => t !== 'null');
    return filtered[0] ?? schema.type[0];
  }
  return schema.type;
}

export function pathKey(path: Array<string | number>): string {
  return path.filter((segment) => typeof segment === 'string').join('.');
}

export function hintForPath(path: Array<string | number>, hints: ConfigUiHints) {
  const key = pathKey(path);
  const direct = hints[key];
  if (direct) {
    return direct;
  }
  const segments = key.split('.');
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes('*')) {
      continue;
    }
    const hintSegments = hintKey.split('.');
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let i = 0; i < segments.length; i += 1) {
      if (hintSegments[i] !== '*' && hintSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }
  return undefined;
}

export function humanize(raw: string) {
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^./, (match) => match.toUpperCase());
}

export function defaultConfigValue(schema?: JsonSchema): unknown {
  if (!schema) {
    return '';
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  const type = schemaType(schema);
  switch (type) {
    case 'object':
      return {};
    case 'array':
      return [];
    case 'boolean':
      return false;
    case 'number':
    case 'integer':
      return 0;
    case 'string':
      return '';
    default:
      return '';
  }
}

export function isSensitiveConfigPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const whitelisted = SENSITIVE_KEY_WHITELIST_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix));
  return !whitelisted && SENSITIVE_PATTERNS.some((pattern) => pattern.test(path));
}

function isEnvVarPlaceholder(value: string): boolean {
  return ENV_VAR_PLACEHOLDER_PATTERN.test(value.trim());
}

function isSensitiveLeafValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0 && !isEnvVarPlaceholder(value);
  }
  return value !== undefined && value !== null;
}

function isHintSensitive(hint: ConfigUiHint | undefined): boolean {
  return hint?.sensitive ?? false;
}

export function hasSensitiveConfigData(
  value: unknown,
  path: Array<string | number>,
  hints: ConfigUiHints,
): boolean {
  const key = pathKey(path);
  const hint = hintForPath(path, hints);
  const pathIsSensitive = isHintSensitive(hint) || isSensitiveConfigPath(key);

  if (pathIsSensitive && isSensitiveLeafValue(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item, index) => hasSensitiveConfigData(item, [...path, index], hints));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([childKey, childValue]) =>
      hasSensitiveConfigData(childValue, [...path, childKey], hints),
    );
  }

  return false;
}

export function countSensitiveConfigValues(
  value: unknown,
  path: Array<string | number>,
  hints: ConfigUiHints,
): number {
  if (value == null) {
    return 0;
  }

  const key = pathKey(path);
  const hint = hintForPath(path, hints);
  const pathIsSensitive = isHintSensitive(hint) || isSensitiveConfigPath(key);

  if (pathIsSensitive && isSensitiveLeafValue(value)) {
    return 1;
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (count, item, index) => count + countSensitiveConfigValues(item, [...path, index], hints),
      0,
    );
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce(
      (count, [childKey, childValue]) =>
        count + countSensitiveConfigValues(childValue, [...path, childKey], hints),
      0,
    );
  }

  return 0;
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const normalized = entry.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(normalized);
  }
  return tags;
}

function resolveFieldMeta(
  path: Array<string | number>,
  schema: JsonSchema,
  hints: ConfigUiHints,
) {
  const hint = hintForPath(path, hints);
  const label = hint?.label ?? schema.title ?? humanize(String(path.at(-1)));
  const help = hint?.help ?? schema.description;
  const schemaTags = normalizeTags(schema['x-tags'] ?? schema.tags);
  const hintTags = normalizeTags(hint?.tags);

  return {
    label,
    help,
    tags: hintTags.length > 0 ? hintTags : schemaTags,
  };
}

function hasSearchCriteria(criteria: ConfigSearchCriteria | undefined): boolean {
  return Boolean(criteria && (criteria.text.length > 0 || criteria.tags.length > 0));
}

export function parseConfigSearchQuery(query: string): ConfigSearchCriteria {
  const tags: string[] = [];
  const seen = new Set<string>();
  const raw = query.trim();
  const stripped = raw.replace(/(^|\s)tag:([^\s]+)/gi, (_, leading: string, token: string) => {
    const normalized = token.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      tags.push(normalized);
    }
    return leading;
  });

  return {
    text: stripped.trim().toLowerCase(),
    tags,
  };
}

function matchesText(text: string, candidates: Array<string | undefined>): boolean {
  if (!text) {
    return true;
  }
  for (const candidate of candidates) {
    if (candidate && candidate.toLowerCase().includes(text)) {
      return true;
    }
  }
  return false;
}

function matchesTags(filterTags: string[], fieldTags: string[]): boolean {
  if (filterTags.length === 0) {
    return true;
  }
  const normalized = new Set(fieldTags.map((tag) => tag.toLowerCase()));
  return filterTags.every((tag) => normalized.has(tag));
}

export function matchesConfigNodeSelf(params: {
  schema: JsonSchema;
  path: Array<string | number>;
  hints: ConfigUiHints;
  criteria: ConfigSearchCriteria;
}): boolean {
  const { schema, path, hints, criteria } = params;
  if (!hasSearchCriteria(criteria)) {
    return true;
  }

  const { label, help, tags } = resolveFieldMeta(path, schema, hints);
  if (!matchesTags(criteria.tags, tags)) {
    return false;
  }

  if (!criteria.text) {
    return true;
  }

  const pathLabel = path
    .filter((segment): segment is string => typeof segment === 'string')
    .join('.');
  const enumText =
    schema.enum && schema.enum.length > 0 ? schema.enum.map((value) => String(value)).join(' ') : '';

  return matchesText(criteria.text, [
    label,
    help,
    schema.title,
    schema.description,
    pathLabel,
    enumText,
  ]);
}

export function matchesConfigNodeSearch(params: {
  schema: JsonSchema;
  value: unknown;
  path: Array<string | number>;
  hints: ConfigUiHints;
  criteria: ConfigSearchCriteria;
}): boolean {
  const { schema, value, path, hints, criteria } = params;
  if (!hasSearchCriteria(criteria)) {
    return true;
  }
  if (matchesConfigNodeSelf({ schema, path, hints, criteria })) {
    return true;
  }

  const type = schemaType(schema);
  if (type === 'object') {
    const fallback = value ?? schema.default;
    const obj =
      fallback && typeof fallback === 'object' && !Array.isArray(fallback)
        ? (fallback as Record<string, unknown>)
        : {};
    const props = schema.properties ?? {};
    for (const [propKey, node] of Object.entries(props)) {
      if (
        matchesConfigNodeSearch({
          schema: node,
          value: obj[propKey],
          path: [...path, propKey],
          hints,
          criteria,
        })
      ) {
        return true;
      }
    }

    const additional = schema.additionalProperties;
    if (additional && typeof additional === 'object') {
      const reserved = new Set(Object.keys(props));
      for (const [entryKey, entryValue] of Object.entries(obj)) {
        if (reserved.has(entryKey)) {
          continue;
        }
        if (
          matchesConfigNodeSearch({
            schema: additional,
            value: entryValue,
            path: [...path, entryKey],
            hints,
            criteria,
          })
        ) {
          return true;
        }
      }
    }

    return false;
  }

  if (type === 'array') {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (!itemsSchema) {
      return false;
    }
    const arr = Array.isArray(value) ? value : Array.isArray(schema.default) ? schema.default : [];
    if (arr.length === 0) {
      return false;
    }
    for (let index = 0; index < arr.length; index += 1) {
      if (
        matchesConfigNodeSearch({
          schema: itemsSchema,
          value: arr[index],
          path: [...path, index],
          hints,
          criteria,
        })
      ) {
        return true;
      }
    }
  }

  return false;
}

function isAnySchema(schema: JsonSchema): boolean {
  const keys = Object.keys(schema ?? {}).filter((key) => !META_KEYS.has(key));
  return keys.length === 0;
}

function normalizeEnum(values: unknown[]): { enumValues: unknown[]; nullable: boolean } {
  const filtered = values.filter((value) => value != null);
  const nullable = filtered.length !== values.length;
  const enumValues: unknown[] = [];
  for (const value of filtered) {
    if (!enumValues.some((existing) => Object.is(existing, value))) {
      enumValues.push(value);
    }
  }
  return { enumValues, nullable };
}

function isSecretRefVariant(entry: JsonSchema): boolean {
  if (schemaType(entry) !== 'object') {
    return false;
  }
  const source = entry.properties?.source;
  const provider = entry.properties?.provider;
  const id = entry.properties?.id;
  if (!source || !provider || !id) {
    return false;
  }
  return typeof source.const === 'string' && schemaType(provider) === 'string' && schemaType(id) === 'string';
}

function isSecretRefUnion(entry: JsonSchema): boolean {
  const variants = entry.oneOf ?? entry.anyOf;
  if (!variants || variants.length === 0) {
    return false;
  }
  return variants.every((variant) => isSecretRefVariant(variant));
}

function normalizeSecretInputUnion(
  schema: JsonSchema,
  path: Array<string | number>,
  remaining: JsonSchema[],
  nullable: boolean,
): ConfigSchemaAnalysis | null {
  const stringIndex = remaining.findIndex((entry) => schemaType(entry) === 'string');
  if (stringIndex < 0) {
    return null;
  }
  const nonString = remaining.filter((_, index) => index !== stringIndex);
  if (nonString.length !== 1 || !isSecretRefUnion(nonString[0]!)) {
    return null;
  }
  return normalizeSchemaNode(
    {
      ...schema,
      ...remaining[stringIndex],
      nullable,
      anyOf: undefined,
      oneOf: undefined,
      allOf: undefined,
    },
    path,
  );
}

function normalizeUnion(
  schema: JsonSchema,
  path: Array<string | number>,
): ConfigSchemaAnalysis | null {
  if (schema.allOf) {
    return null;
  }
  const union = schema.anyOf ?? schema.oneOf;
  if (!union) {
    return null;
  }

  const literals: unknown[] = [];
  const remaining: JsonSchema[] = [];
  let nullable = false;

  for (const entry of union) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    if (Array.isArray(entry.enum)) {
      const { enumValues, nullable: enumNullable } = normalizeEnum(entry.enum);
      literals.push(...enumValues);
      if (enumNullable) {
        nullable = true;
      }
      continue;
    }
    if ('const' in entry) {
      if (entry.const == null) {
        nullable = true;
        continue;
      }
      literals.push(entry.const);
      continue;
    }
    if (schemaType(entry) === 'null') {
      nullable = true;
      continue;
    }
    remaining.push(entry);
  }

  const secretInput = normalizeSecretInputUnion(schema, path, remaining, nullable);
  if (secretInput) {
    return secretInput;
  }

  if (literals.length > 0 && remaining.length === 0) {
    const unique: unknown[] = [];
    for (const value of literals) {
      if (!unique.some((existing) => Object.is(existing, value))) {
        unique.push(value);
      }
    }
    return {
      schema: {
        ...schema,
        enum: unique,
        nullable,
        anyOf: undefined,
        oneOf: undefined,
        allOf: undefined,
      },
      unsupportedPaths: [],
    };
  }

  if (remaining.length === 1) {
    return normalizeSchemaNode(
      {
        ...schema,
        ...remaining[0],
        nullable,
        anyOf: undefined,
        oneOf: undefined,
        allOf: undefined,
      },
      path,
    );
  }

  return null;
}

function normalizeSchemaNode(schema: JsonSchema, path: Array<string | number>): ConfigSchemaAnalysis {
  const unsupported = new Set<string>();
  const normalized: JsonSchema = { ...schema };
  const pathLabel = pathKey(path) || '<root>';

  if (schema.anyOf || schema.oneOf || schema.allOf) {
    const union = normalizeUnion(schema, path);
    if (union) {
      return union;
    }
    return { schema, unsupportedPaths: [pathLabel] };
  }

  const nullable = Array.isArray(schema.type) && schema.type.includes('null');
  const type = schemaType(schema) ?? (schema.properties || schema.additionalProperties ? 'object' : undefined);
  normalized.type = type ?? schema.type;
  normalized.nullable = nullable || schema.nullable;

  if (normalized.enum) {
    const { enumValues, nullable: enumNullable } = normalizeEnum(normalized.enum);
    normalized.enum = enumValues;
    if (enumNullable) {
      normalized.nullable = true;
    }
    if (enumValues.length === 0) {
      unsupported.add(pathLabel);
    }
  }

  if (type === 'object') {
    const properties = schema.properties ?? {};
    const normalizedProps: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(properties)) {
      const result = normalizeSchemaNode(value, [...path, key]);
      if (result.schema) {
        normalizedProps[key] = result.schema;
      }
      for (const entry of result.unsupportedPaths) {
        unsupported.add(entry);
      }
    }
    normalized.properties = normalizedProps;

    if (schema.additionalProperties === true) {
      normalized.additionalProperties = {};
    } else if (schema.additionalProperties === false) {
      normalized.additionalProperties = false;
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      if (!isAnySchema(schema.additionalProperties)) {
        const result = normalizeSchemaNode(schema.additionalProperties, [...path, '*']);
        normalized.additionalProperties = result.schema ?? schema.additionalProperties;
        if (result.unsupportedPaths.length > 0) {
          unsupported.add(pathLabel);
        }
      }
    }
  } else if (type === 'array') {
    const itemsSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (!itemsSchema) {
      unsupported.add(pathLabel);
    } else {
      const result = normalizeSchemaNode(itemsSchema, [...path, '*']);
      normalized.items = result.schema ?? itemsSchema;
      if (result.unsupportedPaths.length > 0) {
        unsupported.add(pathLabel);
      }
    }
  } else if (
    type !== 'string' &&
    type !== 'number' &&
    type !== 'integer' &&
    type !== 'boolean' &&
    !normalized.enum
  ) {
    unsupported.add(pathLabel);
  }

  return {
    schema: normalized,
    unsupportedPaths: Array.from(unsupported),
  };
}

export function analyzeConfigSchema(raw: unknown): ConfigSchemaAnalysis {
  if (!raw || typeof raw !== 'object') {
    return { schema: null, unsupportedPaths: ['<root>'] };
  }
  return normalizeSchemaNode(raw as JsonSchema, []);
}

export function cloneConfigObject<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeConfigForm(form: Record<string, unknown>): string {
  return `${JSON.stringify(form, null, 2).trimEnd()}\n`;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isForbiddenKey(key: string | number) {
  return typeof key === 'string' && FORBIDDEN_KEYS.has(key);
}

function resolvePathContainer(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
  createMissing: boolean,
) {
  if (path.length === 0 || path.some(isForbiddenKey)) {
    return null;
  }

  let current: Record<string, unknown> | unknown[] = obj;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]!;
    const nextKey = path[index + 1];
    if (typeof key === 'number') {
      if (!Array.isArray(current)) {
        return null;
      }
      if (current[key] == null) {
        if (!createMissing) {
          return null;
        }
        current[key] = typeof nextKey === 'number' ? [] : {};
      }
      current = current[key] as Record<string, unknown> | unknown[];
      continue;
    }

    const record = current as Record<string, unknown>;
    if (record[key] == null) {
      if (!createMissing) {
        return null;
      }
      record[key] = typeof nextKey === 'number' ? [] : {};
    }
    current = record[key] as Record<string, unknown> | unknown[];
  }

  return { current, lastKey: path[path.length - 1]! };
}

function resolvePathValue(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
): unknown {
  if (path.length === 0 || path.some(isForbiddenKey)) {
    return obj;
  }

  let current: unknown = obj;
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function setPathValue(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
  value: unknown,
) {
  const container = resolvePathContainer(obj, path, true);
  if (!container) {
    return;
  }
  if (typeof container.lastKey === 'number') {
    if (Array.isArray(container.current)) {
      container.current[container.lastKey] = value;
    }
    return;
  }
  (container.current as Record<string, unknown>)[container.lastKey] = value;
}

export function removePathValue(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
) {
  const container = resolvePathContainer(obj, path, false);
  if (!container) {
    return;
  }
  if (typeof container.lastKey === 'number') {
    if (Array.isArray(container.current)) {
      container.current.splice(container.lastKey, 1);
    }
    return;
  }
  delete (container.current as Record<string, unknown>)[container.lastKey];
}

export function renameObjectEntry(
  obj: Record<string, unknown> | unknown[],
  path: Array<string | number>,
  fromKey: string,
  toKey: string,
): boolean {
  const normalizedFromKey = fromKey.trim();
  const normalizedToKey = toKey.trim();

  if (
    !normalizedFromKey ||
    !normalizedToKey ||
    normalizedFromKey === normalizedToKey ||
    isForbiddenKey(normalizedFromKey) ||
    isForbiddenKey(normalizedToKey)
  ) {
    return false;
  }

  const target = resolvePathValue(obj, path);
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return false;
  }

  const record = target as Record<string, unknown>;
  if (!(normalizedFromKey in record) || normalizedToKey in record) {
    return false;
  }

  record[normalizedToKey] = record[normalizedFromKey];
  delete record[normalizedFromKey];
  return true;
}

function coerceNumberString(value: string, integer: boolean): number | undefined | string {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  if (integer && !Number.isInteger(parsed)) {
    return value;
  }
  return parsed;
}

function coerceBooleanString(value: string): boolean | string {
  const trimmed = value.trim();
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  return value;
}

export function coerceFormValues(value: unknown, schema: JsonSchema): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (schema.allOf && schema.allOf.length > 0) {
    let next: unknown = value;
    for (const segment of schema.allOf) {
      next = coerceFormValues(next, segment);
    }
    return next;
  }

  const type = schemaType(schema);

  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf ?? schema.oneOf ?? []).filter(
      (variant) => !(variant.type === 'null' || (Array.isArray(variant.type) && variant.type.includes('null'))),
    );

    if (variants.length === 1) {
      return coerceFormValues(value, variants[0]!);
    }

    if (typeof value === 'string') {
      for (const variant of variants) {
        const variantType = schemaType(variant);
        if (variantType === 'number' || variantType === 'integer') {
          const coerced = coerceNumberString(value, variantType === 'integer');
          if (coerced === undefined || typeof coerced === 'number') {
            return coerced;
          }
        }
        if (variantType === 'boolean') {
          const coerced = coerceBooleanString(value);
          if (typeof coerced === 'boolean') {
            return coerced;
          }
        }
      }
    }

    for (const variant of variants) {
      const variantType = schemaType(variant);
      if (variantType === 'object' && typeof value === 'object' && !Array.isArray(value)) {
        return coerceFormValues(value, variant);
      }
      if (variantType === 'array' && Array.isArray(value)) {
        return coerceFormValues(value, variant);
      }
    }

    return value;
  }

  if (type === 'number' || type === 'integer') {
    if (typeof value === 'string') {
      const coerced = coerceNumberString(value, type === 'integer');
      if (coerced === undefined || typeof coerced === 'number') {
        return coerced;
      }
    }
    return value;
  }

  if (type === 'boolean') {
    if (typeof value === 'string') {
      const coerced = coerceBooleanString(value);
      if (typeof coerced === 'boolean') {
        return coerced;
      }
    }
    return value;
  }

  if (type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const obj = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    const additional =
      schema.additionalProperties && typeof schema.additionalProperties === 'object'
        ? schema.additionalProperties
        : null;
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(obj)) {
      const propertySchema = props[key] ?? additional;
      const coerced = propertySchema ? coerceFormValues(entryValue, propertySchema) : entryValue;
      if (coerced !== undefined) {
        result[key] = coerced;
      }
    }
    return result;
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      return value;
    }
    if (Array.isArray(schema.items)) {
      const tuple = schema.items;
      return value.map((item, index) => {
        const entrySchema = index < tuple.length ? tuple[index] : undefined;
        return entrySchema ? coerceFormValues(item, entrySchema) : item;
      });
    }
    const itemsSchema = schema.items;
    if (!itemsSchema) {
      return value;
    }
    return value.map((item) => coerceFormValues(item, itemsSchema)).filter((entry) => entry !== undefined);
  }

  return value;
}

export function deriveVisibleSchemaSections(schema: JsonSchema | null) {
  const properties = schema?.properties ?? {};
  return buildInstanceConfigWorkbenchSectionDescriptors(Object.keys(properties));
}
