import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kernelAgentManagementService,
  type CreateKernelAgentResult,
  type KernelAgentCreationCapability,
  type KernelAgentCreationKernelOption,
  type KernelAgentLibraryItem,
} from '@sdkwork/claw-core';
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
  Switch,
  Textarea,
  cn,
} from '@sdkwork/claw-ui';
import {
  createChatAgentDraft,
  normalizeChatAgentCreationFollowUpResult,
  parseChatAgentFallbackModels,
  parseChatAgentOptionalNumber,
  slugifyChatAgentId,
  type ChatAgentCreationFollowUpResult,
  type ChatAgentDraft,
} from '../services';

type ChatNewAgentStreamingMode = ChatAgentDraft['streamingMode'];

function resolveKernelReasonMessage(
  option: KernelAgentCreationKernelOption | null | undefined,
  translate: (key: string, params?: Record<string, unknown>) => string,
) {
  if (!option) {
    return null;
  }

  switch (option.reasonCode) {
    case 'unsupportedKernel':
      return translate('chat.sidebar.newAgentDialog.reasons.unsupportedKernel', {
        kernel: option.label,
      });
    case 'configUnavailable':
      return translate('chat.sidebar.newAgentDialog.reasons.configUnavailable');
    case 'configNotWritable':
      return translate('chat.sidebar.newAgentDialog.reasons.configNotWritable');
    default:
      return option.reason ?? null;
  }
}

export interface ChatNewAgentDialogProps {
  open: boolean;
  embedded?: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string | null | undefined;
  mode?: 'create' | 'copy';
  initialDraft?: ChatAgentDraft | null;
  sourceAgent?: KernelAgentLibraryItem | null;
  headerLeading?: React.ReactNode;
  onCreated?: (
    result: CreateKernelAgentResult,
  ) =>
    | Promise<ChatAgentCreationFollowUpResult | void>
    | ChatAgentCreationFollowUpResult
    | void;
}

export function ChatNewAgentDialog({
  open,
  embedded = false,
  onOpenChange,
  instanceId,
  mode = 'create',
  initialDraft = null,
  sourceAgent = null,
  headerLeading = null,
  onCreated,
}: ChatNewAgentDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ChatAgentDraft>(createChatAgentDraft);
  const [capability, setCapability] = useState<KernelAgentCreationCapability | null>(null);
  const [selectedKernelId, setSelectedKernelId] = useState<string | null>(null);
  const [isLoadingCapability, setIsLoadingCapability] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAgentResult, setCreatedAgentResult] = useState<CreateKernelAgentResult | null>(
    null,
  );
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const capabilityRequestRef = useRef(0);
  const agentIdTouchedRef = useRef(false);
  const resolveCapabilityLoadError = React.useEffectEvent((error: any) => {
    return error?.message || t('chat.sidebar.newAgentDialog.status.loadFailed');
  });

  useEffect(() => {
    if (!open) {
      capabilityRequestRef.current += 1;
      setDraft(createChatAgentDraft());
      setCapability(null);
      setSelectedKernelId(null);
      setIsLoadingCapability(false);
      setIsCreating(false);
      setLoadError(null);
      setSubmitError(null);
      setCreatedAgentResult(null);
      setFollowUpError(null);
      agentIdTouchedRef.current = false;
      return;
    }

    setDraft(initialDraft ?? createChatAgentDraft());
    setIsCreating(false);
    setLoadError(null);
    setSubmitError(null);
    setCreatedAgentResult(null);
    setFollowUpError(null);
    agentIdTouchedRef.current = false;

    if (!instanceId) {
      capabilityRequestRef.current += 1;
      setCapability(null);
      setSelectedKernelId(null);
      setIsLoadingCapability(false);
      setLoadError(null);
      setSubmitError(null);
      setCreatedAgentResult(null);
      setFollowUpError(null);
      return;
    }

    const requestId = capabilityRequestRef.current + 1;
    capabilityRequestRef.current = requestId;
    setIsLoadingCapability(true);
    setLoadError(null);

    void kernelAgentManagementService
      .getCreationCapability(instanceId)
      .then((nextCapability) => {
        if (capabilityRequestRef.current !== requestId) {
          return;
        }

        setCapability(nextCapability);
        setSelectedKernelId((current) => {
          if (
            current &&
            nextCapability.kernelOptions.some((option) => option.kernelId === current)
          ) {
            return current;
          }

          return nextCapability.defaultKernelId ?? nextCapability.kernelOptions[0]?.kernelId ?? null;
        });
      })
      .catch((error: any) => {
        if (capabilityRequestRef.current !== requestId) {
          return;
        }

        setCapability(null);
        setSelectedKernelId(null);
        setLoadError(resolveCapabilityLoadError(error));
      })
      .finally(() => {
        if (capabilityRequestRef.current === requestId) {
          setIsLoadingCapability(false);
        }
      });
  }, [initialDraft, instanceId, open, resolveCapabilityLoadError]);

  const selectedKernelOption =
    capability?.kernelOptions.find((option) => option.kernelId === selectedKernelId) ?? null;
  const kernelReasonMessage = resolveKernelReasonMessage(selectedKernelOption, t);
  const showKernelSelector = (capability?.kernelOptions.length ?? 0) > 1;

  const updateDraft = <T extends keyof ChatAgentDraft>(
    field: T,
    value: ChatAgentDraft[T],
  ) => {
    setDraft((current) => {
      if (field === 'displayName') {
        const nextDisplayName = String(value);
        const generatedAgentId = slugifyChatAgentId(nextDisplayName);
        return {
          ...current,
          displayName: nextDisplayName,
          agentId:
            agentIdTouchedRef.current || current.agentId.trim()
              ? current.agentId
              : generatedAgentId,
        };
      }

      if (field === 'agentId') {
        agentIdTouchedRef.current = true;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleCreate = () => {
    if (!instanceId || !selectedKernelId) {
      return;
    }

    const normalizedAgentId = draft.agentId.trim();
    const normalizedDisplayName = draft.displayName.trim();
    if (!normalizedAgentId) {
      setSubmitError(t('chat.sidebar.newAgentDialog.validation.agentIdRequired'));
      return;
    }
    if (!normalizedDisplayName) {
      setSubmitError(t('chat.sidebar.newAgentDialog.validation.displayNameRequired'));
      return;
    }
    if (selectedKernelOption && !selectedKernelOption.supported) {
      setSubmitError(
        kernelReasonMessage || t('chat.sidebar.newAgentDialog.status.kernelUnavailable'),
      );
      return;
    }

    let temperature: number | null;
    let topP: number | null;
    let maxTokens: number | null;
    let timeoutMs: number | null;
    try {
      temperature = parseChatAgentOptionalNumber(
        draft.temperature,
        t('chat.sidebar.newAgentDialog.labels.temperature'),
      );
      topP = parseChatAgentOptionalNumber(
        draft.topP,
        t('chat.sidebar.newAgentDialog.labels.topP'),
      );
      maxTokens = parseChatAgentOptionalNumber(
        draft.maxTokens,
        t('chat.sidebar.newAgentDialog.labels.maxTokens'),
      );
      timeoutMs = parseChatAgentOptionalNumber(
        draft.timeoutMs,
        t('chat.sidebar.newAgentDialog.labels.timeoutMs'),
      );
    } catch (error: any) {
      setSubmitError(
        t('chat.sidebar.newAgentDialog.validation.invalidNumber', {
          field: error?.message || t('chat.sidebar.newAgentDialog.labels.temperature'),
        }),
      );
      return;
    }

    setIsCreating(true);
    setSubmitError(null);
    setCreatedAgentResult(null);
    setFollowUpError(null);

    void kernelAgentManagementService
      .createAgent({
        instanceId,
        kernelId: selectedKernelId,
        agentId: normalizedAgentId,
        displayName: normalizedDisplayName,
        avatar: draft.avatar,
        primaryModel: draft.primaryModel || null,
        fallbackModels: parseChatAgentFallbackModels(draft.fallbackModelsText),
        workspace: draft.workspace,
        agentDir: draft.agentDir,
        temperature,
        topP,
        maxTokens,
        timeoutMs,
        isDefault: draft.isDefault,
        streaming:
          draft.streamingMode === 'inherit'
            ? null
            : draft.streamingMode === 'enabled',
      })
      .then(async (result) => {
        const followUpResult = normalizeChatAgentCreationFollowUpResult(
          await onCreated?.(result),
        );

        if (followUpResult.status === 'activationFailed') {
          setCreatedAgentResult(result);
          setFollowUpError(
            followUpResult.errorMessage
            || t('chat.sidebar.agentActivationFailed', {
              agent: result.displayName,
            }),
          );
          return;
        }

        onOpenChange(false);
      })
      .catch((error: any) => {
        setSubmitError(
          error?.message || t('chat.sidebar.newAgentDialog.status.createFailed'),
        );
      })
      .finally(() => {
        setIsCreating(false);
      });
  };
  const dialogTitle =
    mode === 'copy'
      ? t('chat.sidebar.newAgentDialog.copyTitle')
      : t('chat.sidebar.newAgentDialog.title');
  const dialogDescription =
    mode === 'copy'
      ? t('chat.sidebar.newAgentDialog.copyDescription')
      : t('chat.sidebar.newAgentDialog.description');
  const submitLabel =
    mode === 'copy'
      ? t('chat.sidebar.newAgentDialog.actions.createCopy')
      : t('chat.sidebar.newAgentDialog.actions.create');

  const content = (
    <>
      <DialogHeader>
        {headerLeading ? (
          <div className="flex items-start gap-3">
            <div className="shrink-0">{headerLeading}</div>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </div>
          </div>
        ) : (
          <>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </>
        )}
      </DialogHeader>

      <div className="space-y-4 py-2">
        {capability ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              {t('chat.sidebar.newAgentDialog.instance')}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
              {capability.instanceName}
            </span>
            {!showKernelSelector && selectedKernelOption ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                <span className="rounded-full border border-zinc-200/80 px-3 py-1 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                  {selectedKernelOption.label}
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {sourceAgent ? (
          <div className="rounded-2xl border border-primary-200/80 bg-primary-50/80 px-4 py-4 dark:border-primary-500/30 dark:bg-primary-500/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-200">
                  {t('chat.sidebar.newAgentDialog.labels.sourceAgent')}
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-primary-950 dark:text-primary-50">
                    {sourceAgent.displayName}
                  </span>
                  <span className="rounded-full border border-primary-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-700 dark:border-primary-400/30 dark:text-primary-100">
                    {sourceAgent.sourceKernelId}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-primary-800 shadow-sm dark:bg-primary-950/70 dark:text-primary-100">
                {sourceAgent.sourceInstanceName}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-primary-800/85 dark:text-primary-100/80">
              {sourceAgent.description}
            </p>
          </div>
        ) : null}

        {isLoadingCapability ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {t('chat.sidebar.newAgentDialog.status.loading')}
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        ) : null}

          {showKernelSelector && capability ? (
            <div className="space-y-2">
              <Label>{t('chat.sidebar.newAgentDialog.labels.kernel')}</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {capability.kernelOptions.map((option) => {
                  const isSelected = option.kernelId === selectedKernelId;
                  const optionReason = resolveKernelReasonMessage(option, t);

                  return (
                    <button
                      key={option.kernelId}
                      type="button"
                      onClick={() => setSelectedKernelId(option.kernelId)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all',
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white shadow-lg dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                          : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:border-zinc-700',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                            option.supported
                              ? isSelected
                                ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                              : isSelected
                                ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
                          )}
                        >
                          {option.supported
                            ? t('chat.sidebar.newAgentDialog.status.available')
                            : t('chat.sidebar.newAgentDialog.status.unavailable')}
                        </span>
                      </div>
                      {optionReason ? (
                        <p
                          className={cn(
                            'mt-2 text-xs leading-5',
                            isSelected
                              ? 'text-white/80 dark:text-zinc-700'
                              : 'text-zinc-500 dark:text-zinc-400',
                          )}
                        >
                          {optionReason}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {kernelReasonMessage && !showKernelSelector && !selectedKernelOption?.supported ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              {kernelReasonMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.agentId')}
              </Label>
              <Input
                value={draft.agentId}
                onChange={(event) => updateDraft('agentId', event.target.value)}
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.agentId')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.displayName')}
              </Label>
              <Input
                value={draft.displayName}
                onChange={(event) => updateDraft('displayName', event.target.value)}
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.displayName')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.avatar')}
              </Label>
              <Input
                value={draft.avatar}
                onChange={(event) => updateDraft('avatar', event.target.value)}
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.avatar')}
              />
            </label>
            <div className="block">
              <Label className="mb-2 block" htmlFor="chat-new-agent-primary-model">
                {t('chat.sidebar.newAgentDialog.labels.primaryModel')}
              </Label>
              <Select
                value={draft.primaryModel || '__inherit__'}
                onValueChange={(value) =>
                  updateDraft(
                    'primaryModel',
                    value === '__inherit__' ? '' : value,
                  )
                }
              >
                <SelectTrigger
                  id="chat-new-agent-primary-model"
                  className="rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__inherit__">
                    {t('chat.sidebar.newAgentDialog.modelInherit')}
                  </SelectItem>
                  {(capability?.modelOptions ?? []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {capability && capability.modelOptions.length === 0 ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('chat.sidebar.newAgentDialog.modelHint')}
                </div>
              ) : null}
            </div>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.fallbackModels')}
              </Label>
              <Textarea
                value={draft.fallbackModelsText}
                onChange={(event) =>
                  updateDraft('fallbackModelsText', event.target.value)
                }
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.fallbackModels')}
                rows={4}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.workspace')}
              </Label>
              <Input
                value={draft.workspace}
                onChange={(event) => updateDraft('workspace', event.target.value)}
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.workspace')}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.agentDir')}
              </Label>
              <Input
                value={draft.agentDir}
                onChange={(event) => updateDraft('agentDir', event.target.value)}
                placeholder={t('chat.sidebar.newAgentDialog.placeholders.agentDir')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.temperature')}
              </Label>
              <Input
                value={draft.temperature}
                onChange={(event) => updateDraft('temperature', event.target.value)}
                placeholder="0.2"
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.topP')}
              </Label>
              <Input
                value={draft.topP}
                onChange={(event) => updateDraft('topP', event.target.value)}
                placeholder="1"
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.maxTokens')}
              </Label>
              <Input
                value={draft.maxTokens}
                onChange={(event) => updateDraft('maxTokens', event.target.value)}
                placeholder="32000"
              />
            </label>
            <label className="block">
              <Label className="mb-2">
                {t('chat.sidebar.newAgentDialog.labels.timeoutMs')}
              </Label>
              <Input
                value={draft.timeoutMs}
                onChange={(event) => updateDraft('timeoutMs', event.target.value)}
                placeholder="60000"
              />
            </label>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {t('chat.sidebar.newAgentDialog.labels.defaultAgent')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('chat.sidebar.newAgentDialog.defaultAgentDescription')}
                </div>
              </div>
              <Switch
                checked={draft.isDefault}
                onCheckedChange={(checked) => updateDraft('isDefault', checked)}
                aria-label={t('chat.sidebar.newAgentDialog.labels.defaultAgent')}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 md:col-span-2 dark:border-zinc-800 dark:bg-zinc-950">
              <div>
                <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {t('chat.sidebar.newAgentDialog.labels.streaming')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t('chat.sidebar.newAgentDialog.streamingDescription')}
                </div>
              </div>
              <Select
                value={draft.streamingMode}
                onValueChange={(value) =>
                  updateDraft(
                    'streamingMode',
                    value as ChatNewAgentStreamingMode,
                  )
                }
              >
                <SelectTrigger
                  className="w-[12rem] rounded-xl"
                  aria-label={t('chat.sidebar.newAgentDialog.labels.streaming')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    {t('chat.sidebar.newAgentDialog.streamingModes.inherit')}
                  </SelectItem>
                  <SelectItem value="enabled">
                    {t('chat.sidebar.newAgentDialog.streamingModes.enabled')}
                  </SelectItem>
                  <SelectItem value="disabled">
                    {t('chat.sidebar.newAgentDialog.streamingModes.disabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        {submitError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {submitError}
          </div>
        ) : null}

        {followUpError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {followUpError}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" disabled={isCreating} onClick={() => onOpenChange(false)}>
          {createdAgentResult ? t('common.close') : t('common.cancel')}
        </Button>
        <Button
          onClick={handleCreate}
          disabled={
            !instanceId ||
            isLoadingCapability ||
            isCreating ||
            createdAgentResult !== null ||
            !capability ||
            !selectedKernelOption?.supported
          }
        >
          {isCreating
            ? t('chat.sidebar.newAgentDialog.status.creating')
            : createdAgentResult
              ? t('chat.sidebar.newAgentDialog.actions.created')
              : submitLabel}
        </Button>
      </DialogFooter>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isCreating && !nextOpen) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="left-1/2 top-1/2 w-[min(64rem,calc(100vw-2rem))] max-w-none translate-x-[-50%] translate-y-[-50%]">
        {content}
      </DialogContent>
    </Dialog>
  );
}
