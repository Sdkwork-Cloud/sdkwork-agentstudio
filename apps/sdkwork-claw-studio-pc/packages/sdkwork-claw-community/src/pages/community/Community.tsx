import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  BadgeAlert,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChevronRight,
  Clock3,
  Code2,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  Languages,
  Lightbulb,
  MapPin,
  Megaphone,
  Newspaper,
  Palette,
  Scale,
  Search,
  Send,
  Users,
  Wallet,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button, Input } from '@sdkwork/claw-ui';
import {
  type CommunityCategory,
  type CommunityDeliveryMode,
  type CommunityPost,
  type CommunityServiceLine,
  communityService,
} from '../../services';

const CATEGORY_CONFIG: Array<{
  id: CommunityCategory;
  labelKey: string;
  summaryKey: string;
  icon: typeof Users;
}> = [
  {
    id: 'job-seeking',
    labelKey: 'community.page.categories.jobSeeking',
    summaryKey: 'community.page.categorySummaries.jobSeeking',
    icon: Users,
  },
  {
    id: 'recruitment',
    labelKey: 'community.page.categories.recruitment',
    summaryKey: 'community.page.categorySummaries.recruitment',
    icon: BriefcaseBusiness,
  },
  {
    id: 'services',
    labelKey: 'community.page.categories.services',
    summaryKey: 'community.page.categorySummaries.services',
    icon: Wrench,
  },
  {
    id: 'partnerships',
    labelKey: 'community.page.categories.partnerships',
    summaryKey: 'community.page.categorySummaries.partnerships',
    icon: Handshake,
  },
  {
    id: 'news',
    labelKey: 'community.page.categories.news',
    summaryKey: 'community.page.categorySummaries.news',
    icon: Newspaper,
  },
];

const CATEGORY_BADGE_STYLES: Record<CommunityCategory, string> = {
  'job-seeking': 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  recruitment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  services: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  partnerships: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  news: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

const SERVICE_CATALOG_CONFIG: Array<{
  id: CommunityServiceLine;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}> = [
  {
    id: 'legal',
    titleKey: 'community.page.serviceCatalog.items.legal.title',
    descriptionKey: 'community.page.serviceCatalog.items.legal.description',
    icon: Scale,
  },
  {
    id: 'tax',
    titleKey: 'community.page.serviceCatalog.items.tax.title',
    descriptionKey: 'community.page.serviceCatalog.items.tax.description',
    icon: Calculator,
  },
  {
    id: 'design',
    titleKey: 'community.page.serviceCatalog.items.design.title',
    descriptionKey: 'community.page.serviceCatalog.items.design.description',
    icon: Palette,
  },
  {
    id: 'development',
    titleKey: 'community.page.serviceCatalog.items.development.title',
    descriptionKey: 'community.page.serviceCatalog.items.development.description',
    icon: Code2,
  },
  {
    id: 'marketing',
    titleKey: 'community.page.serviceCatalog.items.marketing.title',
    descriptionKey: 'community.page.serviceCatalog.items.marketing.description',
    icon: Megaphone,
  },
  {
    id: 'translation',
    titleKey: 'community.page.serviceCatalog.items.translation.title',
    descriptionKey: 'community.page.serviceCatalog.items.translation.description',
    icon: Languages,
  },
  {
    id: 'operations',
    titleKey: 'community.page.serviceCatalog.items.operations.title',
    descriptionKey: 'community.page.serviceCatalog.items.operations.description',
    icon: Workflow,
  },
  {
    id: 'training',
    titleKey: 'community.page.serviceCatalog.items.training.title',
    descriptionKey: 'community.page.serviceCatalog.items.training.description',
    icon: GraduationCap,
  },
  {
    id: 'consulting',
    titleKey: 'community.page.serviceCatalog.items.consulting.title',
    descriptionKey: 'community.page.serviceCatalog.items.consulting.description',
    icon: Lightbulb,
  },
  {
    id: 'content',
    titleKey: 'community.page.serviceCatalog.items.content.title',
    descriptionKey: 'community.page.serviceCatalog.items.content.description',
    icon: FileText,
  },
  {
    id: 'data',
    titleKey: 'community.page.serviceCatalog.items.data.title',
    descriptionKey: 'community.page.serviceCatalog.items.data.description',
    icon: Database,
  },
  {
    id: 'hr',
    titleKey: 'community.page.serviceCatalog.items.hr.title',
    descriptionKey: 'community.page.serviceCatalog.items.hr.description',
    icon: Users,
  },
];

const SERVICE_LINE_LABEL_KEYS: Record<CommunityServiceLine, string> = {
  legal: 'community.page.serviceCatalog.items.legal.title',
  tax: 'community.page.serviceCatalog.items.tax.title',
  design: 'community.page.serviceCatalog.items.design.title',
  development: 'community.page.serviceCatalog.items.development.title',
  marketing: 'community.page.serviceCatalog.items.marketing.title',
  translation: 'community.page.serviceCatalog.items.translation.title',
  operations: 'community.page.serviceCatalog.items.operations.title',
  training: 'community.page.serviceCatalog.items.training.title',
  consulting: 'community.page.serviceCatalog.items.consulting.title',
  content: 'community.page.serviceCatalog.items.content.title',
  data: 'community.page.serviceCatalog.items.data.title',
  hr: 'community.page.serviceCatalog.items.hr.title',
};

const DELIVERY_MODE_LABEL_KEYS: Record<CommunityDeliveryMode, string> = {
  online: 'community.newPost.deliveryModes.online',
  hybrid: 'community.newPost.deliveryModes.hybrid',
  onsite: 'community.newPost.deliveryModes.onsite',
};

function formatPostDate(createdAt: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(createdAt));
  } catch {
    return createdAt;
  }
}

function communityCategoryLabel(
  categoryId: CommunityCategory,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const config = CATEGORY_CONFIG.find((item) => item.id === categoryId);
  return config ? t(config.labelKey) : categoryId;
}

function entriesFromCategories(...groups: CommunityPost[][]) {
  const deduped = new Map<string, CommunityPost>();

  groups.flat().forEach((entry) => {
    deduped.set(entry.id, entry);
  });

  return [...deduped.values()];
}

export function Community() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<CommunityCategory>('recruitment');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [urgentRecruitment, setUrgentRecruitment] = useState<CommunityPost[]>([]);
  const [newsEntries, setNewsEntries] = useState<CommunityPost[]>([]);
  const [serviceEntries, setServiceEntries] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchPosts = async () => {
      setLoading(true);

      try {
        const [nextPosts, nextRecruitment, nextNews, nextServices] = await Promise.all([
          communityService.getPosts(activeCategory, deferredSearchQuery),
          communityService.getPosts('recruitment'),
          communityService.getPosts('news'),
          communityService.getPosts('services'),
        ]);

        if (!active) {
          return;
        }

        setPosts(nextPosts);
        setUrgentRecruitment(nextRecruitment.slice(0, 4));
        setNewsEntries(nextNews.slice(0, 4));
        setServiceEntries(nextServices);
      } catch (error) {
        console.error('Failed to fetch community entries:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void fetchPosts();
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeCategory, deferredSearchQuery]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<CommunityCategory, number>();
    entriesFromCategories(serviceEntries, urgentRecruitment, newsEntries, posts).forEach((entry) => {
      counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
    });

    return counts;
  }, [newsEntries, posts, serviceEntries, urgentRecruitment]);

  const activeCategorySummary = CATEGORY_CONFIG.find((item) => item.id === activeCategory);
  const isNewsMode = activeCategory === 'news';
  const isServiceMode = activeCategory === 'services';
  const formatCount = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  const hasActiveFilters = Boolean(deferredSearchQuery.trim()) || activeCategory !== 'recruitment';
  const onlineServiceEntries = useMemo(
    () => serviceEntries.filter((post) => post.deliveryMode === 'online' || post.deliveryMode === 'hybrid'),
    [serviceEntries],
  );
  const serviceCatalog = useMemo(
    () =>
      SERVICE_CATALOG_CONFIG.map((item) => ({
        ...item,
        count: serviceEntries.filter((post) => post.serviceLine === item.id).length,
      })),
    [serviceEntries],
  );

  const applySearchQuery = (value: string) => {
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const applyCategory = (value: CommunityCategory) => {
    startTransition(() => {
      setActiveCategory(value);
    });
  };

  const resetFilters = () => {
    startTransition(() => {
      setSearchQuery('');
      setActiveCategory('recruitment');
    });
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 p-8 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-zinc-500 dark:text-zinc-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <div className="text-sm">{t('community.page.loadingPosts')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 pb-12 text-zinc-900 scrollbar-hide dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 pb-14 pt-4 sm:px-5 md:pb-16 lg:px-6 lg:pt-6 xl:px-8 2xl:px-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5 xl:p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {t('community.page.feedEyebrow')}
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white md:text-3xl">
                {t('community.page.title')}
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                {t('community.page.subtitle')}
              </p>
            </div>
            <Button
              size="lg"
              className="h-11 rounded-xl bg-zinc-950 px-4 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              onClick={() => navigate('/community/new')}
            >
              <Send className="h-4 w-4" />
              {t('community.page.newPost')}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(event) => applySearchQuery(event.target.value)}
                placeholder={t('community.page.searchPlaceholder')}
                className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-11 pr-4 text-sm shadow-none focus-visible:border-primary-300 focus-visible:bg-white focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900 dark:focus-visible:border-primary-500/30"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {communityCategoryLabel(activeCategory, t)}
              </span>
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {formatCount(posts.length)}
              </span>
              {deferredSearchQuery.trim() ? (
                <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  "{deferredSearchQuery.trim()}"
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_320px] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('community.page.feed.title')}
              </div>
              <div className="space-y-1.5">
                {CATEGORY_CONFIG.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => applyCategory(category.id)}
                      className={`w-full rounded-[22px] border px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                          : 'border-transparent bg-zinc-50 text-zinc-700 hover:border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-950/60 dark:text-zinc-300 dark:hover:border-zinc-800 dark:hover:bg-zinc-950'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                            isActive
                              ? 'bg-white/12 text-white dark:bg-zinc-900 dark:text-zinc-100'
                              : 'bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-semibold">{t(category.labelKey)}</div>
                            <div className="shrink-0 text-xs font-semibold opacity-80">
                              {formatCount(categoryCounts.get(category.id) || 0)}
                            </div>
                          </div>
                          <div
                            className={`mt-1 text-xs leading-5 ${
                              isActive ? 'text-white/72 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {t(category.summaryKey)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          <main className="min-w-0">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5 xl:p-6">
              <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 dark:border-zinc-800/80 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {t('community.page.feedEyebrow')}
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {activeCategorySummary ? t(activeCategorySummary.labelKey) : t('community.page.feed.title')}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {activeCategorySummary ? t(activeCategorySummary.summaryKey) : t('community.page.feed.description')}
                  </p>
                </div>
                {hasActiveFilters ? (
                  <Button variant="outline" className="rounded-2xl" onClick={resetFilters}>
                    {t('common.reset')}
                  </Button>
                ) : null}
              </div>

              {isServiceMode ? (
                <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div className="flex flex-col gap-3 border-b border-zinc-200/80 pb-4 dark:border-zinc-800/80 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {t('community.page.serviceCatalog.title')}
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                        {t('community.page.serviceCatalog.description')}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      {formatCount(onlineServiceEntries.length)} {t('community.page.rails.onlineServices')}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {serviceCatalog.map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applySearchQuery(item.id)}
                          className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-primary-500/30 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-500/30 dark:hover:bg-zinc-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {formatCount(item.count)}
                            </span>
                          </div>
                          <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            {t(item.titleKey)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                            {t(item.descriptionKey)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {loading ? (
                <div className="mt-6 rounded-[26px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t('community.page.loadingPosts')}
                  </p>
                </div>
              ) : posts.length > 0 ? (
                <div className="mt-6 grid gap-4 2xl:grid-cols-2">
                  {posts.map((post) => (
                    <CommunityResultCard
                      key={post.id}
                      post={post}
                      isNewsMode={isNewsMode}
                      locale={i18n.language}
                      onOpen={() => navigate(`/community/${post.id}`)}
                      t={t}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[26px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-950">
                    <Search className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                    {t('community.page.emptyTitle')}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {t('community.page.emptyDescription')}
                  </p>
                </div>
              )}
            </section>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <CommunityRailSection
              title={t('community.page.rails.urgentRecruitment')}
              icon={Clock3}
              items={urgentRecruitment}
              onOpen={(post) => navigate(`/community/${post.id}`)}
              secondaryValue={(post) => [post.location, post.compensation].filter(Boolean).join(' / ')}
            />
            <CommunityRailSection
              title={t('community.page.rails.onlineServices')}
              icon={Wrench}
              items={onlineServiceEntries.slice(0, 4)}
              onOpen={(post) => navigate(`/community/${post.id}`)}
              secondaryValue={(post) =>
                [
                  post.deliveryMode ? t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode]) : null,
                  post.turnaround,
                ]
                  .filter(Boolean)
                  .join(' / ')
              }
              tagValue={(post) =>
                post.serviceLine ? t(SERVICE_LINE_LABEL_KEYS[post.serviceLine]) : undefined
              }
            />
            <CommunityRailSection
              title={t('community.page.rails.platformNews')}
              icon={Newspaper}
              items={newsEntries}
              onOpen={(post) => navigate(`/community/${post.id}`)}
              secondaryValue={(post) => formatPostDate(post.createdAt, i18n.language)}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function CommunityRailSection({
  title,
  icon: Icon,
  items,
  onOpen,
  secondaryValue,
  tagValue,
}: {
  title: string;
  icon: LucideIcon;
  items: CommunityPost[];
  onOpen: (post: CommunityPost) => void;
  secondaryValue: (post: CommunityPost) => string;
  tagValue?: (post: CommunityPost) => string | undefined;
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
        {items.map((post) => {
          const tag = tagValue?.(post);

          return (
            <button
              key={`${title}-${post.id}`}
              type="button"
              onClick={() => onOpen(post)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-primary-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-400/30 dark:hover:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
                    {post.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {secondaryValue(post)}
                  </div>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              </div>
              {tag ? (
                <div className="mt-2">
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {tag}
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommunityResultCard({
  post,
  isNewsMode,
  locale,
  onOpen,
  t,
}: {
  post: CommunityPost;
  isNewsMode: boolean;
  locale: string;
  onOpen: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <article className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-500/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-primary-400/40 dark:hover:shadow-none">
      <div className="flex flex-col gap-5 lg:flex-row">
        {post.coverImage ? (
          <div className="h-44 overflow-hidden rounded-2xl lg:w-[14rem] lg:shrink-0">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${CATEGORY_BADGE_STYLES[post.category]}`}>
              {communityCategoryLabel(post.category, t)}
            </span>
            {post.isFeatured ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                {t('community.page.featuredBadge')}
              </span>
            ) : null}
            {post.publisherType === 'official' ? (
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {t('community.page.officialBadge')}
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {post.title}
          </h3>
          <p className="mt-3 line-clamp-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {post.content.replace(/<[^>]*>?/gm, '')}
          </p>

          <div className="mt-4 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
            {post.location ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.location')}: {post.location}
                </span>
              </div>
            ) : null}
            {post.compensation ? (
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.compensation')}: {post.compensation}
                </span>
              </div>
            ) : null}
            {post.company ? (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.company')}: {post.company}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <BadgeAlert className="h-4 w-4 text-zinc-400" />
              <span>
                {t('community.page.meta.publisher')}: {post.author.name}
              </span>
            </div>
            {post.serviceLine ? (
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.serviceLine')}: {t(SERVICE_LINE_LABEL_KEYS[post.serviceLine])}
                </span>
              </div>
            ) : null}
            {post.deliveryMode ? (
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.deliveryMode')}: {t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode])}
                </span>
              </div>
            ) : null}
            {post.turnaround ? (
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-zinc-400" />
                <span>
                  {t('community.page.meta.turnaround')}: {post.turnaround}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              <span>{formatPostDate(post.createdAt, locale)}</span>
              <span className="text-zinc-400">/</span>
              <span>{isNewsMode ? t('community.page.listing.readMore') : t('community.page.listing.openclawAction')}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
