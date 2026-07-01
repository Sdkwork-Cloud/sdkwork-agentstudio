import type { Dispatch, SetStateAction } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  PencilLine,
  Plus,
  Power,
  Route,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Label,
  OverlaySurface,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@sdkwork/claw-ui';
import {
  appendProviderConfigModelRow,
  applyProviderConfigFormBaseUrlInput,
  applyProviderConfigFormClientProtocolInput,
  applyProviderConfigFormProviderIdInput,
  applyProviderConfigFormUpstreamProtocolInput,
  createProviderConfigBadgeLabel,
  findProviderConfigKnownProviderOption,
  listProviderConfigModelRows,
  listProviderConfigModelSelectionOptions,
  moveProviderConfigModelRow,
  matchProviderConfigCustomRouteSearch,
  matchProviderConfigKnownProviderSearch,
  providerConfigClientProtocolOptions,
  providerConfigUpstreamProtocolOptions,
  removeProviderConfigModelRow,
  updateProviderConfigModelRow,
  type ProviderConfigFormState,
  type ProviderConfigKnownProviderOption,
  type ProviderConfigPreset,
} from './services/index.ts';

const CUSTOM_PROVIDER_OPTION_VALUE = '__custom__';
const UNSET_MODEL_OPTION_VALUE = '__unset_model__';

export interface ProviderConfigEditorSheetProps {
  open: boolean;
  mode: 'view' | 'edit';
  draft: ProviderConfigFormState;
  presets: readonly ProviderConfigPreset[];
  knownProviderOptions: readonly ProviderConfigKnownProviderOption[];
  providerSearchQuery: string;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: () => void;
  onProviderSearchQueryChange: (value: string) => void;
  onDraftChange: Dispatch<SetStateAction<ProviderConfigFormState>>;
  onSelectPreset: (presetId: string) => void;
  onSave: () => void;
}

export function ProviderConfigEditorSheet({
  open,
  mode,
  draft,
  presets,
  knownProviderOptions,
  providerSearchQuery,
  isSaving,
  onOpenChange,
  onEditRequest,
  onProviderSearchQueryChange,
  onDraftChange,
  onSelectPreset,
  onSave,
}: ProviderConfigEditorSheetProps) {
  const { t } = useTranslation();
  const isReadOnly = mode === 'view' || draft.managedBy !== 'user';
  const selectedKnownProvider = findProviderConfigKnownProviderOption(draft.providerId, presets);
  const activeProviderSelectionId = selectedKnownProvider?.id || CUSTOM_PROVIDER_OPTION_VALUE;
  const customRouteLabel = t('providerCenter.dialogs.editor.customRoute');
  const customRouteHint = t('providerCenter.dialogs.editor.customRouteHint');
  const selectedProviderLabel = selectedKnownProvider?.label || customRouteLabel;
  const selectedProviderDescription =
    selectedKnownProvider?.description || t('providerCenter.dialogs.editor.selectedProviderHint');
  const selectedProviderVendor = selectedKnownProvider?.vendor || t('providerCenter.states.notSet');
  const selectedProviderModelFamily =
    selectedKnownProvider?.modelFamily || t('providerCenter.states.notSet');
  const filteredProviderOptions = knownProviderOptions.filter((option) =>
    matchProviderConfigKnownProviderSearch(providerSearchQuery, option),
  );
  const showCustomRouteOption = matchProviderConfigCustomRouteSearch(
    providerSearchQuery,
    customRouteLabel,
    customRouteHint,
  );
  const modelRows = listProviderConfigModelRows(draft);
  const modelSelectionOptions = listProviderConfigModelSelectionOptions(draft);
  const selectableModelIds = new Set(modelSelectionOptions.map((model) => model.id));
  const headerTitle =
    mode === 'view'
      ? draft.name.trim() || selectedProviderLabel
      : draft.id
        ? t('providerCenter.dialogs.editor.editTitle')
        : t('providerCenter.dialogs.editor.createTitle');
  const canEditFromView = mode === 'view' && draft.managedBy === 'user' && typeof onEditRequest === 'function';

  return (
    <OverlaySurface
      isOpen={open}
      onClose={() => onOpenChange(false)}
      variant="drawer"
      drawerSide="left"
      className="w-full max-w-[1360px] self-stretch gap-0 rounded-[0_28px_28px_0] border-y-0 border-l-0 border-r border-zinc-200/80 shadow-[0_36px_120px_-52px_rgba(15,23,42,0.7)] dark:border-zinc-800"
    >
        <div className="flex h-full min-h-0 flex-col bg-white dark:bg-zinc-950" data-slot="provider-center-editor-shell">
          <div className="border-b border-zinc-200/80 px-5 py-4 dark:border-zinc-800 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                  <Route className="h-3.5 w-3.5" />
                  {t('providerCenter.page.eyebrow')}
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {headerTitle}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.dialogs.editor.description')}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} aria-label={t('common.close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside
              className="flex min-h-0 flex-col border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/70 lg:border-b-0 lg:border-r"
              data-slot="provider-center-provider-sidebar"
            >
              <div className="border-b border-zinc-200/80 px-5 py-5 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {t('providerCenter.dialogs.editor.sidebarTitle')}
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.dialogs.editor.sidebarDescription')}
                </p>
                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <Input
                    value={providerSearchQuery}
                    onChange={(event) => onProviderSearchQueryChange(event.target.value)}
                    placeholder={t('providerCenter.dialogs.editor.sidebarSearchPlaceholder')}
                    className="pl-9"
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="space-y-1.5">
                  {filteredProviderOptions.length > 0 ? (
                    filteredProviderOptions.map((option) => {
                      const isActive = activeProviderSelectionId === option.id;
                      const badgeLabel = createProviderConfigBadgeLabel(
                        option.label,
                        option.providerId,
                      );
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => onSelectPreset(option.id)}
                          disabled={isReadOnly}
                          className={`flex w-full items-center gap-3 rounded-[20px] border px-3 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-500/40 dark:bg-primary-500/10'
                              : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                          } ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.14em] ${
                              isActive
                                ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-zinc-950'
                                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            {badgeLabel}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {option.label}
                            </div>
                          </div>
                          {isActive ? (
                            <Check className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                      {t('providerCenter.dialogs.editor.emptyProviderSearch')}
                    </div>
                  )}
                </div>

                {showCustomRouteOption ? (
                  <div className="mt-4 border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onSelectPreset(CUSTOM_PROVIDER_OPTION_VALUE)}
                      disabled={isReadOnly}
                      className={`flex w-full items-center gap-3 rounded-[20px] border px-3 py-2.5 text-left transition-colors ${
                        activeProviderSelectionId === CUSTOM_PROVIDER_OPTION_VALUE
                          ? 'border-primary-300 bg-primary-50 shadow-sm dark:border-primary-500/40 dark:bg-primary-500/10'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                      } ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                          activeProviderSelectionId === CUSTOM_PROVIDER_OPTION_VALUE
                            ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-zinc-950'
                            : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <Route className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {customRouteLabel}
                        </div>
                      </div>
                      {activeProviderSelectionId === CUSTOM_PROVIDER_OPTION_VALUE ? (
                        <Check className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                      ) : null}
                    </button>
                  </div>
                ) : null}
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-950/80">
              <div className="flex w-full flex-col gap-6 p-5 md:p-6 xl:p-8">
                <section
                  data-slot="provider-center-route-hero"
                  className="relative overflow-hidden rounded-[32px] border border-zinc-200/80 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))]"
                >
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10" />
                  <div className="relative flex flex-col gap-6 p-6 xl:p-7">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_360px] xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                            <Route className="h-3.5 w-3.5" />
                            {t('providerCenter.dialogs.editor.selectedProvider')}
                          </span>
                          {draft.providerId.trim() ? (
                            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
                              {draft.providerId}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-4 text-[1.75rem] font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                          {draft.name.trim() || selectedProviderLabel}
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          {selectedProviderDescription}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="inline-flex max-w-full items-center rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-300">
                            {draft.baseUrl || t('providerCenter.states.notSet')}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/85 dark:text-zinc-300">
                            {modelRows.length} {t('providerCenter.dialogs.editor.models')}
                          </span>
                        </div>
                      </div>

                      <div data-slot="provider-center-route-status" className="grid gap-3">
                        <div className="flex items-start justify-between gap-3 rounded-[26px] border border-emerald-200/80 bg-white/90 px-4 py-4 shadow-sm dark:border-emerald-500/20 dark:bg-zinc-900/90">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              <Power className="h-4 w-4 text-emerald-500" />
                              {t('providerCenter.dialogs.editor.enabled')}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.editor.enabledHint')}
                            </div>
                          </div>
                          <Switch
                            checked={draft.enabled}
                            disabled={isReadOnly}
                            onCheckedChange={(checked) =>
                              onDraftChange((current) => ({
                                ...current,
                                enabled: checked === true,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-start justify-between gap-3 rounded-[26px] border border-sky-200/80 bg-white/90 px-4 py-4 shadow-sm dark:border-sky-500/20 dark:bg-zinc-900/90">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              <BadgeCheck className="h-4 w-4 text-sky-500" />
                              {t('providerCenter.dialogs.editor.defaultRoute')}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.editor.defaultRouteHint')}
                            </div>
                          </div>
                          <Switch
                            checked={draft.isDefault}
                            disabled={isReadOnly}
                            onCheckedChange={(checked) =>
                              onDraftChange((current) => ({
                                ...current,
                                isDefault: checked === true,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[24px] border border-zinc-200/80 bg-white/88 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.providerVendor')}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {selectedProviderVendor}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-zinc-200/80 bg-white/88 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.modelFamily')}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {selectedProviderModelFamily}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-zinc-200/80 bg-white/88 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.clientProtocol')}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {draft.clientProtocol || t('providerCenter.states.notSet')}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-zinc-200/80 bg-white/88 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.upstreamProtocol')}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                          {draft.upstreamProtocol || t('providerCenter.states.notSet')}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.38fr)_minmax(320px,0.92fr)]">
                  <div className="space-y-6">
                    <section
                      data-slot="provider-center-access-form"
                      className="rounded-[30px] border border-zinc-200/80 bg-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="border-b border-zinc-200/80 pb-5 dark:border-zinc-800">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {t('providerCenter.dialogs.editor.accessTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.accessDescription')}
                        </p>
                      </div>

                      <div className="mt-6 grid gap-5 xl:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.name')}</Label>
                          <Input
                            value={draft.name}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({ ...current, name: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.providerId')}</Label>
                          <Input
                            value={draft.providerId}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) =>
                                applyProviderConfigFormProviderIdInput(
                                  current,
                                  event.target.value,
                                  presets,
                                ),
                              )
                            }
                          />
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.providerIdHint')}
                          </p>
                        </div>
                        <div className="space-y-2 xl:col-span-2">
                          <Label>{t('providerCenter.dialogs.editor.baseUrl')}</Label>
                          <Input
                            value={draft.baseUrl}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) =>
                                applyProviderConfigFormBaseUrlInput(current, event.target.value),
                              )
                            }
                          />
                        </div>
                        {!isReadOnly ? (
                          <div className="space-y-2 xl:col-span-2">
                            <Label>{t('providerCenter.dialogs.editor.apiKey')}</Label>
                            <Input
                              type="password"
                              value={draft.apiKey}
                              onChange={(event) =>
                                onDraftChange((current) => ({ ...current, apiKey: event.target.value }))
                              }
                            />
                          </div>
                        ) : null}
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.clientProtocol')}</Label>
                          <Select
                            value={draft.clientProtocol}
                            onValueChange={(value) =>
                              onDraftChange((current) =>
                                applyProviderConfigFormClientProtocolInput(current, value),
                              )
                            }
                            disabled={isReadOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('providerCenter.dialogs.editor.clientProtocol')} />
                            </SelectTrigger>
                            <SelectContent>
                              {providerConfigClientProtocolOptions.map((protocol) => (
                                <SelectItem key={protocol} value={protocol}>
                                  {protocol}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.upstreamProtocol')}</Label>
                          <Select
                            value={draft.upstreamProtocol}
                            onValueChange={(value) =>
                              onDraftChange((current) =>
                                applyProviderConfigFormUpstreamProtocolInput(current, value),
                              )
                            }
                            disabled={isReadOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('providerCenter.dialogs.editor.upstreamProtocol')} />
                            </SelectTrigger>
                            <SelectContent>
                              {providerConfigUpstreamProtocolOptions.map((protocol) => (
                                <SelectItem key={protocol} value={protocol}>
                                  {protocol}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-6 rounded-[24px] border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.notes')}</Label>
                          <Textarea
                            rows={4}
                            value={draft.notes}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({ ...current, notes: event.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </section>

                    <section
                      className="rounded-[28px] border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                      data-slot="provider-center-model-list"
                    >
                      <div className="flex flex-col gap-3 border-b border-zinc-200/80 pb-5 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                            {t('providerCenter.dialogs.editor.models')}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.modelsSectionDescription')}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => onDraftChange((current) => appendProviderConfigModelRow(current))}
                          disabled={isReadOnly}
                        >
                          <Plus className="h-4 w-4" />
                          {t('providerCenter.dialogs.editor.addModel')}
                        </Button>
                      </div>

                      <div className="mt-5 space-y-3">
                        {modelRows.length > 0 ? (
                          <div className="overflow-hidden rounded-[24px] border border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/70">
                            <div
                              data-slot="provider-center-model-list-header"
                              className="grid gap-3 border-b border-zinc-200/80 bg-zinc-100/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_112px]"
                            >
                              <div>{t('providerCenter.dialogs.editor.modelId')}</div>
                              <div>{t('providerCenter.dialogs.editor.modelName')}</div>
                              <div className="text-right">{t('providerCenter.table.actions')}</div>
                            </div>

                            <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                              {modelRows.map((model, index) => (
                                <div
                                  key={`provider-model-row-${index}`}
                                  data-slot="provider-center-model-list-row"
                                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_112px] md:items-center"
                                >
                                  <Input
                                    value={model.id}
                                    placeholder={t('providerCenter.dialogs.editor.modelIdPlaceholder')}
                                    className="h-9 rounded-lg bg-white shadow-none dark:bg-zinc-950"
                                    disabled={isReadOnly}
                                    onChange={(event) =>
                                      onDraftChange((current) =>
                                        updateProviderConfigModelRow(current, index, {
                                          id: event.target.value,
                                        }),
                                      )
                                    }
                                  />
                                  <Input
                                    value={model.name}
                                    placeholder={t('providerCenter.dialogs.editor.modelNamePlaceholder')}
                                    className="h-9 rounded-lg bg-white shadow-none dark:bg-zinc-950"
                                    disabled={isReadOnly}
                                    onChange={(event) =>
                                      onDraftChange((current) =>
                                        updateProviderConfigModelRow(current, index, {
                                          name: event.target.value,
                                        }),
                                      )
                                    }
                                  />
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        onDraftChange((current) =>
                                          moveProviderConfigModelRow(current, index, 'up'),
                                        )
                                      }
                                      disabled={isReadOnly || index === 0}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        onDraftChange((current) =>
                                          moveProviderConfigModelRow(current, index, 'down'),
                                        )
                                      }
                                      disabled={isReadOnly || index === modelRows.length - 1}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        onDraftChange((current) =>
                                          removeProviderConfigModelRow(current, index),
                                        )
                                      }
                                      disabled={isReadOnly}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
                            <div className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                              {t('providerCenter.dialogs.editor.modelListEmptyTitle')}
                            </div>
                            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.editor.modelListEmptyDescription')}
                            </p>
                            <Button
                              className="mt-4"
                              variant="outline"
                              onClick={() =>
                                onDraftChange((current) => appendProviderConfigModelRow(current))
                              }
                              disabled={isReadOnly}
                            >
                              <Plus className="h-4 w-4" />
                              {t('providerCenter.dialogs.editor.addModel')}
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.modelsHint')}
                        </p>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-[30px] border border-zinc-200/80 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-5">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {t('providerCenter.dialogs.editor.selectedProvider')}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {selectedProviderDescription}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.providerId')}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {draft.providerId || t('providerCenter.states.notSet')}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.baseUrl')}
                          </div>
                          <div className="mt-2 break-all text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {draft.baseUrl || t('providerCenter.states.notSet')}
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                              {t('providerCenter.dialogs.editor.models')}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {modelRows.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[30px] border border-zinc-200/80 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-5">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {t('providerCenter.dialogs.editor.selectionTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.selectionDescription')}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.defaultModel')}</Label>
                          <Select
                            value={
                              draft.defaultModelId && selectableModelIds.has(draft.defaultModelId)
                                ? draft.defaultModelId
                                : UNSET_MODEL_OPTION_VALUE
                            }
                            onValueChange={(value) =>
                              onDraftChange((current) => ({
                                ...current,
                                defaultModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                              }))
                            }
                            disabled={isReadOnly || modelSelectionOptions.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('providerCenter.states.notSet')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                                {t('providerCenter.states.notSet')}
                              </SelectItem>
                              {modelSelectionOptions.map((model) => (
                                <SelectItem key={`default-${model.id}`} value={model.id}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.reasoningModel')}</Label>
                          <Select
                            value={
                              draft.reasoningModelId && selectableModelIds.has(draft.reasoningModelId)
                                ? draft.reasoningModelId
                                : UNSET_MODEL_OPTION_VALUE
                            }
                            onValueChange={(value) =>
                              onDraftChange((current) => ({
                                ...current,
                                reasoningModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                              }))
                            }
                            disabled={isReadOnly || modelSelectionOptions.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('providerCenter.states.notSet')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                                {t('providerCenter.states.notSet')}
                              </SelectItem>
                              {modelSelectionOptions.map((model) => (
                                <SelectItem key={`reasoning-${model.id}`} value={model.id}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.embeddingModel')}</Label>
                          <Select
                            value={
                              draft.embeddingModelId && selectableModelIds.has(draft.embeddingModelId)
                                ? draft.embeddingModelId
                                : UNSET_MODEL_OPTION_VALUE
                            }
                            onValueChange={(value) =>
                              onDraftChange((current) => ({
                                ...current,
                                embeddingModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                              }))
                            }
                            disabled={isReadOnly || modelSelectionOptions.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('providerCenter.states.notSet')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                                {t('providerCenter.states.notSet')}
                              </SelectItem>
                              {modelSelectionOptions.map((model) => (
                                <SelectItem key={`embedding-${model.id}`} value={model.id}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[30px] border border-zinc-200/80 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="mb-5">
                        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {t('providerCenter.dialogs.editor.runtimeTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {t('providerCenter.dialogs.editor.runtimeDescription')}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.temperature')}</Label>
                          <Input
                            value={draft.temperature}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({
                                ...current,
                                temperature: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.topP')}</Label>
                          <Input
                            value={draft.topP}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({ ...current, topP: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.maxTokens')}</Label>
                          <Input
                            value={draft.maxTokens}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({
                                ...current,
                                maxTokens: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.timeoutMs')}</Label>
                          <Input
                            value={draft.timeoutMs}
                            disabled={isReadOnly}
                            onChange={(event) =>
                              onDraftChange((current) => ({
                                ...current,
                                timeoutMs: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 rounded-[24px] border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                        <div>
                          <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                            {t('providerCenter.dialogs.editor.streaming')}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.streamingHint')}
                          </div>
                        </div>
                        <Switch
                          checked={draft.streaming}
                          disabled={isReadOnly}
                          onCheckedChange={(checked) =>
                            onDraftChange((current) => ({
                              ...current,
                              streaming: checked === true,
                            }))
                          }
                        />
                      </div>

                      <div
                        className="mt-4 rounded-[24px] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80"
                        data-slot="provider-center-request-overrides"
                      >
                        <div>
                          <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                            {t('providerCenter.dialogs.editor.requestOverridesTitle')}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.requestOverridesDescription')}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <Label>{t('providerCenter.dialogs.editor.requestOverrides')}</Label>
                          <Textarea
                            value={draft.requestOverridesDraft}
                            disabled={isReadOnly}
                            placeholder={t('providerCenter.dialogs.editor.requestOverridesPlaceholder')}
                            className="min-h-[220px] resize-y bg-white font-mono text-xs leading-6 shadow-none dark:bg-zinc-950"
                            onChange={(event) =>
                              onDraftChange((current) => ({
                                ...current,
                                requestOverridesDraft: event.target.value,
                              }))
                            }
                          />
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('providerCenter.dialogs.editor.requestOverridesHint')}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200/80 bg-white/95 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/95 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                {t('providerCenter.actions.cancel')}
              </Button>
              {canEditFromView ? (
                <Button variant="outline" onClick={() => onEditRequest?.()} disabled={isSaving}>
                  <PencilLine className="h-4 w-4" />
                  {t('providerCenter.actions.edit')}
                </Button>
              ) : null}
              {!isReadOnly ? (
                <Button onClick={onSave} disabled={isSaving}>
                  <Save className="h-4 w-4" />
                  {draft.id
                    ? t('providerCenter.actions.saveChanges')
                    : t('providerCenter.actions.createConfig')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
    </OverlaySurface>
  );
}
