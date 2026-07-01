import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Clock3,
  Copy,
  Flame,
  type LucideIcon,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, Input } from '@sdkwork/claw-ui';
import type { ClawRegistryEntry } from '../types';
import {
  buildRegistryConnectCommand,
  clawService,
  createRegistryCatalog,
  selectLatestRegistryEntries,
  selectPopularRegistryEntries,
  selectRecommendedRegistryEntries,
  type ClawRegistryCatalogEntry,
} from '../services';

function getEntryKindIcon(entry: Pick<ClawRegistryEntry, 'kind'>) {
  return entry.kind === 'agent' ? Bot : Network;
}

function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  return Promise.reject(new Error('Clipboard API unavailable.'));
}

function categoryName(
  categoryId: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  fallback?: string,
) {
  if (categoryId === 'All') {
    return t('clawCenter.allCategories');
  }

  const key = `clawCenter.categories.${categoryId}`;
  const translated = t(key);
  return translated === key ? fallback || categoryId : translated;
}

function formatUpdatedAt(value: string, locale: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function ClawCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeCategory, setActiveCategory] = useState('All');
  const [entries, setEntries] = useState<ClawRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const entryData = await clawService.getRegistryEntries();

        if (cancelled) {
          return;
        }

        setEntries(entryData);
      } catch (error) {
        console.error('Failed to load OpenClaw registry data:', error);
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
  }, []);

  const catalog = useMemo(
    () =>
      createRegistryCatalog({
        entries,
        keyword: deferredSearchQuery,
        activeCategory,
      }),
    [activeCategory, deferredSearchQuery, entries],
  );

  useEffect(() => {
    if (!catalog.categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [activeCategory, catalog.categories]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    });
    return counts;
  }, [entries]);

  const primaryEntry = catalog.entries[0] || entries[0] || null;
  const currentCommand = primaryEntry ? buildRegistryConnectCommand(primaryEntry) : '';
  const formatCount = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  const hasActiveFilters = Boolean(deferredSearchQuery.trim()) || activeCategory !== 'All';
  const activeCategoryLabel = categoryName(activeCategory, t);
  const rightRailSource = catalog.entries.length > 0 ? catalog.entries : entries;
  const latestEntries = useMemo(
    () => selectLatestRegistryEntries(rightRailSource, 4),
    [rightRailSource],
  );
  const popularEntries = useMemo(
    () => selectPopularRegistryEntries(rightRailSource, 4),
    [rightRailSource],
  );
  const recommendedEntries = useMemo(
    () => selectRecommendedRegistryEntries(rightRailSource, 4),
    [rightRailSource],
  );

  const searchSummary = deferredSearchQuery.trim()
    ? t('clawCenter.searchSummaryActive', {
        query: deferredSearchQuery.trim(),
        category: activeCategoryLabel,
        count: catalog.entries.length,
      })
    : t('clawCenter.searchSummaryIdle', {
        count: entries.length,
        categories: Math.max(catalog.categories.length - 1, 0),
      });

  const handleCopyCommand = async (entry: ClawRegistryEntry | null) => {
    if (!entry) {
      return;
    }

    try {
      await copyText(buildRegistryConnectCommand(entry));
      toast.success(t('clawCenter.messages.copySuccess', { name: entry.name }));
    } catch (error) {
      console.error(error);
      toast.error(t('clawCenter.messages.copyFailed'));
    }
  };

  const applySearchQuery = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const applyCategory = (value: string) => {
    startTransition(() => {
      setActiveCategory(value);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      setSearchQuery('');
      setActiveCategory('All');
    });
  };

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

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-950 pb-12 text-zinc-900 scrollbar-hide dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 pb-14 pt-4 sm:px-5 md:pb-16 lg:px-6 lg:pt-6 xl:px-8 2xl:px-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5 xl:p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(event) => applySearchQuery(event.target.value)}
                placeholder={t('clawCenter.searchPlaceholder')}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
              />
            </div>
            <Button
              size="lg"
              className="h-11 rounded-xl bg-zinc-950 px-4 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              onClick={() => navigate('/claw-upload')}
            >
              {t('clawCenter.actions.quickRegister')}
            </Button>
          </div>
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('clawCenter.labels.currentCommand')}
              </div>
              <button
                type="button"
                aria-label={t('clawCenter.actions.copyContent')}
                title={t('clawCenter.actions.copyContent')}
                onClick={() => void handleCopyCommand(primaryEntry)}
                disabled={!primaryEntry}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 break-all font-mono text-[12px] leading-6 text-zinc-700 dark:text-zinc-300">
              {currentCommand || '-'}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_320px] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('clawCenter.sections.categories')}
              </div>
              <div className="space-y-1.5">
                {catalog.categories.map((categoryId) => (
                  <button
                    key={categoryId}
                    type="button"
                    onClick={() => applyCategory(categoryId)}
                    className={`w-full rounded-[22px] border px-4 py-3 text-left transition-all ${
                      activeCategory === categoryId
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                        : 'border-transparent bg-zinc-50 text-zinc-700 hover:border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-zinc-800 dark:hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 truncate text-sm font-semibold">
                        {categoryName(categoryId, t)}
                      </div>
                      <div className="shrink-0 text-xs font-semibold opacity-80">
                        {categoryId === 'All' ? entries.length : categoryCounts.get(categoryId) || 0}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="min-w-0">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5 xl:p-6">
              <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 dark:border-zinc-800/80 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawCenter.sections.results')}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {searchSummary}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <Button variant="outline" className="rounded-2xl" onClick={resetFilters}>
                    {t('clawCenter.actions.clearFilters')}
                  </Button>
                ) : null}
              </div>
              {catalog.entries.length === 0 ? (
                <div className="mt-6 rounded-[26px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
                    <Search className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('clawCenter.emptyTitle')}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {t('clawCenter.emptyDescription')}
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 2xl:grid-cols-2">
                  {catalog.entries.map((entry) => (
                    <RegistryResultCard
                      key={entry.id}
                      entry={entry}
                      showSearchReasons={Boolean(deferredSearchQuery.trim())}
                      formatCount={formatCount}
                      onCopy={() => void handleCopyCommand(entry)}
                      onViewDetails={() => navigate(`/claw-center/${entry.id}`)}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <RegistryRailSection
              title={t('clawCenter.sections.latestClaw')}
              icon={Clock3}
              items={latestEntries}
              onViewDetails={(entry) => navigate(`/claw-center/${entry.id}`)}
              t={t}
              renderMeta={(entry) => formatUpdatedAt(entry.updatedAt, i18n.language)}
            />
            <RegistryRailSection
              title={t('clawCenter.sections.popularClaw')}
              icon={Flame}
              items={popularEntries}
              onViewDetails={(entry) => navigate(`/claw-center/${entry.id}`)}
              t={t}
              renderMeta={(entry) =>
                `${formatCount(entry.matchCount)} ${t('clawCenter.labels.matchCount').toLowerCase()}`
              }
            />
            <RegistryRailSection
              title={t('clawCenter.sections.recommendedClaw')}
              icon={Sparkles}
              items={recommendedEntries}
              onViewDetails={(entry) => navigate(`/claw-center/${entry.id}`)}
              t={t}
              renderMeta={(entry) => entry.bestFor[0] || categoryName(entry.category, t, entry.category)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function RegistryRailSection({
  title,
  icon: Icon,
  items,
  onViewDetails,
  renderMeta,
  t,
}: {
  title: string;
  icon: LucideIcon;
  items: ClawRegistryEntry[];
  onViewDetails: (entry: ClawRegistryEntry) => void;
  renderMeta: (entry: ClawRegistryEntry) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <Icon className="h-4 w-4" />
        </div>
        <span>{title}</span>
      </div>
      <div className="space-y-2">
        {items.map((entry) => (
          <button
            key={`${title}-${entry.id}`}
            type="button"
            onClick={() => onViewDetails(entry)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-primary-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-400/30 dark:hover:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                  {entry.name}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{renderMeta(entry)}</div>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {t(`clawCenter.kind.${entry.kind}`)}
              </span>
              {entry.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  {t('clawCenter.badges.verified')}
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RegistryResultCard({
  entry,
  showSearchReasons,
  formatCount,
  onCopy,
  onViewDetails,
  t,
}: {
  entry: ClawRegistryCatalogEntry;
  showSearchReasons: boolean;
  formatCount: (value: number) => string;
  onCopy: () => void;
  onViewDetails: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const Icon = getEntryKindIcon(entry);
  const localizedCategory = categoryName(entry.category, t, entry.category);

  return (
    <article className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-500/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-400/40 dark:hover:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
                {entry.name}
              </h3>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {t(`clawCenter.kind.${entry.kind}`)}
              </span>
              {entry.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  {t('clawCenter.badges.verified')}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span>{localizedCategory}</span>
              <span>{entry.region}</span>
              <span>{entry.latency}</span>
            </div>
          </div>
        </div>
        {entry.featured ? (
          <span className="rounded-full bg-amber-400/12 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-300/10 dark:text-amber-200">
            {t('clawCenter.badges.featured')}
          </span>
        ) : null}
      </div>

      {showSearchReasons && entry.matchReasons.length > 0 ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('clawCenter.labels.matchReasons')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {entry.matchReasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-200"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{entry.description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {entry.capabilities.slice(0, 3).map((capability) => (
          <span
            key={capability}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {capability}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label={t('clawCenter.labels.matchCount')} value={formatCount(entry.matchCount)} compact />
        <MetricCard label={t('clawCenter.labels.activeAgents')} value={formatCount(entry.activeAgents)} compact />
        <MetricCard label={t('clawCenter.labels.bestFor')} value={entry.bestFor[0] || '-'} compact />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
        <Button variant="outline" className="rounded-2xl" onClick={onCopy}>
          <Copy className="h-4 w-4" />
          {t('clawCenter.actions.copyEntryCommand')}
        </Button>
        <Button className="rounded-2xl" onClick={onViewDetails}>
          {t('clawCenter.actions.viewDetails')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={`mt-2 font-bold text-zinc-950 dark:text-white ${compact ? 'text-sm' : 'text-3xl'}`}>
        {value}
      </div>
    </div>
  );
}
