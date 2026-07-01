import React from 'react';
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
  Textarea,
} from '@sdkwork/claw-ui';

interface ProviderDialogDraft {
  id: string;
  name: string;
  endpoint: string;
  apiKeySource: string;
  defaultModelId: string;
  reasoningModelId: string;
  embeddingModelId: string;
  modelsText: string;
  requestOverridesText: string;
}

interface ProviderDialogModel {
  id: string;
  name: string;
}

interface ProviderModelDialogDraft {
  originalId?: string;
  id: string;
  name: string;
}

export interface InstanceDetailLlmProviderDialogsProps {
  isProviderDialogOpen: boolean;
  providerDialogDraft: ProviderDialogDraft;
  providerDialogModels: ProviderDialogModel[];
  providerDialogRequestParseError: string | null;
  isSavingProviderDialog: boolean;
  onProviderDialogOpenChange: (open: boolean) => void;
  onProviderDialogFieldChange: (field: keyof ProviderDialogDraft, value: string) => void;
  onSubmitProviderDialog: () => Promise<void> | void;
  isProviderModelDialogOpen: boolean;
  providerModelDialogDraft: ProviderModelDialogDraft;
  isSavingProviderModelDialog: boolean;
  onProviderModelDialogOpenChange: (open: boolean) => void;
  onProviderModelDialogFieldChange: (
    field: keyof Omit<ProviderModelDialogDraft, 'originalId'>,
    value: string,
  ) => void;
  onSubmitProviderModelDialog: () => Promise<void> | void;
  providerDeleteId: string | null;
  deletingProviderId: string | null;
  onProviderDeleteDialogOpenChange: (open: boolean) => void;
  onDeleteProvider: () => Promise<void> | void;
  providerModelDeleteId: string | null;
  deletingProviderModelId: string | null;
  onProviderModelDeleteDialogOpenChange: (open: boolean) => void;
  onDeleteProviderModel: () => Promise<void> | void;
  t: (key: string) => string;
}

export function InstanceDetailLlmProviderDialogs({
  isProviderDialogOpen,
  providerDialogDraft,
  providerDialogModels,
  providerDialogRequestParseError,
  isSavingProviderDialog,
  onProviderDialogOpenChange,
  onProviderDialogFieldChange,
  onSubmitProviderDialog,
  isProviderModelDialogOpen,
  providerModelDialogDraft,
  isSavingProviderModelDialog,
  onProviderModelDialogOpenChange,
  onProviderModelDialogFieldChange,
  onSubmitProviderModelDialog,
  providerDeleteId,
  deletingProviderId,
  onProviderDeleteDialogOpenChange,
  onDeleteProvider,
  providerModelDeleteId,
  deletingProviderModelId,
  onProviderModelDeleteDialogOpenChange,
  onDeleteProviderModel,
  t,
}: InstanceDetailLlmProviderDialogsProps) {
  const defaultDialogModelValue =
    providerDialogDraft.defaultModelId &&
    providerDialogModels.some((model) => model.id === providerDialogDraft.defaultModelId)
      ? providerDialogDraft.defaultModelId
      : '__auto__';
  const reasoningDialogModelValue =
    providerDialogDraft.reasoningModelId &&
    providerDialogModels.some((model) => model.id === providerDialogDraft.reasoningModelId)
      ? providerDialogDraft.reasoningModelId
      : '__none__';
  const embeddingDialogModelValue =
    providerDialogDraft.embeddingModelId &&
    providerDialogModels.some((model) => model.id === providerDialogDraft.embeddingModelId)
      ? providerDialogDraft.embeddingModelId
      : '__none__';

  return (
    <>
      <Dialog open={isProviderDialogOpen} onOpenChange={onProviderDialogOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.dialog.titleCreate')}</DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.llmProviders.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.providerId')}</Label>
              <Input
                value={providerDialogDraft.id}
                onChange={(event) => onProviderDialogFieldChange('id', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.providerId')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.displayName')}</Label>
              <Input
                value={providerDialogDraft.name}
                onChange={(event) => onProviderDialogFieldChange('name', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.displayName')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.endpoint')}</Label>
              <Input
                value={providerDialogDraft.endpoint}
                onChange={(event) => onProviderDialogFieldChange('endpoint', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.endpoint')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.apiKeySource')}</Label>
              <Input
                value={providerDialogDraft.apiKeySource}
                onChange={(event) => onProviderDialogFieldChange('apiKeySource', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.apiKeySource')}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.dialog.models')}</Label>
              <Textarea
                value={providerDialogDraft.modelsText}
                onChange={(event) => onProviderDialogFieldChange('modelsText', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.placeholders.models')}
                rows={6}
              />
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">
                {t('instances.detail.instanceWorkbench.llmProviders.requestOverrides')}
              </Label>
              <Textarea
                value={providerDialogDraft.requestOverridesText}
                onChange={(event) => onProviderDialogFieldChange('requestOverridesText', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.requestOverridesPlaceholder')}
                rows={8}
                className="font-mono text-xs"
              />
              {providerDialogRequestParseError ? (
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
                  {providerDialogRequestParseError}
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.llmProviders.requestOverridesHint')}
                </p>
              )}
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.defaultModel')}</Label>
              <Select
                value={defaultDialogModelValue}
                onValueChange={(value) =>
                  onProviderDialogFieldChange('defaultModelId', value === '__auto__' ? '' : value)
                }
                disabled={providerDialogModels.length === 0}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue
                    placeholder={t('instances.detail.instanceWorkbench.llmProviders.dialog.useFirstModel')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    {t('instances.detail.instanceWorkbench.llmProviders.dialog.useFirstModel')}
                  </SelectItem>
                  {providerDialogModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.reasoningModel')}</Label>
              <Select
                value={reasoningDialogModelValue}
                onValueChange={(value) =>
                  onProviderDialogFieldChange('reasoningModelId', value === '__none__' ? '' : value)
                }
                disabled={providerDialogModels.length === 0}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('common.none')}</SelectItem>
                  {providerDialogModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block md:col-span-2">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.embeddingModel')}</Label>
              <Select
                value={embeddingDialogModelValue}
                onValueChange={(value) =>
                  onProviderDialogFieldChange('embeddingModelId', value === '__none__' ? '' : value)
                }
                disabled={providerDialogModels.length === 0}
              >
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('common.none')}</SelectItem>
                  {providerDialogModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onProviderDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void onSubmitProviderDialog()}
              disabled={isSavingProviderDialog || Boolean(providerDialogRequestParseError)}
            >
              {isSavingProviderDialog ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProviderModelDialogOpen} onOpenChange={onProviderModelDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {providerModelDialogDraft.originalId
                ? t('instances.detail.instanceWorkbench.llmProviders.modelDialog.titleEdit')
                : t('instances.detail.instanceWorkbench.llmProviders.modelDialog.titleCreate')}
            </DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.llmProviders.modelDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.modelDialog.modelId')}</Label>
              <Input
                value={providerModelDialogDraft.id}
                onChange={(event) => onProviderModelDialogFieldChange('id', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.modelDialog.placeholders.modelId')}
              />
            </label>
            <label className="block">
              <Label className="mb-2">{t('instances.detail.instanceWorkbench.llmProviders.modelDialog.displayName')}</Label>
              <Input
                value={providerModelDialogDraft.name}
                onChange={(event) => onProviderModelDialogFieldChange('name', event.target.value)}
                placeholder={t('instances.detail.instanceWorkbench.llmProviders.modelDialog.placeholders.displayName')}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onProviderModelDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void onSubmitProviderModelDialog()} disabled={isSavingProviderModelDialog}>
              {isSavingProviderModelDialog ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(providerDeleteId)} onOpenChange={onProviderDeleteDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.descriptionPrefix')}{' '}
              <span className="font-mono text-xs">{deletingProviderId || providerDeleteId}</span>{' '}
              {t('instances.detail.instanceWorkbench.llmProviders.deleteProviderDialog.descriptionSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onProviderDeleteDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void onDeleteProvider()} className="bg-rose-600 text-white hover:bg-rose-700">
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(providerModelDeleteId)} onOpenChange={onProviderModelDeleteDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.descriptionPrefix')}{' '}
              <span className="font-mono text-xs">{deletingProviderModelId || providerModelDeleteId}</span>{' '}
              {t('instances.detail.instanceWorkbench.llmProviders.deleteModelDialog.descriptionSuffix')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onProviderModelDeleteDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void onDeleteProviderModel()} className="bg-rose-600 text-white hover:bg-rose-700">
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
