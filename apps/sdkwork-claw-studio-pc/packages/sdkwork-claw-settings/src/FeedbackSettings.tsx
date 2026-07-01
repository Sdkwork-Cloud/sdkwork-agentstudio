import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
import { Bug, CircleHelp, ExternalLink, LoaderCircle, RefreshCcw, Send, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  feedbackCenterService,
  type FeedbackCenterDetail,
  type FeedbackCenterFaq,
  type FeedbackCenterFaqDetail,
  type FeedbackCenterItem,
  type FeedbackCenterSupportInfo,
  useAuthStore,
} from '@sdkwork/claw-core';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@sdkwork/claw-ui';
import { Section } from './Shared';

const LOGIN_PATH = '/login?redirect=%2Fsettings%3Ftab%3Dfeedback';
const FEEDBACK_TYPES = ['BUG_REPORT', 'FEATURE_REQUEST', 'QUESTION', 'SUGGESTION', 'COMPLAINT', 'PRAISE', 'OTHER'] as const;
const FEEDBACK_STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'PROCESSED', 'RESOLVED', 'CLOSED', 'REJECTED'] as const;

type FeedbackTypeValue = (typeof FEEDBACK_TYPES)[number];
type FeedbackStatusFilter = (typeof FEEDBACK_STATUS_FILTERS)[number];

function formatTimestamp(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getStatusTone(status: string) {
  switch (status) {
    case 'RESOLVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'CLOSED':
    case 'REJECTED':
      return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    case 'PROCESSING':
    case 'PROCESSED':
      return 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-300';
    case 'PENDING':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }
}

function SupportRow({ label, value, href }: { label: string; value?: string; href?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-2 break-all text-sm text-zinc-900 dark:text-zinc-100">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary-600 dark:text-primary-400">
              {value}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : value
        ) : '-'}
      </div>
    </div>
  );
}

export function FeedbackSettings() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();
  const [feedbackType, setFeedbackType] = useState<FeedbackTypeValue>('BUG_REPORT');
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>('ALL');
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackCenterItem[]>([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackCenterDetail | null>(null);
  const [followUpContent, setFollowUpContent] = useState('');
  const [supportInfo, setSupportInfo] = useState<FeedbackCenterSupportInfo | null>(null);
  const [faqItems, setFaqItems] = useState<FeedbackCenterFaq[]>([]);
  const [faqCategories, setFaqCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [faqCategoryId, setFaqCategoryId] = useState('all');
  const [faqKeyword, setFaqKeyword] = useState('');
  const deferredFaqKeyword = useDeferredValue(faqKeyword);
  const [selectedFaqId, setSelectedFaqId] = useState<string | null>(null);
  const [selectedFaq, setSelectedFaq] = useState<FeedbackCenterFaqDetail | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(false);
  const [isLoadingFaqDetail, setIsLoadingFaqDetail] = useState(false);

  const loadFeedbackHistory = useEffectEvent(async (preferredId?: string | null) => {
    if (!isAuthenticated) {
      startTransition(() => {
        setFeedbackHistory([]);
        setSelectedFeedbackId(null);
        setSelectedFeedback(null);
      });
      return;
    }

    setIsLoadingFeedback(true);
    try {
      const page = await feedbackCenterService.listFeedback({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
        pageSize: 10,
      });
      const nextId = preferredId && page.items.some((item) => item.id === preferredId) ? preferredId : page.items[0]?.id || null;
      startTransition(() => {
        setFeedbackHistory(page.items);
        setSelectedFeedbackId(nextId);
        if (!nextId) {
          setSelectedFeedback(null);
        }
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadFeedbackFailed'));
    } finally {
      setIsLoadingFeedback(false);
    }
  });

  const loadFeedbackDetail = useEffectEvent(async (feedbackId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await feedbackCenterService.getFeedback(feedbackId);
      startTransition(() => {
        setSelectedFeedback(detail);
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadFeedbackDetailFailed'));
    } finally {
      setIsLoadingDetail(false);
    }
  });

  const loadSupportInfo = useEffectEvent(async () => {
    setIsLoadingSupport(true);
    try {
      const info = await feedbackCenterService.getSupportInfo();
      startTransition(() => {
        setSupportInfo(info);
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadSupportFailed'));
    } finally {
      setIsLoadingSupport(false);
    }
  });

  const loadFaqCategories = useEffectEvent(async () => {
    try {
      const categories = await feedbackCenterService.listFaqCategories();
      startTransition(() => {
        setFaqCategories(categories.map((item) => ({ id: item.id, name: item.name })));
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadFaqFailed'));
    }
  });

  const loadFaqList = useEffectEvent(async (preferredId?: string | null) => {
    setIsLoadingFaqs(true);
    try {
      const items = deferredFaqKeyword.trim()
        ? await feedbackCenterService.searchFaqs(deferredFaqKeyword.trim())
        : (await feedbackCenterService.listFaqs({ categoryId: faqCategoryId === 'all' ? undefined : faqCategoryId, page: 1, pageSize: 10 })).items;
      const nextId = preferredId && items.some((item) => item.id === preferredId) ? preferredId : items[0]?.id || null;
      startTransition(() => {
        setFaqItems(items);
        setSelectedFaqId(nextId);
        if (!nextId) {
          setSelectedFaq(null);
        }
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadFaqFailed'));
    } finally {
      setIsLoadingFaqs(false);
    }
  });

  const loadFaqDetail = useEffectEvent(async (faqId: string) => {
    setIsLoadingFaqDetail(true);
    try {
      const detail = await feedbackCenterService.getFaq(faqId);
      startTransition(() => {
        setSelectedFaq(detail);
      });
    } catch {
      toast.error(t('settings.feedback.toasts.loadFaqFailed'));
    } finally {
      setIsLoadingFaqDetail(false);
    }
  });

  useEffect(() => {
    void loadSupportInfo();
    void loadFaqCategories();
  }, []);

  useEffect(() => {
    void loadFeedbackHistory();
  }, [isAuthenticated, statusFilter]);

  useEffect(() => {
    if (selectedFeedbackId) {
      void loadFeedbackDetail(selectedFeedbackId);
    }
  }, [selectedFeedbackId]);

  useEffect(() => {
    void loadFaqList();
  }, [faqCategoryId, deferredFaqKeyword]);

  useEffect(() => {
    if (selectedFaqId) {
      void loadFaqDetail(selectedFaqId);
    }
  }, [selectedFaqId]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.error(t('settings.feedback.toasts.authRequired'));
      navigate(LOGIN_PATH, { replace: true });
      return;
    }
    if (!content.trim()) {
      toast.error(t('settings.feedback.toasts.submitFailed'));
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await feedbackCenterService.submitFeedback({
        type: feedbackType,
        contact: contact.trim() || undefined,
        content: content.trim(),
      });
      setContent('');
      toast.success(t('settings.feedback.toasts.submitSuccess'));
      await loadFeedbackHistory(created.id);
    } catch {
      toast.error(t('settings.feedback.toasts.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUp = async () => {
    if (!selectedFeedbackId || !followUpContent.trim()) {
      return;
    }
    setIsFollowingUp(true);
    try {
      const detail = await feedbackCenterService.followUpFeedback(selectedFeedbackId, followUpContent.trim());
      startTransition(() => {
        setSelectedFeedback(detail);
        setFollowUpContent('');
      });
      toast.success(t('settings.feedback.toasts.followUpSuccess'));
      await loadFeedbackHistory(selectedFeedbackId);
    } catch {
      toast.error(t('settings.feedback.toasts.followUpFailed'));
    } finally {
      setIsFollowingUp(false);
    }
  };

  const handleClose = async () => {
    if (!selectedFeedbackId) {
      return;
    }
    setIsClosing(true);
    try {
      const detail = await feedbackCenterService.closeFeedback(selectedFeedbackId);
      setSelectedFeedback(detail);
      toast.success(t('settings.feedback.toasts.closeSuccess'));
      await loadFeedbackHistory(selectedFeedbackId);
    } catch {
      toast.error(t('settings.feedback.toasts.closeFailed'));
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{t('settings.feedback.title')}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.description')}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Section title={t('settings.feedback.submit.title')}>
            {isAuthenticated ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.submit.description')}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="mb-2 block">{t('settings.feedback.submit.typeLabel')}</Label>
                    <Select value={feedbackType} onValueChange={(value) => setFeedbackType(value as FeedbackTypeValue)}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{FEEDBACK_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`settings.feedback.types.${type}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2 block">{t('settings.feedback.submit.contactLabel')}</Label>
                    <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder={t('settings.feedback.submit.contactPlaceholder')} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">{t('settings.feedback.submit.contentLabel')}</Label>
                  <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('settings.feedback.submit.contentPlaceholder')} rows={6} className="rounded-2xl" />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('settings.feedback.submit.helper')}</p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim()}>
                    {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isSubmitting ? t('settings.feedback.submit.submitting') : t('settings.feedback.submit.action')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('settings.feedback.authRequired.title')}</h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.authRequired.description')}</p>
                </div>
                <Button onClick={() => navigate(LOGIN_PATH)}>{t('settings.feedback.authRequired.action')}</Button>
              </div>
            )}
          </Section>

          <Section title={t('settings.feedback.history.title')}>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.history.description')}</p>
                <div className="flex items-center gap-3">
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FeedbackStatusFilter)}>
                    <SelectTrigger className="w-[180px] rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{FEEDBACK_STATUS_FILTERS.map((status) => <SelectItem key={status} value={status}>{t(`settings.feedback.status.${status}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => { void loadFeedbackHistory(selectedFeedbackId); }} disabled={!isAuthenticated || isLoadingFeedback}>
                    <RefreshCcw className="h-4 w-4" />
                    {t('settings.feedback.history.refresh')}
                  </Button>
                </div>
              </div>

              {!isAuthenticated ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">{t('settings.feedback.authRequired.description')}</div>
              ) : feedbackHistory.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  {isLoadingFeedback ? t('common.loading') : statusFilter === 'ALL' ? t('settings.feedback.history.empty') : t('settings.feedback.history.emptyFiltered')}
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    {feedbackHistory.map((item) => (
                      <button key={item.id} onClick={() => setSelectedFeedbackId(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${item.id === selectedFeedbackId ? 'border-primary-200 bg-primary-50/70 dark:border-primary-500/30 dark:bg-primary-500/10' : 'border-zinc-100 bg-zinc-50/70 hover:border-zinc-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><Bug className="h-4 w-4" /></div>
                            <div>
                              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t(`settings.feedback.types.${item.type}`)}</div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatTimestamp(item.submitTime)}</div>
                            </div>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(item.status)}`}>{t(`settings.feedback.status.${item.status}`)}</span>
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{item.content}</p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
                    {selectedFeedback && !isLoadingDetail ? (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t(`settings.feedback.types.${selectedFeedback.type}`)}</h3>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(selectedFeedback.status)}`}>{t(`settings.feedback.status.${selectedFeedback.status}`)}</span>
                            </div>
                            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{selectedFeedback.content}</p>
                          </div>
                          <Button variant="outline" onClick={handleClose} disabled={isClosing || ['CLOSED', 'REJECTED'].includes(selectedFeedback.status)}>
                            {isClosing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                            {isClosing ? t('settings.feedback.detail.closing') : t('settings.feedback.detail.closeAction')}
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <SupportRow label={t('settings.feedback.detail.submittedAt')} value={formatTimestamp(selectedFeedback.submitTime)} />
                          <SupportRow label={t('settings.feedback.detail.processedAt')} value={formatTimestamp(selectedFeedback.processTime)} />
                          <SupportRow label={t('settings.feedback.detail.contact')} value={selectedFeedback.contact} />
                        </div>
                        <div className="space-y-3">
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('settings.feedback.detail.followUps')}</div>
                          {selectedFeedback.followUps.length > 0 ? selectedFeedback.followUps.map((followUp) => (
                            <div key={followUp.id || `${followUp.feedbackId}-${followUp.followUpTime}`} className="rounded-2xl border border-zinc-100 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                              <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                                <span>{followUp.follower || 'user'}</span>
                                <span>{formatTimestamp(followUp.followUpTime)}</span>
                              </div>
                              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{followUp.content}</p>
                            </div>
                          )) : <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">{t('settings.feedback.detail.noFollowUps')}</div>}
                        </div>
                        {!['CLOSED', 'REJECTED'].includes(selectedFeedback.status) ? (
                          <div className="space-y-3 rounded-2xl border border-zinc-100 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                            <Label className="block">{t('settings.feedback.detail.followUps')}</Label>
                            <Textarea value={followUpContent} onChange={(event) => setFollowUpContent(event.target.value)} placeholder={t('settings.feedback.detail.followUpPlaceholder')} rows={4} className="rounded-2xl" />
                            <div className="flex justify-end">
                              <Button onClick={handleFollowUp} disabled={isFollowingUp || !followUpContent.trim()}>
                                {isFollowingUp ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {isFollowingUp ? t('settings.feedback.detail.sendingFollowUp') : t('settings.feedback.detail.sendFollowUp')}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                        {isLoadingDetail ? t('common.loading') : t('settings.feedback.detail.empty')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title={t('settings.feedback.support.title')}>
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.support.description')}</p>
              {isLoadingSupport && !supportInfo ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">{t('common.loading')}</div>
              ) : supportInfo ? (
                <div className="space-y-3">
                  <SupportRow label={t('settings.feedback.support.hotline')} value={supportInfo.hotline} />
                  <SupportRow label={t('settings.feedback.support.email')} value={supportInfo.email} href={supportInfo.email ? `mailto:${supportInfo.email}` : undefined} />
                  <SupportRow label={t('settings.feedback.support.hours')} value={supportInfo.workingHours} />
                  <SupportRow label={t('settings.feedback.support.online')} value={supportInfo.onlineSupportUrl} href={supportInfo.onlineSupportUrl} />
                  <SupportRow label={t('settings.feedback.support.faq')} value={supportInfo.faqUrl} href={supportInfo.faqUrl} />
                  <SupportRow label={t('settings.feedback.support.helpCenter')} value={supportInfo.helpCenterUrl} href={supportInfo.helpCenterUrl} />
                </div>
              ) : <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">{t('settings.feedback.support.empty')}</div>}
            </div>
          </Section>

          <Section title={t('settings.feedback.faq.title')}>
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.feedback.faq.description')}</p>
              <div className="grid gap-4">
                <div>
                  <Label className="mb-2 block">{t('settings.feedback.faq.categoryLabel')}</Label>
                  <Select value={faqCategoryId} onValueChange={setFaqCategoryId}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('settings.feedback.faq.categoryAll')}</SelectItem>
                      {faqCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">{t('common.search')}</Label>
                  <Input value={faqKeyword} onChange={(event) => setFaqKeyword(event.target.value)} placeholder={t('settings.feedback.faq.searchPlaceholder')} />
                </div>
              </div>
              <div className="space-y-3">
                {faqItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">{isLoadingFaqs ? t('common.loading') : t('settings.feedback.faq.empty')}</div>
                ) : faqItems.map((item) => (
                  <button key={item.id} onClick={() => setSelectedFaqId(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-colors ${item.id === selectedFaqId ? 'border-primary-200 bg-primary-50/70 dark:border-primary-500/30 dark:bg-primary-500/10' : 'border-zinc-100 bg-zinc-50/70 hover:border-zinc-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><CircleHelp className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.question}</div>
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.categoryName || t('settings.feedback.faq.categoryAll')}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
                {selectedFaq && !isLoadingFaqDetail ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"><CircleHelp className="h-4 w-4" /></div>
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{selectedFaq.question}</h3>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{selectedFaq.categoryName || t('settings.feedback.faq.categoryAll')}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{t('settings.feedback.faq.answerTitle')}</div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{selectedFaq.answer}</p>
                    </div>
                  </div>
                ) : <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">{isLoadingFaqDetail ? t('common.loading') : t('settings.feedback.faq.selectPrompt')}</div>}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
