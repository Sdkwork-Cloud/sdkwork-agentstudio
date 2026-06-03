import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import {
  Building2,
  Hash,
  MessageCircle,
  MessageSquare,
  Send,
  Smile,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  ChannelWorkspace,
  getChannelOfficialLink,
  localizeChannelWorkspaceItem,
  type ChannelWorkspaceItem,
} from '@sdkwork/claw-ui';
import {
  Channel,
  appendChannelBindingProcessOutput,
  applyChannelBindingJobUpdate,
  channelBindingSessionService,
  extractChannelBindingQrPayload,
  isActiveChannelBindingSession,
  isChannelBindingSessionActive,
  type ChannelBindingSession,
  channelService,
} from '../../services';
import { resolveChannelsPageInstanceId } from './channelInstanceResolver.ts';

const CHANNEL_BINDING_STATUS_POLL_INTERVAL_MS = 2_000;

type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

function resolveChannelWorkspaceIcon(iconName?: string): React.ReactNode | undefined {
  switch (iconName) {
    case 'MessageCircle':
      return <MessageCircle className="h-6 w-6 text-[#00D1B2]" />;
    case 'Smile':
      return <Smile className="h-6 w-6 text-[#12B7F5]" />;
    case 'Zap':
      return <Zap className="h-6 w-6 text-[#008CEE]" />;
    case 'Building2':
      return <Building2 className="h-6 w-6 text-[#2B82E4]" />;
    case 'Send':
      return <Send className="h-6 w-6 text-[#229ED9]" />;
    case 'MessageSquare':
      return <MessageSquare className="h-6 w-6 text-[#5865F2]" />;
    case 'Hash':
      return <Hash className="h-6 w-6 text-[#E01E5A]" />;
    case 'Webhook':
      return <Webhook className="h-6 w-6 text-primary-500" />;
    default:
      return undefined;
  }
}

function buildInitialFormData(channel: Channel | null) {
  if (!channel) {
    return {};
  }

  return channel.fields.reduce<Record<string, string>>((accumulator, field) => {
    if (field.value !== undefined) {
      accumulator[field.key] = field.value;
    }
    return accumulator;
  }, {});
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error ?? '');
}

function isServiceUnavailableError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();
  return message.includes('503') || message.includes('service unavailable');
}

function describeChannelsPageError(
  t: Translate,
  error: unknown,
  action: 'load' | 'toggle' | 'save' | 'delete',
) {
  if (action === 'load' && isServiceUnavailableError(error)) {
    return t('channels.page.feedback.loadFailedServiceUnavailable');
  }

  if (action === 'toggle') {
    return t('channels.page.feedback.toggleFailed');
  }

  if (action === 'save') {
    return t('channels.page.feedback.saveFailed');
  }

  if (action === 'delete') {
    return t('channels.page.feedback.deleteFailed');
  }

  return t('channels.page.feedback.loadFailed');
}

export function Channels() {
  const { t } = useTranslation();
  const { activeInstanceId, setActiveInstanceId } = useInstanceStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [resolvedInstanceId, setResolvedInstanceId] = useState<string | null>(
    activeInstanceId,
  );
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingInstance, setIsResolvingInstance] = useState(!activeInstanceId);
  const [bindingSession, setBindingSession] = useState<ChannelBindingSession | null>(null);
  const bindingSessionRef = useRef<ChannelBindingSession | null>(null);
  const effectiveInstanceId = activeInstanceId || resolvedInstanceId;

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) || null,
    [channels, selectedChannelId],
  );

  const channelWorkspaceItems = useMemo<ChannelWorkspaceItem[]>(
    () =>
      channels.map((channel) =>
        localizeChannelWorkspaceItem(t, {
          ...channel,
          icon: resolveChannelWorkspaceIcon(channel.icon),
          setupSteps: [...channel.setupGuide],
          values: channel.fields.reduce<Record<string, string>>((accumulator, field) => {
            accumulator[field.key] = field.value || '';
            return accumulator;
          }, {}),
        }),
      ),
    [channels, t],
  );

  const updateBindingSession = useCallback(
    (updater: (session: ChannelBindingSession | null) => ChannelBindingSession | null) => {
      setBindingSession((current) => {
        const next = updater(current);
        bindingSessionRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let disposed = false;

    if (activeInstanceId) {
      setResolvedInstanceId(activeInstanceId);
      setIsResolvingInstance(false);
      return () => {
        disposed = true;
      };
    }

    setIsResolvingInstance(true);
    void resolveChannelsPageInstanceId({
      activeInstanceId,
      listInstances: () => instanceDirectoryService.listInstances(),
      setActiveInstanceId,
    })
      .then((instanceId) => {
        if (disposed) {
          return;
        }

        setResolvedInstanceId(instanceId);
      })
      .catch((error) => {
        console.error('Failed to resolve channels page instance:', error);
        if (disposed) {
          return;
        }

        setResolvedInstanceId(null);
      })
      .finally(() => {
        if (!disposed) {
          setIsResolvingInstance(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [activeInstanceId, setActiveInstanceId]);

  useEffect(() => {
    const fetchChannels = async () => {
      if (isResolvingInstance) {
        setIsLoading(true);
        return;
      }

      if (!effectiveInstanceId) {
        setChannels([]);
        setSelectedChannelId(null);
        setFormData({});
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await channelService.getChannels(effectiveInstanceId);
        setChannels(data);
        setSelectedChannelId((current) =>
          data.some((channel) => channel.id === current) ? current : null,
        );
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to fetch channels:', error);
        setErrorMessage(describeChannelsPageError(t, error, 'load'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchChannels();
  }, [effectiveInstanceId, isResolvingInstance, t]);

  useEffect(() => {
    let disposed = false;
    let unsubscribeOutput: (() => void | Promise<void>) | null = null;
    let unsubscribeJobs: (() => void | Promise<void>) | null = null;

    void channelBindingSessionService
      .subscribeProcessOutput((event) => {
        const current = bindingSessionRef.current;
        if (!current?.jobId || event.jobId !== current.jobId) {
          return;
        }

        const detectedQrPayload = extractChannelBindingQrPayload(event.chunk);
        void appendChannelBindingProcessOutput(current, event).then((nextSession) => {
          if (!disposed) {
            updateBindingSession(() =>
              detectedQrPayload && nextSession.state === 'starting'
                ? {
                    ...nextSession,
                    state: 'awaiting_scan',
                  }
                : nextSession,
            );
          }
        });
      })
      .then((unsubscribe) => {
        if (disposed) {
          void unsubscribe();
          return;
        }

        unsubscribeOutput = unsubscribe;
      });

    void channelBindingSessionService
      .subscribeJobUpdates((event) => {
        updateBindingSession((current) =>
          current ? applyChannelBindingJobUpdate(current, event) : current,
        );
      })
      .then((unsubscribe) => {
        if (disposed) {
          void unsubscribe();
          return;
        }

        unsubscribeJobs = unsubscribe;
      });

    return () => {
      disposed = true;
      if (unsubscribeOutput) {
        void unsubscribeOutput();
      }
      if (unsubscribeJobs) {
        void unsubscribeJobs();
      }
    };
  }, [updateBindingSession]);

  useEffect(() => {
    const activeBindingSession = bindingSession;
    if (!effectiveInstanceId || !isActiveChannelBindingSession(activeBindingSession)) {
      return;
    }

    let disposed = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const updatedChannels = await channelService.getChannels(effectiveInstanceId);
        if (disposed) {
          return;
        }

        setChannels(updatedChannels);
        const updatedChannel = updatedChannels.find(
          (channel) => channel.id === activeBindingSession.channelId,
        );

        if (updatedChannel?.status === 'connected' || updatedChannel?.enabled) {
          updateBindingSession((current) =>
            current?.channelId === activeBindingSession.channelId
              ? {
                  ...current,
                  state: 'connected',
                }
              : current,
          );
          setSelectedChannelId(null);
          setFormData({});
          setErrorMessage(null);
          return;
        }
      } catch (error) {
        if (disposed) {
          return;
        }

        console.error('Failed to refresh channel binding status:', error);
      }

      if (!disposed) {
        timer = window.setTimeout(poll, CHANNEL_BINDING_STATUS_POLL_INTERVAL_MS);
      }
    };

    timer = window.setTimeout(poll, CHANNEL_BINDING_STATUS_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [bindingSession, effectiveInstanceId, updateBindingSession]);

  const handleSelectedChannelIdChange = (channelId: string | null) => {
    setSelectedChannelId(channelId);
    updateBindingSession((current) =>
      current && current.channelId !== channelId ? null : current,
    );

    if (!channelId) {
      setFormData({});
      return;
    }

    const channel = channels.find((item) => item.id === channelId) || null;
    setFormData(buildInitialFormData(channel));
  };

  const handleToggleEnable = async (channel: ChannelWorkspaceItem, nextEnabled: boolean) => {
    if (!effectiveInstanceId) {
      return;
    }

    if (nextEnabled && channel.status === 'not_configured') {
      handleSelectedChannelIdChange(channel.id);
      return;
    }

    setErrorMessage(null);
    try {
      const updatedChannels = await channelService.updateChannelStatus(
        effectiveInstanceId,
        channel.id,
        nextEnabled,
      );
      setChannels(updatedChannels);
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to update channel status:', error);
      setErrorMessage(describeChannelsPageError(t, error, 'toggle'));
    }
  };

  const handleFieldChange = (_channel: ChannelWorkspaceItem, key: string, value: string) => {
    setErrorMessage(null);
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const openOfficialLink = async (href: string) => {
    await openExternalUrl(href);
  };

  const handleStartBinding = async (channel: ChannelWorkspaceItem) => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const session = await channelBindingSessionService.startBinding(channel.id);
      updateBindingSession(() => session);
      if (session.state === 'failed' || session.state === 'unsupported') {
        setErrorMessage(session.error || describeChannelsPageError(t, session.error, 'save'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedChannel || !effectiveInstanceId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const updatedChannels = await channelService.saveChannelConfig(
        effectiveInstanceId,
        selectedChannel.id,
        formData,
      );
      setChannels(updatedChannels);
      setSelectedChannelId(null);
      setFormData({});
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to save channel config:', error);
      setErrorMessage(describeChannelsPageError(t, error, 'save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!selectedChannel || !effectiveInstanceId) {
      return;
    }

    setErrorMessage(null);
    try {
      const updatedChannels = await channelService.deleteChannelConfig(
        effectiveInstanceId,
        selectedChannel.id,
      );
      setChannels(updatedChannels);
      setSelectedChannelId(null);
      setFormData({});
      setErrorMessage(null);
    } catch (error) {
      console.error('Failed to delete channel config:', error);
      setErrorMessage(describeChannelsPageError(t, error, 'delete'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="scrollbar-hide flex-1 overflow-y-auto p-4 md:p-6">
        <div className="w-full space-y-6">
          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          <ChannelWorkspace
            items={channelWorkspaceItems}
            variant="management"
            selectedChannelId={selectedChannel?.id || null}
            valuesByChannelId={selectedChannel ? { [selectedChannel.id]: formData } : {}}
            error={errorMessage}
            isSaving={isSaving}
            bindingSession={bindingSession}
            texts={{
              statusActive: t('channels.page.status.active'),
              statusConnected: t('dashboard.status.connected'),
              statusDisconnected: t('channels.page.status.disconnected'),
              statusNotConfigured: t('channels.page.status.notConfigured'),
              actionConnect: t('channels.page.actions.connect'),
              actionConfigure: t('channels.page.actions.configure'),
              actionDownloadApp: t('channels.page.actions.downloadApp'),
              actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
              actionEnableChannel: (name: string) =>
                t('channels.page.actions.enableChannel', { name }),
              metricConfiguredFields: t('instances.detail.instanceWorkbench.metrics.configuredFields'),
              metricSetupSteps: t('instances.detail.instanceWorkbench.metrics.setupSteps'),
              metricDeliveryState: t('instances.detail.instanceWorkbench.metrics.deliveryState'),
              stateEnabled: t('instances.detail.instanceWorkbench.state.enabled'),
              statePending: t('instances.detail.instanceWorkbench.state.pending'),
              summaryFallback: t('channels.page.subtitle'),
              panelEyebrow: t('channels.page.panel.configuration'),
              setupGuideTitle: t('channels.page.panel.setupGuide'),
              credentialsTitle: t('channels.page.panel.credentials'),
              qrConnectionTitle: t('channels.page.panel.qrConnectionTitle'),
              qrConnectionDescription: t('channels.page.panel.qrConnectionDescription'),
              qrConnectionAlt: t('channels.page.panel.qrConnectionAlt'),
              qrConnectionPending: t('channels.page.panel.qrConnectionPending'),
              qrConnectionHint: t('channels.page.panel.qrConnectionHint'),
              manualConfigurationAction: t('channels.page.panel.manualConfigurationAction'),
              saveAction: t('channels.page.actions.saveAndEnable'),
              savingAction: t('channels.page.actions.saving'),
              deleteConfigurationAction: t('channels.page.actions.deleteConfiguration'),
              validationRequiredField: (fieldLabel: string) =>
                t('channels.page.validation.requiredField', { field: fieldLabel }),
            }}
            emptyState={
              !effectiveInstanceId ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white/75 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/35 dark:text-zinc-400">
                  {t('channels.page.subtitle')}
                </div>
              ) : null
            }
            resolveOfficialLink={(channel) => getChannelOfficialLink(channel.id)}
            onOpenOfficialLink={(_channel, link) => void openOfficialLink(link.href)}
            onStartBinding={handleStartBinding}
            onSelectedChannelIdChange={handleSelectedChannelIdChange}
            onFieldChange={handleFieldChange}
            onSave={() => void handleSave()}
            onDeleteConfiguration={() => void handleDeleteConfig()}
            onToggleEnabled={(channel, nextEnabled) => {
              void handleToggleEnable(channel, nextEnabled);
            }}
          />
        </div>
      </div>
    </div>
  );
}
