import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { motion } from 'motion/react';
import {
  Bot,
  Cable,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Puzzle,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, Input } from '@sdkwork/claw-ui';
import { extensionService, type Extension } from '../../services';

type ExtensionTab = 'discover' | 'installed';

function getCategoryIcon(category: Extension['category']) {
  if (category === 'provider') {
    return Bot;
  }

  if (category === 'channel') {
    return Cable;
  }

  return Puzzle;
}

function getCategoryLabelKey(category: Extension['category']) {
  if (category === 'provider') {
    return 'extensions.page.labels.provider';
  }

  if (category === 'channel') {
    return 'extensions.page.labels.channel';
  }

  return 'extensions.page.labels.plugin';
}

function getSourceTone(source: Extension['source']) {
  if (source === 'bundled') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
}

function getStatusTone(installed: boolean) {
  if (installed) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function resolveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'Unknown error';
}

export function Extensions() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTab, setActiveTab] = useState<ExtensionTab>('discover');
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingExtensionId, setProcessingExtensionId] = useState<string | null>(null);

  const loadExtensions = useEffectEvent(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await extensionService.getExtensions({
        page: 1,
        pageSize: 500,
      });
      startTransition(() => {
        setExtensions(result.items);
      });
    } catch (error) {
      console.error('Failed to load extensions:', error);
      setLoadError(resolveErrorMessage(error));
      startTransition(() => {
        setExtensions([]);
      });
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void loadExtensions();
  }, [loadExtensions]);

  const filteredExtensions = useMemo(() => {
    const keyword = deferredSearchQuery.trim().toLowerCase();
    return extensions.filter((extension) => {
      const matchesTab = activeTab === 'discover' ? true : extension.installed;
      if (!matchesTab) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [
        extension.id,
        extension.name,
        extension.description,
        extension.author,
        extension.version,
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [activeTab, deferredSearchQuery, extensions]);

  const installedCount = extensions.filter((extension) => extension.installed).length;
  const bundledCount = extensions.filter((extension) => extension.source === 'bundled').length;
  const localCount = extensions.filter((extension) => extension.source === 'local').length;

  const handleInstall = async (extension: Extension) => {
    setProcessingExtensionId(extension.id);

    try {
      await extensionService.installExtension(extension.id);
      await loadExtensions();
      toast.success(t('extensions.page.toasts.installSuccess'));
    } catch (error) {
      console.error('Failed to install extension:', error);
      toast.error(t('extensions.page.toasts.installFailed'));
    } finally {
      setProcessingExtensionId(null);
    }
  };

  const handleUninstall = async (extension: Extension) => {
    if (!window.confirm(t('extensions.page.confirmUninstall', { name: extension.name }))) {
      return;
    }

    setProcessingExtensionId(extension.id);

    try {
      await extensionService.uninstallExtension(extension.id);
      await loadExtensions();
      toast.success(t('extensions.page.toasts.uninstallSuccess'));
    } catch (error) {
      console.error('Failed to uninstall extension:', error);
      toast.error(t('extensions.page.toasts.uninstallFailed'));
    } finally {
      setProcessingExtensionId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 scrollbar-hide dark:bg-zinc-950">
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-8 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-500 text-white shadow-lg shadow-sky-500/20">
              <Puzzle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('extensions.page.title')}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('extensions.page.summary.eyebrow')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('discover')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  activeTab === 'discover'
                    ? 'rounded-lg bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
              >
                {t('extensions.page.tabs.discover')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('installed')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  activeTab === 'installed'
                    ? 'rounded-lg bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
              >
                {t('extensions.page.tabs.installed')}
              </button>
            </div>

            <div className="group relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-sky-500 dark:text-zinc-500" />
              <Input
                type="text"
                placeholder={t('extensions.page.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="rounded-xl bg-zinc-100/80 py-2 pl-9 pr-4 font-medium focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-sky-500/20 focus-visible:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-800/80 dark:focus-visible:bg-zinc-900 dark:focus-visible:ring-offset-0"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void loadExtensions();
              }}
              disabled={isLoading || processingExtensionId !== null}
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('extensions.page.actions.refresh')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-sky-200/60 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(240,249,255,0.98))] p-8 shadow-[0_24px_80px_-48px_rgba(14,165,233,0.55)] dark:border-sky-500/20 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]">
          <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.14),_transparent_60%)] lg:block" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
                {t('extensions.page.summary.eyebrow')}
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-4xl">
                {t('extensions.page.summary.title')}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
                {t('extensions.page.summary.description')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {t('extensions.page.summary.metrics.bundled')}
                </div>
                <div className="mt-2 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {bundledCount}
                </div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {t('extensions.page.summary.metrics.installed')}
                </div>
                <div className="mt-2 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {installedCount}
                </div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {t('extensions.page.summary.metrics.local')}
                </div>
                <div className="mt-2 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {localCount}
                </div>
              </div>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <div className="font-semibold">{t('extensions.page.errors.runtimeUnavailable')}</div>
            <div className="mt-1 opacity-80">{loadError}</div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-[1.5rem] border border-zinc-200 bg-white/80 px-4 py-20 dark:border-zinc-800 dark:bg-zinc-900/70">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-sky-500" />
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {t('common.loading')}
            </span>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-200 bg-white/70 px-6 py-20 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <FolderOpen className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {t('extensions.page.empty.title')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              {t('extensions.page.empty.description')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredExtensions.map((extension, index) => {
              const Icon = getCategoryIcon(extension.category);
              const isProcessing = processingExtensionId === extension.id;

              return (
                <motion.article
                  key={extension.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex h-full flex-col rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                            {extension.name}
                          </h3>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSourceTone(extension.source)}`}
                          >
                            {extension.source === 'bundled'
                              ? t('extensions.page.labels.bundled')
                              : t('extensions.page.labels.local')}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(extension.installed)}`}
                          >
                            {extension.installed
                              ? t('extensions.page.labels.installed')
                              : t('extensions.page.labels.notInstalled')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          {extension.author}
                        </p>
                      </div>
                    </div>

                    {extension.installed ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void handleUninstall(extension);
                        }}
                        disabled={isProcessing || isLoading}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {t('extensions.page.actions.uninstall')}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => {
                          void handleInstall(extension);
                        }}
                        disabled={isProcessing || isLoading || extension.source !== 'bundled'}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {t('common.install')}
                      </Button>
                    )}
                  </div>

                  <p className="mt-5 flex-1 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                    {extension.description}
                  </p>

                  <dl className="mt-6 grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/50 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('extensions.page.labels.category')}
                      </dt>
                      <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {t(getCategoryLabelKey(extension.category))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('extensions.page.labels.version')}
                      </dt>
                      <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {extension.version}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('extensions.page.labels.origin')}
                      </dt>
                      <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {extension.source === 'bundled'
                          ? t('extensions.page.labels.bundled')
                          : t('extensions.page.labels.local')}
                      </dd>
                    </div>
                  </dl>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
