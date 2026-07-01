import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  Globe,
  MessageSquare,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useInstanceStore } from '@sdkwork/claw-core';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import { Button, Input, OverlaySurface } from '@sdkwork/claw-ui';
import type {
  ClawDetailData,
  ClawInstance,
  ClawRegistryQuickConnectState,
} from '../types';
import {
  buildRegistryConnectCommand,
  clawChatService,
  clawService,
  type ClawChatMessage,
} from '../services';

function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  return Promise.reject(new Error('Clipboard API unavailable.'));
}

export function ClawDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setActiveInstanceId = useInstanceStore((state) => state.setActiveInstanceId);
  const translateOrFallback = (key: string, fallback: string) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [entry, setEntry] = useState<ClawDetailData | null>(null);
  const [relatedEntries, setRelatedEntries] = useState<ClawInstance[]>([]);
  const [quickConnectState, setQuickConnectState] =
    useState<ClawRegistryQuickConnectState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ClawChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isChatOpen, isTyping, messages]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      try {
        const [detail, entries, quickConnect] = await Promise.all([
          clawService.getRegistryDetail(id),
          clawService.getRegistryEntries(),
          clawService.getQuickConnectState(),
        ]);

        if (cancelled) {
          return;
        }

        setEntry(detail);
        setQuickConnectState(quickConnect);
        setRelatedEntries(
          detail
            ? entries.filter((item) => detail.relatedIds.includes(item.id))
            : [],
        );

        if (detail) {
          const initialMessages = await clawChatService.getInitialMessages(
            detail.id,
            t('clawDetail.chat.welcome', { name: detail.name }),
          );
          if (!cancelled) {
            setMessages(initialMessages);
          }
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load OpenClaw registry detail:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const handleQuickConnect = () => {
    if (!quickConnectState) {
      navigate('/docs#script');
      return;
    }

    try {
      if (quickConnectState.action.kind === 'chat') {
        setActiveInstanceId(quickConnectState.action.instanceId);
      }

      navigate(quickConnectState.action.to);
    } catch (error) {
      console.error(error);
      toast.error(t('clawDetail.messages.quickConnectFailed'));
    }
  };

  const handleCopyCommand = async () => {
    if (!entry) {
      return;
    }

    try {
      await copyText(buildRegistryConnectCommand(entry));
      toast.success(
        t('clawDetail.messages.copySuccess', {
          name: entry.name,
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error(t('clawDetail.messages.copyFailed'));
    }
  };

  const handleOpenExternal = async (href?: string | null) => {
    if (!href) {
      return;
    }

    try {
      await openExternalUrl(href);
    } catch (error: any) {
      toast.error(error?.message || t('clawDetail.messages.openExternalFailed'));
    }
  };

  const sendMessage = async () => {
    if (!entry || !inputValue.trim()) {
      return;
    }

    const userMessageText = inputValue.trim();
    const userMessage: ClawChatMessage = {
      id: `${entry.id}-${Date.now()}`,
      sender: 'user',
      text: userMessageText,
      time: new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await clawChatService.sendMessage(entry.id, userMessageText);
      response.text = t('clawDetail.chat.autoReply', { name: entry.name });
      setMessages((previous) => [...previous, response]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const command = entry ? buildRegistryConnectCommand(entry) : '';
  const quickConnectTitle =
    quickConnectState?.action.kind === 'chat'
      ? t('clawDetail.quickConnect.chatTitle')
      : quickConnectState?.action.kind === 'instance'
        ? t('clawDetail.quickConnect.instanceTitle')
        : t('clawDetail.quickConnect.installTitle');

  const statCards = useMemo(
    () =>
      entry
        ? [
            {
              label: t('clawDetail.stats.matches'),
              value: new Intl.NumberFormat().format(entry.matchCount),
            },
            {
              label: t('clawDetail.stats.activeAgents'),
              value: new Intl.NumberFormat().format(entry.activeAgents),
            },
            {
              label: t('clawDetail.stats.region'),
              value: entry.region,
            },
            {
              label: t('clawDetail.stats.latency'),
              value: entry.latency,
            },
          ]
        : [],
    [entry, t],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-8">
        <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <div className="text-sm">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-200 bg-white px-8 py-14 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {t('clawDetail.notFound.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
            {t('clawDetail.notFound.description')}
          </p>
          <Button
            className="mt-8 rounded-2xl"
            onClick={() => navigate('/claw-center')}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('clawDetail.notFound.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 pb-12 scrollbar-hide">
      <div className="mx-auto flex w-full max-w-[min(1760px,_calc(100vw-2rem))] flex-col gap-6 px-4 pb-14 pt-4 sm:px-5 md:pb-16 lg:px-6 lg:pt-6 xl:px-8 2xl:px-10">
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="px-6 py-6 md:px-8 md:py-8">
            <button
              type="button"
              onClick={() => navigate('/claw-center')}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('clawDetail.back')}
            </button>

            <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-300/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    {t(`clawDetail.kind.${entry.kind}`)}
                  </span>
                  <span className="rounded-full border border-zinc-300/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    {translateOrFallback(`clawCenter.categories.${entry.category}`, entry.category)}
                  </span>
                  {entry.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      {t('clawDetail.badges.verified')}
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950 dark:text-white md:text-5xl">
                  {entry.name}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-600 dark:text-zinc-300 md:text-lg">
                  {entry.summary}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-zinc-500 dark:text-zinc-400">
                  {entry.description}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  className="h-12 rounded-2xl"
                  onClick={handleQuickConnect}
                >
                  <Zap className="h-4 w-4" />
                  {t('clawDetail.actions.quickConnect')}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={() => void handleCopyCommand()}
                >
                  <Copy className="h-4 w-4" />
                  {t('clawDetail.actions.copyCommand')}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={() => void handleOpenExternal(entry.docsUrl)}
                >
                  <Globe className="h-4 w-4" />
                  {t('clawDetail.actions.openDocs')}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl"
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageSquare className="h-4 w-4" />
                  {t('clawDetail.actions.openMatchmaking')}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {item.label}
                  </div>
                  <div className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('clawDetail.sections.overviewEyebrow')}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawDetail.sections.overview')}
                  </h2>
                </div>
              </div>

              <p className="mt-5 text-sm leading-8 text-zinc-600 dark:text-zinc-300">
                {entry.overview}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t('clawDetail.labels.bestFor')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.bestFor.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t('clawDetail.labels.trustHighlights')}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {entry.trustHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('clawDetail.sections.matchingEyebrow')}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawDetail.sections.matching')}
                  </h2>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t('clawDetail.labels.capabilities')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t('clawDetail.labels.integrations')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.integrations.map((integration) => (
                      <span
                        key={integration}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {t('clawDetail.labels.matchingNotes')}
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {entry.matchingNotes.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('clawDetail.sections.onboardingEyebrow')}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawDetail.sections.onboarding')}
                  </h2>
                </div>
              </div>

              <ol className="mt-5 grid gap-4 md:grid-cols-3">
                {entry.onboarding.map((item, index) => (
                  <li
                    key={item}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                      {item}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    {t('clawDetail.sections.connectEyebrow')}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawDetail.sections.connect')}
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                  <Zap className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  {
                    label: t('clawDetail.connection.gateway'),
                    value: entry.connection.gatewayUrl || '-',
                  },
                  {
                    label: t('clawDetail.connection.websocket'),
                    value: entry.connection.websocketUrl || '-',
                  },
                  {
                    label: t('clawDetail.connection.authMode'),
                    value: t(`clawDetail.authMode.${entry.connection.authMode}`),
                  },
                  {
                    label: t('clawDetail.connection.session'),
                    value: entry.connection.defaultSession || '-',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {item.label}
                    </div>
                    <div className="mt-2 break-all text-sm text-zinc-700 dark:text-zinc-300">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-950 px-4 py-4 text-zinc-100 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    {t('clawDetail.connection.command')}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyCommand()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300 transition-colors hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {t('clawDetail.actions.copyCommand')}
                  </button>
                </div>
                <div className="mt-3 break-all font-mono text-[12px] leading-6 text-zinc-200">
                  {command}
                </div>
                {entry.connection.commandHint ? (
                  <p className="mt-3 text-xs leading-6 text-zinc-400">
                    {entry.connection.commandHint}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 rounded-[24px] border border-amber-300/40 bg-amber-50 px-4 py-4 dark:border-amber-300/20 dark:bg-amber-300/10">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                  {t('clawDetail.quickConnect.eyebrow')}
                </div>
                <div className="mt-2 text-lg font-bold text-amber-900 dark:text-amber-100">
                  {quickConnectTitle}
                </div>
                <p className="mt-2 text-sm leading-7 text-amber-800 dark:text-amber-200/90">
                  {quickConnectState?.action.kind === 'chat'
                    ? t('clawDetail.quickConnect.chatDescription')
                    : quickConnectState?.action.kind === 'instance'
                      ? t('clawDetail.quickConnect.instanceDescription')
                      : t('clawDetail.quickConnect.installDescription')}
                </p>
                <Button
                  className="mt-4 w-full rounded-2xl"
                  onClick={handleQuickConnect}
                >
                  <ArrowRight className="h-4 w-4" />
                  {t('clawDetail.actions.quickConnectNow')}
                </Button>
              </div>
            </section>

            {relatedEntries.length > 0 ? (
              <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {t('clawDetail.sections.relatedEyebrow')}
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {t('clawDetail.sections.related')}
                </h2>

                <div className="mt-5 space-y-3">
                  {relatedEntries.map((related) => (
                    <button
                      key={related.id}
                      type="button"
                      onClick={() => navigate(`/claw-center/${related.id}`)}
                      className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-left transition-colors hover:border-primary-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-primary-400/30 dark:hover:bg-zinc-950"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {related.name}
                          </div>
                          <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                            {related.summary}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      <OverlaySurface
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        variant="drawer"
        className="max-w-[420px] bg-white dark:bg-zinc-900"
        backdropClassName="bg-black/30"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
              {t('clawDetail.chat.title', { name: entry.name })}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t('clawDetail.chat.subtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsChatOpen(false)}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/60 p-6 dark:bg-zinc-950/50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender === 'user'
                    ? 'rounded-tr-sm bg-primary-600 text-white'
                    : 'rounded-tl-sm border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                {message.text}
              </div>
              <span className="mt-1 text-[10px] text-zinc-400">{message.time}</span>
            </div>
          ))}

          {isTyping ? (
            <div className="flex items-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                <div
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full p-2 text-zinc-400 transition-colors hover:text-primary-600"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <Input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void sendMessage();
                }
              }}
              placeholder={t('clawDetail.chat.placeholder')}
              className="flex-1 rounded-full border-none bg-zinc-100 px-4 py-2.5 shadow-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-0 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!inputValue.trim()}
              className="rounded-full bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </OverlaySurface>
    </div>
  );
}
