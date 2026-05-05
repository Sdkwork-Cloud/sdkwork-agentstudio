import * as React from 'react';
import * as QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  ExternalLink,
  Keyboard,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  ChannelCatalog,
  type ChannelCatalogItem,
  type ChannelCatalogTexts,
  type ChannelCatalogVariant,
} from './ChannelCatalog';
import { Button } from './Button';
import { ChannelRegionTabs } from './ChannelRegionTabs';
import { Input } from './Input';
import { Label } from './Label';
import { OverlaySurface } from './OverlaySurface';
import { Textarea } from './Textarea';
import { ChannelEmptyStateSurface, ChannelIdentityBadge } from './channelCatalogShared';
import {
  getChannelCatalogRegions,
  isChannelDownloadAppAction,
  getChannelOfficialLink,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  type ChannelCatalogRegion,
  type ChannelOfficialLink,
} from './channelCatalogMeta';
import {
  buildChannelCatalogRegionLabels,
  getChannelCatalogRegionEmptyText,
} from './channelCatalogRegionContent';
import {
  localizeChannelOfficialLink,
  localizeChannelWorkspaceItem,
} from './channelDefinitionLocalization';

export interface ChannelWorkspaceField {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
  type?: React.HTMLInputTypeAttribute;
}

export interface ChannelWorkspaceItem extends Omit<ChannelCatalogItem, 'setupSteps'> {
  fields: ChannelWorkspaceField[];
  setupSteps: string[];
  values?: Record<string, string>;
}

export interface ChannelWorkspaceTexts extends ChannelCatalogTexts {
  configFileLabel?: string;
  panelEyebrow: string;
  setupGuideTitle: string;
  credentialsTitle: string;
  qrConnectionTitle: string;
  qrConnectionDescription: string;
  qrConnectionAlt: string;
  qrConnectionPending: string;
  qrConnectionHint: string;
  manualConfigurationAction: string;
  saveAction: string;
  savingAction: string;
  deleteConfigurationAction: string;
  validationRequiredField: (fieldLabel: string) => string;
}

export interface ChannelWorkspaceProps {
  items: ChannelWorkspaceItem[];
  texts: ChannelWorkspaceTexts;
  variant?: ChannelCatalogVariant;
  emptyState?: React.ReactNode;
  selectedChannelId: string | null;
  valuesByChannelId?: Record<string, Record<string, string>>;
  configFilePath?: string | null;
  error?: React.ReactNode;
  isSaving?: boolean;
  className?: string;
  drawerClassName?: string;
  resolveOfficialLink?: (channel: ChannelWorkspaceItem) => ChannelOfficialLink | null;
  onOpenOfficialLink?: (
    channel: ChannelWorkspaceItem,
    link: ChannelOfficialLink,
  ) => Promise<void> | void;
  onSelectedChannelIdChange: (channelId: string | null) => void;
  onFieldChange?: (
    channel: ChannelWorkspaceItem,
    fieldKey: string,
    value: string,
  ) => Promise<void> | void;
  onSave?: (
    channel: ChannelWorkspaceItem,
    values: Record<string, string>,
  ) => Promise<void> | void;
  onDeleteConfiguration?: (channel: ChannelWorkspaceItem) => Promise<void> | void;
  onToggleEnabled?: (
    channel: ChannelWorkspaceItem,
    nextEnabled: boolean,
  ) => Promise<void> | void;
}

function deriveFieldValues(channel: ChannelWorkspaceItem) {
  return channel.fields.reduce<Record<string, string>>((accumulator, field) => {
    if (typeof channel.values?.[field.key] === 'string') {
      accumulator[field.key] = channel.values[field.key];
      return accumulator;
    }

    accumulator[field.key] = '';
    return accumulator;
  }, {});
}

function getInputType(field: ChannelWorkspaceField) {
  if (field.type) {
    return field.type;
  }
  if (field.sensitive) {
    return 'password';
  }
  if (field.inputMode === 'numeric') {
    return 'number';
  }
  if (field.inputMode === 'url') {
    return 'url';
  }
  return 'text';
}

type ChannelConnectionMode = 'qr' | 'manual';

function supportsChannelQrConnection(channel: ChannelWorkspaceItem | null) {
  return Boolean(channel && getChannelCatalogRegions(channel.id).includes('domestic'));
}

function buildChannelQrContent(channel: ChannelWorkspaceItem) {
  return JSON.stringify({
    kind: 'sdkwork-claw-channel-connect',
    channelId: channel.id,
    channelName: channel.name,
    configurationMode: channel.configurationMode || 'required',
  });
}

function useChannelQrImage(channel: ChannelWorkspaceItem | null) {
  const [qrImageSrc, setQrImageSrc] = React.useState('');

  React.useEffect(() => {
    let disposed = false;

    if (!channel || !supportsChannelQrConnection(channel)) {
      setQrImageSrc('');
      return () => {
        disposed = true;
      };
    }

    setQrImageSrc('');
    void QRCode.toDataURL(buildChannelQrContent(channel), {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((nextImageSrc) => {
        if (!disposed) {
          setQrImageSrc(nextImageSrc);
        }
      })
      .catch(() => {
        if (!disposed) {
          setQrImageSrc('');
        }
      });

    return () => {
      disposed = true;
    };
  }, [channel]);

  return qrImageSrc;
}

export function ChannelWorkspace({
  items,
  texts,
  variant = 'management',
  emptyState = null,
  selectedChannelId,
  valuesByChannelId = {},
  configFilePath,
  error,
  isSaving = false,
  className,
  drawerClassName,
  resolveOfficialLink = (channel) => getChannelOfficialLink(channel.id),
  onOpenOfficialLink,
  onSelectedChannelIdChange,
  onFieldChange,
  onSave,
  onDeleteConfiguration,
  onToggleEnabled,
}: ChannelWorkspaceProps) {
  const { t } = useTranslation();
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [selectedConnectionMode, setSelectedConnectionMode] =
    React.useState<ChannelConnectionMode>('qr');
  const localizedItems = React.useMemo(
    () =>
      items.map((item) =>
        localizeChannelWorkspaceItem(t, item, {
          localizeMetadata: false,
        }),
      ),
    [items, t],
  );
  const regionGroups = React.useMemo(
    () => partitionChannelCatalogItemsByRegion(localizedItems),
    [localizedItems],
  );
  const [activeRegion, setActiveRegion] = React.useState<ChannelCatalogRegion>(() =>
    resolveDefaultChannelCatalogRegion(regionGroups),
  );
  const visibleItems = regionGroups[activeRegion];

  const selectedChannel = React.useMemo(
    () => localizedItems.find((channel) => channel.id === selectedChannelId) || null,
    [localizedItems, selectedChannelId],
  );
  const selectedChannelSupportsQrConnection = supportsChannelQrConnection(selectedChannel);
  const selectedQrImageSrc = useChannelQrImage(selectedChannelSupportsQrConnection ? selectedChannel : null);
  const shouldShowCredentialsPanel = !selectedChannelSupportsQrConnection || selectedConnectionMode === 'manual';

  const selectedValues = React.useMemo<Record<string, string>>(() => {
    if (!selectedChannel) {
      return {};
    }

    return valuesByChannelId[selectedChannel.id] || deriveFieldValues(selectedChannel);
  }, [selectedChannel, valuesByChannelId]);

  React.useEffect(() => {
    setValidationError(null);
    setSelectedConnectionMode('qr');
  }, [selectedChannelId]);

  React.useEffect(() => {
    const preferredRegion = resolveDefaultChannelCatalogRegion(regionGroups);
    if (regionGroups[activeRegion].length === 0 && regionGroups[preferredRegion].length > 0) {
      setActiveRegion(preferredRegion);
    }
  }, [activeRegion, regionGroups]);

  React.useEffect(() => {
    if (!selectedChannel) {
      return;
    }

    if (
      activeRegion !== 'all' &&
      !getChannelCatalogRegions(selectedChannel.id).includes(activeRegion)
    ) {
      onSelectedChannelIdChange(null);
    }
  }, [activeRegion, onSelectedChannelIdChange, selectedChannel]);

  const displayedError = error || validationError;
  const resolveLocalizedOfficialLink = React.useCallback(
    (channel: ChannelWorkspaceItem) =>
      localizeChannelOfficialLink(t, channel.id, resolveOfficialLink(channel)),
    [resolveOfficialLink, t],
  );
  const selectedChannelOfficialLink = selectedChannel
    ? resolveLocalizedOfficialLink(selectedChannel)
    : null;
  const selectedOfficialActionLabel =
    selectedChannel && isChannelDownloadAppAction(selectedChannel.id)
      ? texts.actionDownloadApp
      : texts.actionOpenOfficialSite;
  const deleteActionLabel = texts.deleteConfigurationAction;
  const hasConfiguredValues = selectedChannel
    ? selectedChannel.fields.some((field) => Boolean((selectedValues[field.key] || '').trim()))
    : false;
  const regionLabels: Record<ChannelCatalogRegion, string> = buildChannelCatalogRegionLabels(t);
  const regionCounts: Record<ChannelCatalogRegion, number> = {
    domestic: regionGroups.domestic.length,
    global: regionGroups.global.length,
    media: regionGroups.media.length,
    all: regionGroups.all.length,
  };
  const regionEmptyText = getChannelCatalogRegionEmptyText(t, activeRegion);

  const handleOpenSelectedOfficialLink = () => {
    if (!selectedChannel || !selectedChannelOfficialLink) {
      return;
    }

    if (onOpenOfficialLink) {
      void onOpenOfficialLink(selectedChannel, selectedChannelOfficialLink);
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(selectedChannelOfficialLink.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSave = () => {
    if (!selectedChannel || !onSave) {
      return;
    }

    const missingField = selectedChannel.fields.find(
      (field) => field.required && !(selectedValues[field.key] || '').trim(),
    );
    if (missingField) {
      setValidationError(texts.validationRequiredField(missingField.label));
      return;
    }

    void onSave(selectedChannel, selectedValues);
  };

  const handleQrConnect = () => {
    if (!selectedChannel) {
      return;
    }

    setValidationError(null);
    if (selectedChannel.fields.length === 0 && onToggleEnabled) {
      void onToggleEnabled(selectedChannel, true);
      return;
    }

    if (selectedChannel.fields.length === 0 && onSave) {
      void onSave(selectedChannel, selectedValues);
      return;
    }

    setSelectedConnectionMode('manual');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {configFilePath ? (
        <div className="rounded-[24px] border border-zinc-200/70 bg-white/88 p-4 text-sm text-zinc-600 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.45)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/45 dark:text-zinc-300">
          {texts.configFileLabel ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {texts.configFileLabel}
            </div>
          ) : null}
          <div className="mt-2 break-all font-mono text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {configFilePath}
          </div>
        </div>
      ) : null}

      {localizedItems.length > 0 ? (
        <ChannelRegionTabs
          activeRegion={activeRegion}
          labels={regionLabels}
          counts={regionCounts}
          onChange={setActiveRegion}
        />
      ) : null}

      <ChannelCatalog
        items={visibleItems}
        texts={texts}
        variant={variant}
        emptyState={
          localizedItems.length === 0 ? (
            emptyState
          ) : (
            <ChannelEmptyStateSurface
              dataSlot="channel-workspace-empty-state"
              title={regionEmptyText}
              className="rounded-[24px] border border-dashed border-zinc-300/80 bg-gradient-to-br from-white via-white to-zinc-50/90 p-6 text-sm text-zinc-500 shadow-[0_18px_46px_-40px_rgba(15,23,42,0.35)] dark:border-zinc-700 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950/90 dark:text-zinc-400"
            />
          )
        }
        showRegionTabs={false}
        resolveOfficialLink={(channel) =>
          resolveLocalizedOfficialLink(channel as ChannelWorkspaceItem)
        }
        onOpenOfficialLink={
          onOpenOfficialLink
            ? (channel, link) => onOpenOfficialLink(channel as ChannelWorkspaceItem, link)
            : undefined
        }
        onConfigure={
          variant === 'management'
            ? (channel) => {
                setValidationError(null);
                onSelectedChannelIdChange(channel.id);
              }
            : undefined
        }
        onToggleEnabled={
          variant === 'management' && onToggleEnabled
            ? (channel, nextEnabled) =>
                onToggleEnabled(channel as ChannelWorkspaceItem, nextEnabled)
            : undefined
        }
      />

      {variant === 'management' && selectedChannel ? (
        <OverlaySurface
          isOpen
          onClose={() => onSelectedChannelIdChange(null)}
          variant="drawer"
          className={cn(
            'max-w-[34rem] bg-gradient-to-br from-white via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950',
            drawerClassName,
          )}
        >
          <div
            data-slot="channel-workspace-drawer-header"
            className="flex items-start justify-between border-b border-zinc-200/70 bg-gradient-to-br from-white via-white to-zinc-50 px-6 py-5 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950"
          >
            <div className="flex items-center gap-3">
              <ChannelIdentityBadge
                channelId={selectedChannel.id}
                channelName={selectedChannel.name}
                icon={selectedChannel.icon}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm"
                monogramClassName="text-xs font-bold uppercase tracking-[0.18em]"
              />
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedChannel.name}
                </h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {texts.panelEyebrow}
                </p>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {selectedChannel.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectedChannelIdChange(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/80 bg-white/70 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-zinc-50/40 dark:bg-zinc-950/35">
            <div className="space-y-6 p-6">
              <div
                data-slot="channel-workspace-setup-panel"
                className="rounded-[24px] border border-primary-200/70 bg-gradient-to-br from-primary-50 via-white to-primary-100/70 p-5 shadow-[0_20px_50px_-40px_rgba(37,99,235,0.45)] dark:border-primary-500/20 dark:from-primary-500/12 dark:via-zinc-900 dark:to-primary-500/8"
              >
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary-900 dark:text-primary-100">
                  <BookOpen className="h-4 w-4" />
                  {texts.setupGuideTitle}
                </h3>
                <ol className="space-y-3">
                  {selectedChannel.setupSteps.map((step, index) => (
                    <li
                      key={`${selectedChannel.id}-${index}`}
                      className="flex gap-3 text-sm text-primary-800 dark:text-primary-200"
                    >
                      <span className="shrink-0 font-mono font-bold text-primary-400">
                        {index + 1}.
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
                {selectedChannelOfficialLink ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    type="button"
                    title={selectedChannelOfficialLink.label}
                    onClick={handleOpenSelectedOfficialLink}
                  >
                    {selectedOfficialActionLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              {selectedChannelSupportsQrConnection && selectedConnectionMode === 'qr' ? (
                <div
                  data-slot="channel-workspace-qr-panel"
                  className="rounded-[24px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.32)] dark:border-zinc-800 dark:bg-zinc-900/86"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        <QrCode className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                        {texts.qrConnectionTitle}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {texts.qrConnectionDescription}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {texts.qrConnectionPending}
                    </span>
                  </div>

                  <div className="mt-5 rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-950/55">
                    <div className="mx-auto aspect-square w-full max-w-[220px] rounded-[18px] bg-white p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                      {selectedQrImageSrc ? (
                        <img
                          src={selectedQrImageSrc}
                          alt={texts.qrConnectionAlt}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-[14px] bg-zinc-100 text-zinc-400">
                          <LoaderCircle className="h-7 w-7 animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="mx-auto mt-4 max-w-[18rem] text-center text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {texts.qrConnectionHint}
                    </p>
                    <button
                      type="button"
                      data-slot="channel-workspace-qr-manual-action"
                      className="mx-auto mt-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                      onClick={() => {
                        setValidationError(null);
                        setSelectedConnectionMode('manual');
                      }}
                    >
                      <Keyboard className="h-4 w-4" />
                      {texts.manualConfigurationAction}
                    </button>
                  </div>
                </div>
              ) : null}

              {shouldShowCredentialsPanel ? (
                <div
                  data-slot="channel-workspace-credentials-panel"
                  className="rounded-[24px] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.32)] dark:border-zinc-800 dark:bg-zinc-900/86"
                >
                  <h3 className="border-b border-zinc-100 pb-2 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                    {texts.credentialsTitle}
                  </h3>
                  <div className="mt-5 space-y-5">
                    {selectedChannel.fields.map((field) => (
                      <div key={field.key}>
                        <Label className="mb-1.5 block">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </Label>
                        {field.multiline ? (
                          <Textarea
                            value={selectedValues[field.key] || ''}
                            onChange={(event) => {
                              setValidationError(null);
                              if (!onFieldChange) {
                                return;
                              }
                              void onFieldChange(selectedChannel, field.key, event.target.value);
                            }}
                            placeholder={field.placeholder}
                            rows={5}
                          />
                        ) : (
                          <Input
                            type={getInputType(field)}
                            value={selectedValues[field.key] || ''}
                            onChange={(event) => {
                              setValidationError(null);
                              if (!onFieldChange) {
                                return;
                              }
                              void onFieldChange(selectedChannel, field.key, event.target.value);
                            }}
                            placeholder={field.placeholder}
                          />
                        )}
                        {field.helpText ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                            {field.helpText}
                          </p>
                        ) : null}
                      </div>
                    ))}

                    {displayedError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                        {displayedError}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            data-slot="channel-workspace-footer"
            className="border-t border-zinc-200/70 bg-white/92 p-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/82"
          >
            <div className="flex flex-col gap-3">
              {selectedChannelSupportsQrConnection && selectedConnectionMode === 'qr' ? (
                <Button onClick={handleQrConnect} disabled={isSaving} className="w-full">
                  {isSaving ? texts.savingAction : texts.actionConnect}
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? texts.savingAction : texts.saveAction}
                </Button>
              )}
              {onDeleteConfiguration && hasConfiguredValues ? (
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    void onDeleteConfiguration(selectedChannel);
                  }}
                  className="w-full py-3 text-sm font-semibold text-red-500 transition-colors hover:text-red-600"
                >
                  {deleteActionLabel}
                </button>
              ) : null}
            </div>
          </div>
        </OverlaySurface>
      ) : null}
    </div>
  );
}
