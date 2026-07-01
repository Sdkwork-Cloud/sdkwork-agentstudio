import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  ChevronRight,
  Clock3,
  MapPin,
  MessageSquare,
  Send,
  Share2,
  Sparkles,
} from 'lucide-react';
import { Button, MarkdownContent, Textarea } from '@sdkwork/claw-ui';
import {
  buildCommunityRecommendations,
  communityService,
  buildCommunitySharePayload,
  mergeCommunityComments,
  type CommunityCategory,
  type CommunityComment,
  type CommunityCompanyRecommendation,
  type CommunityDeliveryMode,
  type CommunityPost,
  type CommunityPublisherType,
  type CommunityRecommendationReason,
  type CommunityServiceRecommendation,
  type CommunityServiceLine,
  toggleCommunityPostBookmark,
} from '../../services';
import { toast } from 'sonner';

const SERVICE_LINE_LABEL_KEYS: Record<CommunityServiceLine, string> = {
  legal: 'community.postDetail.listingMeta.serviceLines.legal',
  tax: 'community.postDetail.listingMeta.serviceLines.tax',
  design: 'community.postDetail.listingMeta.serviceLines.design',
  development: 'community.postDetail.listingMeta.serviceLines.development',
  marketing: 'community.postDetail.listingMeta.serviceLines.marketing',
  translation: 'community.postDetail.listingMeta.serviceLines.translation',
  operations: 'community.postDetail.listingMeta.serviceLines.operations',
  training: 'community.postDetail.listingMeta.serviceLines.training',
  consulting: 'community.postDetail.listingMeta.serviceLines.consulting',
  content: 'community.postDetail.listingMeta.serviceLines.content',
  data: 'community.postDetail.listingMeta.serviceLines.data',
  hr: 'community.postDetail.listingMeta.serviceLines.hr',
};

const DELIVERY_MODE_LABEL_KEYS: Record<CommunityDeliveryMode, string> = {
  online: 'community.postDetail.listingMeta.deliveryModes.online',
  hybrid: 'community.postDetail.listingMeta.deliveryModes.hybrid',
  onsite: 'community.postDetail.listingMeta.deliveryModes.onsite',
};

const PUBLISHER_TYPE_LABEL_KEYS: Record<CommunityPublisherType, string> = {
  personal: 'community.postDetail.listingMeta.publisherTypes.personal',
  company: 'community.postDetail.listingMeta.publisherTypes.company',
  official: 'community.postDetail.listingMeta.publisherTypes.official',
};

const CATEGORY_LABEL_KEYS: Record<CommunityCategory, string> = {
  'job-seeking': 'community.page.categories.jobSeeking',
  recruitment: 'community.page.categories.recruitment',
  services: 'community.page.categories.services',
  partnerships: 'community.page.categories.partnerships',
  news: 'community.page.categories.news',
};

const RECOMMENDATION_REASON_LABEL_KEYS: Record<CommunityRecommendationReason, string> = {
  featured: 'community.postDetail.recommendations.reasonLabels.featured',
  'intent-service-line': 'community.postDetail.recommendations.reasonLabels.intentServiceLine',
  'matched-service-line': 'community.postDetail.recommendations.reasonLabels.matchedServiceLine',
  'multi-listing': 'community.postDetail.recommendations.reasonLabels.multiListing',
  'online-delivery': 'community.postDetail.recommendations.reasonLabels.onlineDelivery',
  'official-presence': 'community.postDetail.recommendations.reasonLabels.officialPresence',
  'same-company': 'community.postDetail.recommendations.reasonLabels.sameCompany',
  'same-service-line': 'community.postDetail.recommendations.reasonLabels.sameServiceLine',
  'shared-category': 'community.postDetail.recommendations.reasonLabels.sharedCategory',
  'shared-location': 'community.postDetail.recommendations.reasonLabels.sharedLocation',
  'shared-tag': 'community.postDetail.recommendations.reasonLabels.sharedTag',
};

function formatDate(value: string, locale: string, options?: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(
      locale,
      options ?? {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      },
    ).format(new Date(value));
  } catch {
    return value;
  }
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials.slice(0, 2) || 'OC';
}

function getCommunityShareUrl(postId: string) {
  if (typeof window === 'undefined') {
    return `/community/${postId}`;
  }

  return window.location.href;
}

async function writeCommunityShareClipboard(text: string) {
  if (!globalThis.navigator?.clipboard?.writeText) {
    throw new Error('Clipboard is not available.');
  }

  await globalThis.navigator.clipboard.writeText(text);
}

export function CommunityPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [recommendations, setRecommendations] = useState<ReturnType<typeof buildCommunityRecommendations> | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      if (!id) {
        if (active) {
          setPost(null);
          setComments([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const [nextPost, nextComments] = await Promise.all([
          communityService.getById(id),
          communityService.getComments(id),
        ]);

        if (!active) {
          return;
        }

        setPost(nextPost);
        setComments(nextComments);
        setRecommendations(null);

        if (nextPost) {
          const allPosts = await communityService.getPosts();

          if (!active) {
            return;
          }

          setRecommendations(buildCommunityRecommendations(nextPost, allPosts));
        }
      } catch {
        if (!active) {
          return;
        }

        setPost(null);
        setComments([]);
        setRecommendations(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [id]);

  async function handleSubmitComment() {
    if (!post || !commentDraft.trim()) {
      return;
    }

    setIsSubmittingComment(true);

    try {
      const nextComment = await communityService.addComment(post.id, commentDraft.trim());
      const alreadyExists = comments.some((comment) => comment.id === nextComment.id);
      setComments((previous) => mergeCommunityComments(previous, nextComment));
      if (!alreadyExists) {
        setPost((previous) =>
          previous
            ? {
                ...previous,
                stats: {
                  ...previous.stats,
                  comments: previous.stats.comments + 1,
                },
              }
            : previous,
        );
      }
      setCommentDraft('');
    } catch {
      toast.error(t('community.postDetail.toasts.commentFailed'));
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleBookmark() {
    if (!post || isBookmarking) {
      return;
    }

    const nextIsBookmarked = !post.isBookmarked;
    setIsBookmarking(true);

    try {
      await communityService.bookmarkPost(post.id);
      setPost((previous) => (previous ? toggleCommunityPostBookmark(previous) : previous));
      toast.success(
        t(
          nextIsBookmarked
            ? 'community.postDetail.toasts.bookmarkAdded'
            : 'community.postDetail.toasts.bookmarkRemoved',
        ),
      );
    } catch {
      toast.error(t('community.postDetail.toasts.bookmarkFailed'));
    } finally {
      setIsBookmarking(false);
    }
  }

  async function handleShare() {
    if (!post || isSharing) {
      return;
    }

    const sharePayload = buildCommunitySharePayload(post, getCommunityShareUrl(post.id));
    setIsSharing(true);

    try {
      let usedNativeShare = false;

      if (typeof globalThis.navigator?.share === 'function') {
        try {
          await globalThis.navigator.share(sharePayload);
          usedNativeShare = true;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

          await writeCommunityShareClipboard(`${sharePayload.text}\n${sharePayload.url}`);
        }
      } else {
        await writeCommunityShareClipboard(`${sharePayload.text}\n${sharePayload.url}`);
      }

      await communityService.sharePost(post.id);
      toast.success(
        t(
          usedNativeShare
            ? 'community.postDetail.toasts.shareReady'
            : 'community.postDetail.toasts.shareCopied',
        ),
      );
    } catch {
      toast.error(t('community.postDetail.toasts.shareFailed'));
    } finally {
      setIsSharing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button type="button" variant="ghost" onClick={() => navigate('/community')}>
          <ArrowLeft className="h-4 w-4" />
          {t('community.postDetail.backToCommunity')}
        </Button>
        <div className="mt-6 rounded-[28px] border border-dashed border-zinc-300 bg-white/80 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            {t('community.postDetail.notFoundTitle')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(1760px,_calc(100vw-2rem))] px-4 py-6 sm:px-5 lg:px-6 xl:px-8 2xl:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => navigate('/community')}>
          <ArrowLeft className="h-4 w-4" />
          {t('community.postDetail.backToCommunity')}
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={isSharing} onClick={() => {
            void handleShare();
          }}>
            <Share2 className="h-4 w-4" />
            {t('community.postDetail.actions.share')}
          </Button>
          <Button
            type="button"
            variant={post.isBookmarked ? 'default' : 'outline'}
            disabled={isBookmarking}
            onClick={() => {
              void handleBookmark();
            }}
          >
            <Bookmark className={`h-4 w-4 ${post.isBookmarked ? 'fill-current' : ''}`} />
            {t(
              post.isBookmarked
                ? 'community.postDetail.actions.bookmarked'
                : 'community.postDetail.actions.bookmark',
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[32px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('community.postDetail.overviewEyebrow')}
            </div>
            <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {t('community.postDetail.overviewTitle')}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {t(CATEGORY_LABEL_KEYS[post.category])}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1 font-medium text-primary-600 dark:text-primary-300">
                <Clock3 className="h-4 w-4" />
                {formatDate(post.createdAt, i18n.language)}
              </span>
              <span>{t('community.postDetail.meta.views', { count: post.stats.views })}</span>
              {post.isFeatured ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  {t('community.postDetail.featuredBadge')}
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {post.title}
            </h1>

            <div className="mt-5 flex items-center gap-3 rounded-[24px] bg-zinc-50 p-4 dark:bg-zinc-900/70">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10 text-sm font-semibold text-primary-600 dark:text-primary-300">
                {getInitials(post.author.name)}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-zinc-950 dark:text-zinc-50">{post.author.name}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{post.author.role}</div>
              </div>
            </div>

            <article className="prose prose-zinc mt-6 max-w-none text-sm leading-7 dark:prose-invert">
              <MarkdownContent content={post.content} />
            </article>

            {post.tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            {post.category === 'news' ? (
              <div className="mt-6 rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
                <div className="font-semibold">{t('community.postDetail.newsPanelTitle')}</div>
                <p className="mt-2">{t('community.postDetail.newsPanelDescription')}</p>
              </div>
            ) : null}

            <div className="mt-6 rounded-[24px] border border-primary-500/15 bg-primary-500/5 p-5 dark:border-primary-500/20 dark:bg-primary-500/10">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {t('community.postDetail.assistantCta.title')}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {t('community.postDetail.assistantCta.description')}
                  </p>
                  <Button type="button" className="mt-4">
                    <MessageSquare className="h-4 w-4" />
                    {t('community.postDetail.assistantCta.primaryAction')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {t('community.postDetail.commentsTitle', { count: comments.length })}
              </h2>
            </div>

            <div className="mt-4 space-y-4">
              <Textarea
                rows={4}
                value={commentDraft}
                placeholder={t('community.postDetail.commentPlaceholder')}
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <div className="flex justify-end">
                <Button type="button" disabled={!commentDraft.trim() || isSubmittingComment} onClick={() => {
                  void handleSubmitComment();
                }}>
                  <Send className="h-4 w-4" />
                  {t('community.postDetail.actions.sendComment')}
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {comment.author.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(comment.createdAt, i18n.language)}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {comment.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
                  {t('community.postDetail.emptyComments')}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-[32px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {t('community.postDetail.listingMeta.title')}
            </h2>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.location')}
                </div>
                <div className="mt-1 flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  {post.location || '-'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.compensation')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">{post.compensation || '-'}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.company')}
                </div>
                <div className="mt-1 flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                  <Building2 className="h-4 w-4 text-zinc-400" />
                  {post.company || '-'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.publisherType')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {t(PUBLISHER_TYPE_LABEL_KEYS[post.publisherType])}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.serviceLine')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {post.serviceLine ? t(SERVICE_LINE_LABEL_KEYS[post.serviceLine]) : '-'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.deliveryMode')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {post.deliveryMode ? t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode]) : '-'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.turnaround')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">{post.turnaround || '-'}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.contactPreference')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {post.contactPreference || '-'}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('community.postDetail.listingMeta.employmentType')}
                </div>
                <div className="mt-1 text-zinc-700 dark:text-zinc-300">{post.employmentType || '-'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t('community.postDetail.publisherPanelEyebrow')}
            </div>
            <h2 className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {t('community.postDetail.publisherPanelTitle')}
            </h2>
            <div className="mt-4 flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10 text-sm font-semibold text-primary-600 dark:text-primary-300">
                {getInitials(post.author.name)}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-zinc-950 dark:text-zinc-50">{post.author.name}</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t(PUBLISHER_TYPE_LABEL_KEYS[post.publisherType])}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {post.author.bio || post.company || post.author.role}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {post.company ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {post.company}
                </span>
              ) : null}
              {post.location ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {post.location}
                </span>
              ) : null}
            </div>
          </section>

          <CommunityRecommendationSection
            eyebrow={t('community.postDetail.recommendations.relatedServicesEyebrow')}
            title={t('community.postDetail.recommendations.relatedServicesTitle')}
            description={t('community.postDetail.recommendations.relatedServicesDescription')}
            emptyLabel={t('community.postDetail.recommendations.relatedServicesEmpty')}
          >
            {(recommendations?.relatedServices || []).slice(0, 3).map((item) => (
              <ServiceRecommendationCard
                key={item.post.id}
                item={item}
                locale={i18n.language}
                onOpen={() => navigate(`/community/${item.post.id}`)}
                t={t}
              />
            ))}
          </CommunityRecommendationSection>

          <CommunityRecommendationSection
            eyebrow={t('community.postDetail.recommendations.relatedCompaniesEyebrow')}
            title={t('community.postDetail.recommendations.relatedCompaniesTitle')}
            description={t('community.postDetail.recommendations.relatedCompaniesDescription')}
            emptyLabel={t('community.postDetail.recommendations.relatedCompaniesEmpty')}
          >
            {(recommendations?.relatedCompanies || []).slice(0, 3).map((item) => (
              <CompanyRecommendationCard
                key={`${item.company}-${item.primaryPost.id}`}
                item={item}
                onOpen={() => navigate(`/community/${item.primaryPost.id}`)}
                t={t}
              />
            ))}
          </CommunityRecommendationSection>
        </aside>
      </div>
    </div>
  );
}

function CommunityRecommendationSection({
  eyebrow,
  title,
  description,
  emptyLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyLabel: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">{description}</p>

      {items.length > 0 ? (
        <div className="mt-5 space-y-3">{items}</div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function ServiceRecommendationCard({
  item,
  locale,
  onOpen,
  t,
}: {
  item: CommunityServiceRecommendation;
  locale: string;
  onOpen: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { post } = item;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-left transition-colors hover:border-primary-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-primary-400/30 dark:hover:bg-zinc-950"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-950 dark:text-white">{post.title}</div>
          <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {post.company || post.author.name}
          </div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {post.serviceLine ? (
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {t(SERVICE_LINE_LABEL_KEYS[post.serviceLine] ?? post.serviceLine)}
          </span>
        ) : null}
        {post.deliveryMode ? (
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {t(DELIVERY_MODE_LABEL_KEYS[post.deliveryMode] ?? post.deliveryMode)}
          </span>
        ) : null}
      </div>

      {item.reasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.reasons.slice(0, 3).map((reason) => (
            <span
              key={`${post.id}-${reason}`}
              className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300"
            >
              {t(RECOMMENDATION_REASON_LABEL_KEYS[reason])}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {[post.location, post.turnaround, post.compensation].filter(Boolean).join(' / ')}
      </div>

      <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
        <span>{formatDate(post.createdAt, locale, { dateStyle: 'medium' })}</span>
        <span className="text-zinc-400">/</span>
        <span>{t('community.postDetail.recommendations.openService')}</span>
      </div>
    </button>
  );
}

function CompanyRecommendationCard({
  item,
  onOpen,
  t,
}: {
  item: CommunityCompanyRecommendation;
  onOpen: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-left transition-colors hover:border-primary-500/30 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-primary-400/30 dark:hover:bg-zinc-950"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-950 dark:text-white">{item.company}</div>
          <div className="mt-1 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
            {item.primaryPost.author.bio || item.primaryPost.title}
          </div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {t('community.postDetail.recommendations.openCompany')}
        </div>
        <div className="mt-2 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
          {item.primaryPost.title}
        </div>
      </div>

      {item.reasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.reasons.slice(0, 3).map((reason) => (
            <span
              key={`${item.company}-${reason}`}
              className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300"
            >
              {t(RECOMMENDATION_REASON_LABEL_KEYS[reason])}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.serviceLines.slice(0, 3).map((serviceLine) => (
          <span
            key={`${item.company}-${serviceLine}`}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {t(SERVICE_LINE_LABEL_KEYS[serviceLine] ?? serviceLine)}
          </span>
        ))}
        {item.categories.slice(0, 2).map((category) => (
          <span
            key={`${item.company}-${category}`}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {t(CATEGORY_LABEL_KEYS[category] ?? category)}
          </span>
        ))}
      </div>

      <div className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
        {t('community.postDetail.recommendations.activeListings', {
          count: item.listingCount,
        })}
      </div>
    </button>
  );
}
