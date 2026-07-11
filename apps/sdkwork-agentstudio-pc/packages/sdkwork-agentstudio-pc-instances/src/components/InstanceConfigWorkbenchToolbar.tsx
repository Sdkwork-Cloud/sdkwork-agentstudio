import React from 'react';
import {
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { getInstanceConfigWorkbenchModes, type InstanceConfigWorkbenchModeId } from '../services';
import { InstanceConfigWorkbenchStatusChip } from './InstanceConfigWorkbenchStatusChip.tsx';

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

interface InstanceConfigWorkbenchToolbarProps {
  tr: Translate;
  activeMode: InstanceConfigWorkbenchModeId;
  onModeChange: (mode: InstanceConfigWorkbenchModeId) => void;
  configFile: string | null;
  isWritable: boolean;
  hasPendingChanges: boolean;
  schemaVersion?: string | null;
  unsupportedSchemaPathCount: number;
  isLoading: boolean;
  schemaLoading: boolean;
  isSaving: boolean;
  isApplying: boolean;
  isUpdating: boolean;
  hasParseError: boolean;
  onOpenConfigFile: () => void;
  onReload: () => void;
  onRevert: () => void;
  onSave: () => void;
  onApply: () => void;
  onUpdate: () => void;
}

export function InstanceConfigWorkbenchToolbar(
  props: InstanceConfigWorkbenchToolbarProps,
) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-2xl border border-zinc-200/70 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/80">
        {getInstanceConfigWorkbenchModes().map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => props.onModeChange(mode.id)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              props.activeMode === mode.id
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {mode.id === 'config'
              ? props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.toolbar.tabs.config',
                  'Config',
                  'Config',
                )
              : props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.toolbar.tabs.raw',
                  'Raw',
                  'Raw',
                )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InstanceConfigWorkbenchStatusChip>
          {props.configFile || 'openclaw.json'}
        </InstanceConfigWorkbenchStatusChip>
        <InstanceConfigWorkbenchStatusChip
          tone={
            props.isWritable
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : undefined
          }
        >
          {props.isWritable
            ? props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.writable',
                'Writable',
                'Writable',
              )
            : props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.readOnly',
                'Read Only',
                'Read Only',
              )}
        </InstanceConfigWorkbenchStatusChip>
        <InstanceConfigWorkbenchStatusChip
          tone={
            props.hasPendingChanges
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : undefined
          }
        >
          {props.hasPendingChanges
            ? props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.unsavedChanges',
                'Unsaved changes',
                'Unsaved changes',
              )
            : props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.noChanges',
                'No changes',
                'No changes',
              )}
        </InstanceConfigWorkbenchStatusChip>
        {props.schemaVersion ? (
          <InstanceConfigWorkbenchStatusChip>
            {props.schemaVersion}
          </InstanceConfigWorkbenchStatusChip>
        ) : null}
        {props.unsupportedSchemaPathCount > 0 ? (
          <InstanceConfigWorkbenchStatusChip tone="bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {props.tr(
              'instances.detail.instanceWorkbench.config.workbench.toolbar.rawOnlyPaths',
              'Raw-only paths: {{count}}',
              'Raw-only paths: {{count}}',
              {
                count: props.unsupportedSchemaPathCount,
              },
            )}
          </InstanceConfigWorkbenchStatusChip>
        ) : null}
        <button
          type="button"
          onClick={props.onOpenConfigFile}
          disabled={!props.configFile || props.isLoading || props.schemaLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <FolderOpen className="h-4 w-4" />
          {props.tr(
            'instances.detail.instanceWorkbench.config.workbench.toolbar.open',
            'Open',
            'Open',
          )}
        </button>
        <button
          type="button"
          onClick={props.onReload}
          disabled={props.isLoading || props.schemaLoading || props.isApplying || props.isUpdating}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {props.isLoading || props.schemaLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {props.tr(
            'instances.detail.instanceWorkbench.config.workbench.toolbar.reload',
            'Reload',
            'Reload',
          )}
        </button>
        <button
          type="button"
          onClick={props.onRevert}
          disabled={!props.hasPendingChanges || props.isSaving || props.isApplying || props.isUpdating}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <RotateCcw className="h-4 w-4" />
          {props.tr(
            'instances.detail.instanceWorkbench.config.workbench.toolbar.revert',
            'Revert',
            'Revert',
          )}
        </button>
        <button
          type="button"
          onClick={props.onSave}
          disabled={
            !props.isWritable ||
            !props.hasPendingChanges ||
            props.hasParseError ||
            props.isSaving ||
            props.isApplying ||
            props.isUpdating
          }
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {props.isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {props.isSaving
            ? props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.saving',
                'Saving...',
                'Saving...',
              )
            : props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.save',
                'Save',
                'Save',
              )}
        </button>
        <button
          type="button"
          onClick={props.onApply}
          disabled={
            !props.isWritable ||
            !props.hasPendingChanges ||
            props.hasParseError ||
            props.isSaving ||
            props.isApplying ||
            props.isUpdating
          }
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {props.isApplying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {props.isApplying
            ? props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.applying',
                'Applying...',
                'Applying...',
              )
            : props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.apply',
                'Apply',
                'Apply',
              )}
        </button>
        <button
          type="button"
          onClick={props.onUpdate}
          disabled={props.isLoading || props.isSaving || props.isApplying || props.isUpdating}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {props.isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {props.isUpdating
            ? props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.updating',
                'Updating...',
                'Updating...',
              )
            : props.tr(
                'instances.detail.instanceWorkbench.config.workbench.toolbar.update',
                'Update',
                'Update',
              )}
        </button>
      </div>
    </div>
  );
}
