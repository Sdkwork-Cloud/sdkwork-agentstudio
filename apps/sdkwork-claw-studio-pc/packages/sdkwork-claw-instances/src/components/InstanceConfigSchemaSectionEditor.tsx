import React, { useEffect, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sdkwork/claw-ui';
import {
  analyzeConfigSchema,
  cloneConfigObject,
  coerceFormValues,
  countSensitiveConfigValues,
  defaultConfigValue,
  hasSensitiveConfigData,
  hintForPath,
  humanize,
  matchesConfigNodeSearch,
  matchesConfigNodeSelf,
  pathKey,
  parseConfigSearchQuery,
  REDACTED_PLACEHOLDER,
  removePathValue,
  renameObjectEntry,
  schemaType,
  setPathValue,
  type ConfigSearchCriteria,
  type ConfigUiHints,
  type JsonSchema,
} from '../services';

interface InstanceConfigSchemaSectionEditorProps {
  schema: unknown;
  uiHints: ConfigUiHints;
  rootValue: Record<string, unknown> | null;
  activeSectionKey: string;
  revealSensitive?: boolean;
  searchQuery?: string;
  onRootValueChange: (next: Record<string, unknown>) => void;
  t: (key: string, en: string, zh: string, options?: Record<string, unknown>) => string;
}

type FieldMeta = {
  label: string;
  help?: string;
  tags: string[];
};

type SensitiveState = {
  isSensitive: boolean;
  isRedacted: boolean;
  isRevealed: boolean;
};

type RenderNodeParams = {
  path: Array<string | number>;
  schema: JsonSchema;
  value: unknown;
  uiHints: ConfigUiHints;
  unsupportedPaths: Set<string>;
  revealSensitive: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  onValueChange: (path: Array<string | number>, value: unknown) => void;
  onValueRemove: (path: Array<string | number>) => void;
  onObjectEntryRename: (path: Array<string | number>, fromKey: string, toKey: string) => void;
  t: InstanceConfigSchemaSectionEditorProps['t'];
  showLabel?: boolean;
  searchCriteria?: ConfigSearchCriteria;
};

const META_KEYS = new Set(['title', 'description', 'default', 'nullable', 'tags', 'x-tags']);
const NULL_SELECT_VALUE = '__sdkwork_claw_unset__';

function isAnySchema(schema: JsonSchema): boolean {
  const keys = Object.keys(schema ?? {}).filter((key) => !META_KEYS.has(key));
  return keys.length === 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonValue(value: unknown) {
  if (value === undefined) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return '';
  }
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
  uiHints: ConfigUiHints,
): FieldMeta {
  const hint = hintForPath(path, uiHints);
  const label = hint?.label || schema.title || humanize(String(path[path.length - 1] ?? 'value'));
  const help = hint?.help || schema.description;
  const schemaTags = normalizeTags(schema['x-tags'] ?? schema.tags);
  const hintTags = normalizeTags(hint?.tags);

  return {
    label,
    help,
    tags: hintTags.length > 0 ? hintTags : schemaTags,
  };
}

function createUniqueEntryKey(value: Record<string, unknown>, base = 'custom') {
  let index = 1;
  let key = `${base}-${index}`;
  while (key in value) {
    index += 1;
    key = `${base}-${index}`;
  }
  return key;
}

function getSensitiveState(params: {
  path: Array<string | number>;
  value: unknown;
  uiHints: ConfigUiHints;
  revealSensitive: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
}): SensitiveState {
  const isSensitive = hasSensitiveConfigData(params.value, params.path, params.uiHints);
  const isRevealed =
    isSensitive && (params.revealSensitive || params.isSensitivePathRevealed(params.path));

  return {
    isSensitive,
    isRedacted: isSensitive && !isRevealed,
    isRevealed,
  };
}

function renderTags(tags: string[]) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-zinc-200/80 bg-zinc-50/80 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function SensitiveToggleButton(params: {
  path: Array<string | number>;
  state: SensitiveState;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  t: InstanceConfigSchemaSectionEditorProps['t'];
}) {
  if (!params.state.isSensitive) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => params.onToggleSensitivePath(params.path)}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        params.state.isRevealed
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
          : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100'
      }`}
      title={
        params.state.isRevealed
          ? params.t('instances.detail.instanceWorkbench.config.schemaEditor.hideValue', 'Hide value', 'Hide value')
          : params.t('instances.detail.instanceWorkbench.config.schemaEditor.revealValue', 'Reveal value', 'Reveal value')
      }
      aria-label={
        params.state.isRevealed
          ? params.t('instances.detail.instanceWorkbench.config.schemaEditor.hideValue', 'Hide value', 'Hide value')
          : params.t('instances.detail.instanceWorkbench.config.schemaEditor.revealValue', 'Reveal value', 'Reveal value')
      }
      aria-pressed={params.state.isRevealed}
    >
      {params.state.isRevealed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

function JsonTextareaField(params: {
  path: Array<string | number>;
  schema: JsonSchema;
  value: unknown;
  meta: FieldMeta;
  uiHints: ConfigUiHints;
  revealSensitive: boolean;
  isSensitivePathRevealed: (path: Array<string | number>) => boolean;
  onToggleSensitivePath: (path: Array<string | number>) => void;
  onValueChange: (path: Array<string | number>, value: unknown) => void;
  t: InstanceConfigSchemaSectionEditorProps['t'];
  showLabel?: boolean;
}) {
  const showLabel = params.showLabel ?? true;
  const sensitiveState = getSensitiveState({
    path: params.path,
    value: params.value,
    uiHints: params.uiHints,
    revealSensitive: params.revealSensitive,
    isSensitivePathRevealed: params.isSensitivePathRevealed,
  });
  const displayValue = sensitiveState.isRedacted ? '' : jsonValue(params.value);

  return (
    <div className="rounded-2xl border border-zinc-200/70 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      {showLabel ? (
        <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
      ) : null}
      {params.meta.help ? (
        <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
      ) : null}
      {renderTags(params.meta.tags)}
      <div className="mt-3 flex items-start gap-2">
        <Textarea
          key={pathKey(params.path)}
          defaultValue={displayValue}
          placeholder={
            sensitiveState.isRedacted
              ? REDACTED_PLACEHOLDER
              : params.t('instances.detail.instanceWorkbench.config.schemaEditor.jsonValuePlaceholder', 'JSON value', 'JSON value')
          }
          readOnly={sensitiveState.isRedacted}
          rows={Math.max(4, Math.min(12, displayValue.split(/\r?\n/).length || 4))}
          onClick={() => {
            if (sensitiveState.isRedacted) {
              params.onToggleSensitivePath(params.path);
            }
          }}
          onBlur={(event) => {
            if (sensitiveState.isRedacted) {
              return;
            }
            const raw = event.target.value.trim();
            if (!raw) {
              params.onValueChange(params.path, undefined);
              return;
            }
            try {
              params.onValueChange(params.path, JSON.parse(raw));
            } catch {
              event.target.value = displayValue;
            }
          }}
          className={`min-h-[112px] w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
            sensitiveState.isRedacted
              ? 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
              : 'border-zinc-200 bg-white text-zinc-950 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500'
          }`}
        />
        <SensitiveToggleButton
          path={params.path}
          state={sensitiveState}
          onToggleSensitivePath={params.onToggleSensitivePath}
          t={params.t}
        />
      </div>
    </div>
  );
}

function ScalarField(params: RenderNodeParams & { meta: FieldMeta }) {
  const type = schemaType(params.schema);
  const showLabel = params.showLabel ?? true;
  const sensitiveState = getSensitiveState({
    path: params.path,
    value: params.value,
    uiHints: params.uiHints,
    revealSensitive: params.revealSensitive,
    isSensitivePathRevealed: params.isSensitivePathRevealed,
  });
  const hint = hintForPath(params.path, params.uiHints);
  const enumValues = Array.isArray(params.schema.enum) ? params.schema.enum : null;
  const nullable = Boolean(params.schema.nullable);

  if (enumValues && enumValues.length > 0) {
    const currentValue = params.value == null ? '' : String(params.value);
    const selectValue = currentValue === '' && nullable ? NULL_SELECT_VALUE : currentValue;

    return (
      <div className="block rounded-2xl border border-zinc-200/70 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
        {showLabel ? (
          <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
        ) : null}
        {params.meta.help ? (
          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
        ) : null}
        {renderTags(params.meta.tags)}
        <Select
          value={selectValue}
          onValueChange={(nextRaw) => {
            if (nextRaw === NULL_SELECT_VALUE && nullable) {
              params.onValueChange(params.path, undefined);
              return;
            }
            const nextValue = enumValues.find((entry) => String(entry) === nextRaw) ?? nextRaw;
            params.onValueChange(params.path, nextValue);
          }}
        >
          <SelectTrigger className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500">
            <SelectValue placeholder={params.t('instances.detail.instanceWorkbench.config.schemaEditor.notSet', 'Not set', 'Not set')} />
          </SelectTrigger>
          <SelectContent>
            {nullable ? (
              <SelectItem value={NULL_SELECT_VALUE}>{params.t('instances.detail.instanceWorkbench.config.schemaEditor.notSet', 'Not set', 'Not set')}</SelectItem>
            ) : null}
            {enumValues.map((entry) => (
              <SelectItem key={String(entry)} value={String(entry)}>
                {String(entry)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === 'boolean') {
    const checked = params.value === true;

    return (
      <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200/70 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="min-w-0">
          {showLabel ? (
            <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
          ) : null}
          {params.meta.help ? (
            <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
          ) : null}
          {renderTags(params.meta.tags)}
        </div>
        <button
          type="button"
          onClick={() => params.onValueChange(params.path, !checked)}
          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
            checked ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
          aria-pressed={checked}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition dark:bg-zinc-950 ${
              checked ? 'left-6 dark:bg-zinc-900' : 'left-1'
            }`}
          />
        </button>
      </label>
    );
  }

  const inputType = type === 'number' || type === 'integer' ? 'number' : 'text';
  const displayValue = sensitiveState.isRedacted ? '' : params.value == null ? '' : String(params.value);
  const placeholder = sensitiveState.isRedacted
    ? REDACTED_PLACEHOLDER
    : hint?.placeholder || (params.schema.default == null ? '' : String(params.schema.default));

  return (
    <label className="block rounded-2xl border border-zinc-200/70 bg-white/75 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
      {showLabel ? (
        <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
      ) : null}
      {params.meta.help ? (
        <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
      ) : null}
      {renderTags(params.meta.tags)}
      <div className="mt-3 flex items-start gap-2">
        <Input
          type={sensitiveState.isRedacted ? 'text' : inputType}
          value={displayValue}
          readOnly={sensitiveState.isRedacted}
          placeholder={placeholder}
          onClick={() => {
            if (sensitiveState.isRedacted) {
              params.onToggleSensitivePath(params.path);
            }
          }}
          onChange={(event) => {
            if (sensitiveState.isRedacted) {
              return;
            }
            params.onValueChange(params.path, event.target.value);
          }}
          className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
            sensitiveState.isRedacted
              ? 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
              : 'border-zinc-200 bg-white text-zinc-950 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-500'
          }`}
        />
        <SensitiveToggleButton
          path={params.path}
          state={sensitiveState}
          onToggleSensitivePath={params.onToggleSensitivePath}
          t={params.t}
        />
      </div>
    </label>
  );
}

function ArrayField(params: RenderNodeParams & { meta: FieldMeta }) {
  const itemsSchema = Array.isArray(params.schema.items) ? params.schema.items[0] : params.schema.items;

  if (!itemsSchema) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        {params.t('instances.detail.instanceWorkbench.config.schemaEditor.unsupportedArraySchema', 'Unsupported array schema. Use Raw mode.', 'Unsupported array schema. Use Raw mode.')}
      </div>
    );
  }

  const listValue = Array.isArray(params.value) ? params.value : [];
  const showLabel = params.showLabel ?? true;
  const selfMatched =
    params.searchCriteria &&
    matchesConfigNodeSelf({
      schema: params.schema,
      path: params.path,
      hints: params.uiHints,
      criteria: params.searchCriteria,
    });
  const childSearchCriteria = selfMatched ? undefined : params.searchCriteria;
  const visibleItems = childSearchCriteria
    ? listValue
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry, index }) =>
          matchesConfigNodeSearch({
            schema: itemsSchema,
            value: entry,
            path: [...params.path, index],
            hints: params.uiHints,
            criteria: childSearchCriteria,
          }),
        )
    : listValue.map((entry, index) => ({ entry, index }));

  return (
    <div className="rounded-[1.6rem] border border-zinc-200/70 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/35">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showLabel ? (
            <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
          ) : null}
          {params.meta.help ? (
            <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
          ) : null}
          {renderTags(params.meta.tags)}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {params.t('instances.detail.instanceWorkbench.config.schemaEditor.itemCount', '{{count}} items', '{{count}} items', { count: listValue.length })}
          </span>
          <button
            type="button"
            onClick={() => params.onValueChange(params.path, [...listValue, defaultConfigValue(itemsSchema)])}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <Plus className="h-4 w-4" />
            {params.t('instances.detail.instanceWorkbench.config.schemaEditor.addItem', 'Add item', 'Add item')}
          </button>
        </div>
      </div>

      {listValue.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-200/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.noItemsYet', 'No items yet. Add one to begin editing.', 'No items yet. Add one to begin editing.')}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-200/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.noArrayItemsMatchSearch', 'No array items match the current search.', 'No array items match the current search.')}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleItems.map(({ entry, index }) => (
            <div
              key={index}
              className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/55"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {params.t('instances.detail.instanceWorkbench.config.schemaEditor.itemLabel', 'Item {{count}}', 'Item {{count}}', { count: index + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...listValue];
                    next.splice(index, 1);
                    params.onValueChange(params.path, next);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-rose-200 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-rose-500/30 dark:hover:text-rose-300"
                  aria-label={params.t('instances.detail.instanceWorkbench.config.schemaEditor.removeItem', 'Remove item', 'Remove item')}
                  title={params.t('instances.detail.instanceWorkbench.config.schemaEditor.removeItem', 'Remove item', 'Remove item')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {renderNode({
                ...params,
                path: [...params.path, index],
                schema: itemsSchema,
                value: entry,
                showLabel: false,
                searchCriteria: childSearchCriteria,
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DynamicObjectEntries(params: RenderNodeParams) {
  const baseValue = isObjectRecord(params.value) ? params.value : {};
  const properties = params.schema.properties ?? {};
  const reservedKeys = new Set(Object.keys(properties));
  const dynamicEntries = Object.entries(baseValue)
    .filter(([entryKey]) => !reservedKeys.has(entryKey))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const entrySchema =
    params.schema.additionalProperties && typeof params.schema.additionalProperties === 'object'
      ? params.schema.additionalProperties
      : {};
  const anySchema = isAnySchema(entrySchema);
  const visibleEntries = params.searchCriteria
    ? dynamicEntries.filter(([entryKey, entryValue]) =>
        matchesConfigNodeSearch({
          schema: entrySchema,
          value: entryValue,
          path: [...params.path, entryKey],
          hints: params.uiHints,
          criteria: params.searchCriteria!,
        }),
      )
    : dynamicEntries;

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-zinc-200/80 px-4 py-4 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {params.t('instances.detail.instanceWorkbench.config.schemaEditor.customEntries', 'Custom entries', 'Custom entries')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {params.t('instances.detail.instanceWorkbench.config.schemaEditor.customEntriesDescription', 'Keys outside the fixed schema live here.', 'Keys outside the fixed schema live here.')}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextKey = createUniqueEntryKey(baseValue);
            params.onValueChange([...params.path, nextKey], defaultConfigValue(entrySchema));
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <Plus className="h-4 w-4" />
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.addEntry', 'Add entry', 'Add entry')}
        </button>
      </div>

      {dynamicEntries.length === 0 ? (
        <div className="rounded-xl bg-zinc-50/80 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesYet', 'No custom entries yet.', 'No custom entries yet.')}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-xl bg-zinc-50/80 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesMatchSearch', 'No custom entries match the current search.', 'No custom entries match the current search.')}
        </div>
      ) : (
        visibleEntries.map(([entryKey, entryValue]) => {
          const valuePath = [...params.path, entryKey];
          const entryMeta = resolveFieldMeta(valuePath, entrySchema, params.uiHints);

          return (
            <div
              key={entryKey}
              className="rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/55"
            >
              <div className="mb-3 flex items-center gap-2">
                <Input
                  type="text"
                  defaultValue={entryKey}
                  onBlur={(event) => {
                    params.onObjectEntryRename(params.path, entryKey, event.target.value);
                    event.target.value = event.target.value.trim() || entryKey;
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => params.onValueRemove(valuePath)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-rose-200 hover:text-rose-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-rose-500/30 dark:hover:text-rose-300"
                  title={params.t('instances.detail.instanceWorkbench.config.schemaEditor.removeEntry', 'Remove entry', 'Remove entry')}
                  aria-label={params.t('instances.detail.instanceWorkbench.config.schemaEditor.removeEntry', 'Remove entry', 'Remove entry')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {anySchema ? (
                <JsonTextareaField
                  path={valuePath}
                  schema={entrySchema}
                  value={entryValue}
                  meta={entryMeta}
                  uiHints={params.uiHints}
                  revealSensitive={params.revealSensitive}
                  isSensitivePathRevealed={params.isSensitivePathRevealed}
                  onToggleSensitivePath={params.onToggleSensitivePath}
                  onValueChange={params.onValueChange}
                  t={params.t}
                  showLabel={false}
                />
              ) : (
                renderNode({
                  ...params,
                  path: valuePath,
                  schema: entrySchema,
                  value: entryValue,
                  showLabel: false,
                  searchCriteria: params.searchCriteria,
                })
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ObjectField(params: RenderNodeParams & { meta: FieldMeta }) {
  const showLabel = params.showLabel ?? true;
  const properties = params.schema.properties ?? {};
  const propertyEntries = Object.entries(properties).sort((a, b) => {
    const orderA = hintForPath([...params.path, a[0]], params.uiHints)?.order ?? 50;
    const orderB = hintForPath([...params.path, b[0]], params.uiHints)?.order ?? 50;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a[0].localeCompare(b[0]);
  });
  const selfMatched =
    params.searchCriteria &&
    matchesConfigNodeSelf({
      schema: params.schema,
      path: params.path,
      hints: params.uiHints,
      criteria: params.searchCriteria,
    });
  const childSearchCriteria = selfMatched ? undefined : params.searchCriteria;

  const fields = (
    <div className="space-y-3">
      {propertyEntries.map(([entryKey, entrySchema]) => (
        <div key={entryKey}>
          {renderNode({
            ...params,
            path: [...params.path, entryKey],
            schema: entrySchema,
            value: isObjectRecord(params.value) ? params.value[entryKey] : undefined,
            searchCriteria: childSearchCriteria,
          })}
        </div>
      ))}
      {params.schema.additionalProperties && typeof params.schema.additionalProperties === 'object' ? (
        <DynamicObjectEntries {...params} searchCriteria={childSearchCriteria} />
      ) : null}
      {propertyEntries.length === 0 &&
      !(params.schema.additionalProperties && typeof params.schema.additionalProperties === 'object') ? (
        <div className="rounded-xl border border-dashed border-zinc-200/80 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.noConfiguredFieldsYet', 'No configured fields in this object yet.', 'No configured fields in this object yet.')}
        </div>
      ) : null}
    </div>
  );

  if (params.path.length === 1) {
    return fields;
  }

  if (!showLabel) {
    return <div className="space-y-3">{fields}</div>;
  }

  return (
    <details
      open={params.path.length <= 2}
      className="rounded-[1.6rem] border border-zinc-200/70 bg-white/85 dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{params.meta.label}</div>
          {params.meta.help ? (
            <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{params.meta.help}</div>
          ) : null}
          {renderTags(params.meta.tags)}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </summary>
      <div className="border-t border-zinc-200/70 px-5 py-4 dark:border-zinc-800">{fields}</div>
    </details>
  );
}

function renderNode(params: RenderNodeParams): React.ReactNode {
  const key = pathKey(params.path);
  const meta = resolveFieldMeta(params.path, params.schema, params.uiHints);
  const type =
    schemaType(params.schema) ?? (params.schema.properties || params.schema.additionalProperties ? 'object' : undefined);

  if (
    params.searchCriteria &&
    !matchesConfigNodeSearch({
      schema: params.schema,
      value: params.value,
      path: params.path,
      hints: params.uiHints,
      criteria: params.searchCriteria,
    })
  ) {
    return null;
  }

  if (params.unsupportedPaths.has(key)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <div className="font-medium">{meta.label}</div>
        <div className="mt-1">
          {params.t('instances.detail.instanceWorkbench.config.schemaEditor.saferInRawMode', 'This schema shape is safer to edit in Raw mode.', 'This schema shape is safer to edit in Raw mode.')}
        </div>
      </div>
    );
  }

  if (type === 'object') {
    return <ObjectField {...params} meta={meta} />;
  }

  if (type === 'array') {
    return <ArrayField {...params} meta={meta} />;
  }

  if (
    params.schema.anyOf ||
    params.schema.oneOf ||
    params.schema.allOf ||
    (type !== 'string' &&
      type !== 'number' &&
      type !== 'integer' &&
      type !== 'boolean' &&
      !Array.isArray(params.schema.enum))
  ) {
    return (
      <JsonTextareaField
        path={params.path}
        schema={params.schema}
        value={params.value}
        meta={meta}
        uiHints={params.uiHints}
        revealSensitive={params.revealSensitive}
        isSensitivePathRevealed={params.isSensitivePathRevealed}
        onToggleSensitivePath={params.onToggleSensitivePath}
        onValueChange={params.onValueChange}
        t={params.t}
        showLabel={params.showLabel}
      />
    );
  }

  return <ScalarField {...params} meta={meta} />;
}

export function InstanceConfigSchemaSectionEditor(props: InstanceConfigSchemaSectionEditorProps) {
  const analysis = analyzeConfigSchema(props.schema);
  const rootSchema = analysis.schema;
  const sectionSchema = rootSchema?.properties?.[props.activeSectionKey];
  const [revealedPaths, setRevealedPaths] = useState<Set<string>>(new Set());
  const searchCriteria = parseConfigSearchQuery(props.searchQuery ?? '');

  useEffect(() => {
    setRevealedPaths(new Set());
  }, [props.activeSectionKey]);

  if (!rootSchema || !sectionSchema) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
      {props.t('instances.detail.instanceWorkbench.config.schemaEditor.schemaUnavailable', 'Config schema is unavailable for this section.', 'Config schema is unavailable for this section.')}
    </div>
  );
}

if (!props.rootValue) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
      {props.t('instances.detail.instanceWorkbench.config.schemaEditor.invalidDraftForConfigMode', 'The current draft must be valid JSON5 before Config mode can edit it.', 'The current draft must be valid JSON5 before Config mode can edit it.')}
    </div>
  );
}

const unsupportedPaths = new Set(analysis.unsupportedPaths);
const sectionValue = props.rootValue[props.activeSectionKey];
const sectionSensitiveCount = countSensitiveConfigValues(
  sectionValue,
  [props.activeSectionKey],
  props.uiHints,
);

const commitRoot = (producer: (draft: Record<string, unknown>) => void) => {
  const next = cloneConfigObject(props.rootValue) ?? {};
  producer(next);
  const coerced = coerceFormValues(next, rootSchema) as Record<string, unknown>;
  props.onRootValueChange(coerced);
};

const handleValueChange = (path: Array<string | number>, value: unknown) => {
  commitRoot((draft) => {
    if (value === undefined) {
      removePathValue(draft, path);
      return;
    }
    setPathValue(draft, path, value);
  });
};

const handleValueRemove = (path: Array<string | number>) => {
  commitRoot((draft) => {
    removePathValue(draft, path);
  });
};

const handleObjectEntryRename = (
  path: Array<string | number>,
  fromKey: string,
  toKey: string,
) => {
  if (fromKey.trim() === toKey.trim()) {
    return;
  }
  commitRoot((draft) => {
    renameObjectEntry(draft, path, fromKey, toKey);
  });
};

const handleToggleSensitivePath = (path: Array<string | number>) => {
  const key = pathKey(path);
  setRevealedPaths((current) => {
    const next = new Set(current);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
};

return (
  <div className="space-y-4">
    {analysis.unsupportedPaths.length > 0 ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        {props.t('instances.detail.instanceWorkbench.config.schemaEditor.dynamicPathsUseRawMode', 'Some schema paths are too dynamic for the structured editor and are safer to edit in Raw mode.', 'Some schema paths are too dynamic for the structured editor and are safer to edit in Raw mode.')}
      </div>
    ) : null}

    {sectionSensitiveCount > 0 && !props.revealSensitive ? (
      <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
        {props.t('instances.detail.instanceWorkbench.config.schemaEditor.hiddenSensitiveValues', '{{count}} sensitive values are hidden in this section. Use reveal controls to inspect them.', '{{count}} sensitive values are hidden in this section. Use reveal controls to inspect them.', { count: sectionSensitiveCount })}
      </div>
    ) : null}

    {renderNode({
      path: [props.activeSectionKey],
      schema: sectionSchema,
      value: sectionValue,
      uiHints: props.uiHints,
      unsupportedPaths,
      revealSensitive: Boolean(props.revealSensitive),
      isSensitivePathRevealed: (path) => revealedPaths.has(pathKey(path)),
      onToggleSensitivePath: handleToggleSensitivePath,
      onValueChange: handleValueChange,
      onValueRemove: handleValueRemove,
      onObjectEntryRename: handleObjectEntryRename,
      t: props.t,
      searchCriteria,
    }) ?? (
      <div className="rounded-[1.6rem] border border-dashed border-zinc-300/80 bg-zinc-50/70 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
        {props.searchQuery
          ? props.t('instances.detail.instanceWorkbench.config.schemaEditor.noSettingsMatchSearch', 'No settings in this section match the current search.', 'No settings in this section match the current search.')
          : props.t('instances.detail.instanceWorkbench.config.schemaEditor.noSettingsAvailable', 'No settings are available for this section.', 'No settings are available for this section.')}
      </div>
    )}
  </div>
);
}




