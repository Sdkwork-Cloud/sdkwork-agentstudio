import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import {
  appendProviderConfigModelRow,
  createProviderConfigDraftFromForm,
  createProviderConfigFormState,
  listProviderConfigModelRoles,
  listProviderConfigModelRows,
  listProviderConfigModelSelectionOptions,
  moveProviderConfigModelRow,
  removeProviderConfigModelRow,
  updateProviderConfigModelRow,
  type ProviderConfigDraft,
  type ProviderConfigRecord,
  type ProviderConfigFormState,
} from './services/index.ts';

const UNSET_MODEL_OPTION_VALUE = '__unset_model__';

interface ProviderRouteDetailDialogProps {
  open: boolean;
  record: ProviderConfigRecord | null;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: (record: ProviderConfigRecord) => void;
  onSaveRequest?: (draft: ProviderConfigDraft & { id?: string }) => Promise<ProviderConfigRecord>;
}

export function ProviderRouteDetailDialog({
  open,
  record,
  onOpenChange,
  onEditRequest,
  onSaveRequest,
}: ProviderRouteDetailDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProviderConfigFormState>(() =>
    createProviderConfigFormState(record || undefined),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(createProviderConfigFormState(record || undefined));
  }, [open, record?.id]);

  const isEditable = record?.managedBy === 'user' && typeof onSaveRequest === 'function';
  const modelRows = useMemo(() => listProviderConfigModelRows(draft), [draft]);
  const modelSelectionOptions = useMemo(
    () => listProviderConfigModelSelectionOptions(draft),
    [draft],
  );
  const selectableModelIds = useMemo(
    () => new Set(modelSelectionOptions.map((model) => model.id)),
    [modelSelectionOptions],
  );
  const hasAtLeastOneModel = modelRows.some((model) => model.id.trim());
  const canSave = isEditable && hasAtLeastOneModel && Boolean(draft.defaultModelId.trim()) && !isSaving;

  const handleSave = async () => {
    if (!record || !onSaveRequest || !isEditable) {
      return;
    }

    setIsSaving(true);
    try {
      const savedRecord = await onSaveRequest(createProviderConfigDraftFromForm(draft));
      setDraft(createProviderConfigFormState(savedRecord));
      toast.success(t('providerCenter.toasts.saved'));
    } catch (error: any) {
      toast.error(error?.message || t('providerCenter.toasts.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open && Boolean(record)} onOpenChange={onOpenChange}>
      {record ? (
        <DialogContent
          className="max-h-[88vh] max-w-6xl overflow-y-auto"
          data-slot="provider-center-route-detail-dialog"
        >
          <DialogHeader>
            <DialogTitle>{record.name}</DialogTitle>
            <DialogDescription>
              {record.providerId}
              {' | '}
              {record.clientProtocol}
              {' -> '}
              {record.upstreamProtocol}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <section className="space-y-4">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.table.endpoint')}
                </div>
                <div className="mt-2 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {record.baseUrl || t('providerCenter.states.notSet')}
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.dialogs.editor.notes')}
                </div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {record.notes || t('providerCenter.states.noNotes')}
                </div>
              </div>

              <div
                className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                data-slot="provider-center-route-model-editor"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.dialogs.editor.models')}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {modelRows.filter((model) => model.id.trim()).length} {t('providerCenter.table.models')}
                    </div>
                  </div>
                  {isEditable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft((current) => appendProviderConfigModelRow(current))}
                    >
                      <Plus className="h-4 w-4" />
                      {t('providerCenter.dialogs.editor.addModel')}
                    </Button>
                  ) : null}
                </div>

                {modelRows.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-[20px] border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-sm" data-slot="provider-center-route-model-list">
                      <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">{t('providerCenter.dialogs.editor.modelId')}</th>
                          <th className="px-4 py-3">{t('providerCenter.dialogs.editor.modelName')}</th>
                          <th className="px-4 py-3">{t('providerCenter.table.selection')}</th>
                          {isEditable ? <th className="w-[140px] px-4 py-3 text-right">{t('providerCenter.table.actions')}</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {modelRows.map((model, index) => {
                          const roles = listProviderConfigModelRoles(draft, model.id.trim(), {
                            defaultModel: t('providerCenter.table.llmDefault'),
                            reasoningModel: t('providerCenter.table.reasoning'),
                            embeddingModel: t('providerCenter.table.embedding'),
                          });

                          return (
                            <tr
                              key={`${record.id}-${index}-${model.id}`}
                              className="align-top"
                              data-slot="provider-center-route-model-row"
                            >
                              <td className="px-4 py-3">
                                {isEditable ? (
                                  <Input
                                    value={model.id}
                                    onChange={(event) =>
                                      setDraft((current) =>
                                        updateProviderConfigModelRow(current, index, {
                                          id: event.target.value,
                                        }),
                                      )
                                    }
                                  />
                                ) : (
                                  <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                                    {model.id}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {isEditable ? (
                                  <Input
                                    value={model.name}
                                    onChange={(event) =>
                                      setDraft((current) =>
                                        updateProviderConfigModelRow(current, index, {
                                          name: event.target.value,
                                        }),
                                      )
                                    }
                                  />
                                ) : (
                                  <div className="text-zinc-700 dark:text-zinc-200">
                                    {model.name || model.id}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {roles.length > 0 ? (
                                    roles.map((role) => (
                                      <span
                                        key={`${model.id}-${role}`}
                                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                      >
                                        {role}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {t('providerCenter.states.notSet')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {isEditable ? (
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        setDraft((current) =>
                                          moveProviderConfigModelRow(current, index, 'up'),
                                        )
                                      }
                                      disabled={index === 0}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        setDraft((current) =>
                                          moveProviderConfigModelRow(current, index, 'down'),
                                        )
                                      }
                                      disabled={index === modelRows.length - 1}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        setDraft((current) =>
                                          removeProviderConfigModelRow(current, index),
                                        )
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-[180px] flex-col items-center justify-center rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
                    <div className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                      {t('providerCenter.dialogs.editor.modelListEmptyTitle')}
                    </div>
                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {t('providerCenter.dialogs.editor.modelListEmptyDescription')}
                    </p>
                    {isEditable ? (
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => setDraft((current) => appendProviderConfigModelRow(current))}
                      >
                        <Plus className="h-4 w-4" />
                        {t('providerCenter.dialogs.editor.addModel')}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.table.status')}
                </div>
                <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('providerCenter.table.enabled')}
                    </span>{' '}
                    {record.enabled ? t('providerCenter.states.enabled') : t('providerCenter.states.disabled')}
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('providerCenter.table.exposeTo')}
                    </span>{' '}
                    {record.exposeTo.join(', ') || t('providerCenter.states.notSet')}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('providerCenter.table.selection')}
                </div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.defaultModel')}</Label>
                    {isEditable ? (
                      <Select
                        value={
                          draft.defaultModelId && selectableModelIds.has(draft.defaultModelId)
                            ? draft.defaultModelId
                            : UNSET_MODEL_OPTION_VALUE
                        }
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            defaultModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                          }))
                        }
                        disabled={modelSelectionOptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('providerCenter.states.notSet')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                            {t('providerCenter.states.notSet')}
                          </SelectItem>
                          {modelSelectionOptions.map((model) => (
                            <SelectItem key={`route-default-${model.id}`} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {record.defaultModelId || t('providerCenter.states.notSet')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.reasoningModel')}</Label>
                    {isEditable ? (
                      <Select
                        value={
                          draft.reasoningModelId && selectableModelIds.has(draft.reasoningModelId)
                            ? draft.reasoningModelId
                            : UNSET_MODEL_OPTION_VALUE
                        }
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            reasoningModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                          }))
                        }
                        disabled={modelSelectionOptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('providerCenter.states.notSet')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                            {t('providerCenter.states.notSet')}
                          </SelectItem>
                          {modelSelectionOptions.map((model) => (
                            <SelectItem key={`route-reasoning-${model.id}`} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {record.reasoningModelId || t('providerCenter.states.notSet')}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('providerCenter.dialogs.editor.embeddingModel')}</Label>
                    {isEditable ? (
                      <Select
                        value={
                          draft.embeddingModelId && selectableModelIds.has(draft.embeddingModelId)
                            ? draft.embeddingModelId
                            : UNSET_MODEL_OPTION_VALUE
                        }
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            embeddingModelId: value === UNSET_MODEL_OPTION_VALUE ? '' : value,
                          }))
                        }
                        disabled={modelSelectionOptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('providerCenter.states.notSet')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNSET_MODEL_OPTION_VALUE}>
                            {t('providerCenter.states.notSet')}
                          </SelectItem>
                          {modelSelectionOptions.map((model) => (
                            <SelectItem key={`route-embedding-${model.id}`} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {record.embeddingModelId || t('providerCenter.states.notSet')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {t('providerCenter.actions.cancel')}
            </Button>
            {record.managedBy === 'user' && onEditRequest ? (
              <Button variant="ghost" onClick={() => onEditRequest(record)} disabled={isSaving}>
                {t('providerCenter.actions.edit')}
              </Button>
            ) : null}
            {isEditable ? (
              <Button onClick={() => void handleSave()} disabled={!canSave}>
                <Save className="h-4 w-4" />
                {t('providerCenter.actions.saveChanges')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
