import type {
  FaqCategoryVO,
  FaqDetailVO,
  FaqVO,
  FeedbackDetailVO,
  FeedbackVO,
  PageFaqVO,
  PageFeedbackVO,
  SupportInfoVO,
} from '../sdk/appSdkPort.ts';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import { getClawStudioAppClientWithSession } from '../sdk/useAppSdkClient.ts';

type FeedbackCenterClient = { feedback: import('../sdk/appSdkPort.ts').ClawStudioFeedbackClient };

export interface FeedbackCenterQuery {
  type?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface FeedbackCenterSubmitInput {
  type: string;
  content: string;
  contact?: string;
  attachmentUrl?: string;
  screenshotUrl?: string;
}

export interface FeedbackCenterFaqQuery {
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export interface FeedbackCenterItem {
  id: string;
  type: string;
  content: string;
  status: string;
  submitTime?: string;
  processTime?: string;
}

export interface FeedbackCenterFollowUp {
  id: string;
  feedbackId: string;
  content: string;
  attachmentUrl?: string;
  followUpTime?: string;
  follower?: string;
}

export interface FeedbackCenterDetail extends FeedbackCenterItem {
  contact?: string;
  attachmentUrl?: string;
  screenshotUrl?: string;
  followUps: FeedbackCenterFollowUp[];
}

export interface FeedbackCenterFaqCategory {
  id: string;
  name: string;
  icon?: string;
  faqCount: number;
}

export interface FeedbackCenterFaq {
  id: string;
  question: string;
  categoryId?: string;
  categoryName?: string;
  helpfulCount: number;
  viewCount: number;
}

export interface FeedbackCenterFaqDetail extends FeedbackCenterFaq {
  answer: string;
}

export interface FeedbackCenterSupportInfo {
  hotline?: string;
  email?: string;
  workingHours?: string;
  wechatQrcode?: string;
  onlineSupportUrl?: string;
  faqUrl?: string;
  helpCenterUrl?: string;
}

export interface FeedbackCenterPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateFeedbackCenterServiceOptions {
  getClient?: () => FeedbackCenterClient;
}

export interface FeedbackCenterService {
  listFeedback(params?: FeedbackCenterQuery): Promise<FeedbackCenterPage<FeedbackCenterItem>>;
  submitFeedback(input: FeedbackCenterSubmitInput): Promise<FeedbackCenterItem>;
  getFeedback(id: string): Promise<FeedbackCenterDetail>;
  followUpFeedback(id: string, content: string, attachmentUrl?: string): Promise<FeedbackCenterDetail>;
  closeFeedback(id: string, reason?: string): Promise<FeedbackCenterDetail>;
  listFaqCategories(): Promise<FeedbackCenterFaqCategory[]>;
  listFaqs(params?: FeedbackCenterFaqQuery): Promise<FeedbackCenterPage<FeedbackCenterFaq>>;
  searchFaqs(keyword: string): Promise<FeedbackCenterFaq[]>;
  getFaq(id: string): Promise<FeedbackCenterFaqDetail>;
  getSupportInfo(): Promise<FeedbackCenterSupportInfo>;
}

function getDefaultClient(): FeedbackCenterClient {
  return getClawStudioAppClientWithSession() as FeedbackCenterClient;
}

function toOptionalString(value: string | number | undefined | null): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  const normalized = (value || '').trim();
  return normalized || undefined;
}

function toIdString(value: string | number | undefined | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalString(value) || '';
}

function toNumber(value: number | string | undefined | null, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function withDefinedQuery<T extends Record<string, number | string | undefined>>(query: T): T {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as T;
}

function mapFeedback(value: FeedbackVO | null | undefined): FeedbackCenterItem {
  const candidate = value || {};

  return {
    id: toIdString(candidate.id),
    type: toOptionalString(candidate.type) || 'OTHER',
    content: toOptionalString(candidate.content) || '',
    status: toOptionalString(candidate.status) || 'PENDING',
    submitTime: toOptionalString(candidate.submitTime),
    processTime: toOptionalString(candidate.processTime),
  };
}

function mapFollowUp(
  value:
    | NonNullable<FeedbackDetailVO['followUps']>[number]
    | null
    | undefined,
): FeedbackCenterFollowUp {
  const candidate = value || {};

  return {
    id: toIdString(candidate.id),
    feedbackId: toIdString(candidate.feedbackId),
    content: toOptionalString(candidate.content) || '',
    attachmentUrl: toOptionalString(candidate.attachmentUrl),
    followUpTime: toOptionalString(candidate.followUpTime),
    follower: toOptionalString(candidate.follower),
  };
}

function mapFeedbackDetail(value: FeedbackDetailVO | null | undefined): FeedbackCenterDetail {
  const candidate = value || {};

  return {
    ...mapFeedback(candidate),
    contact: toOptionalString(candidate.contact),
    attachmentUrl: toOptionalString(candidate.attachmentUrl),
    screenshotUrl: toOptionalString(candidate.screenshotUrl),
    followUps: (candidate.followUps || []).map(mapFollowUp),
  };
}

function mapFeedbackPage(
  payload: PageFeedbackVO | null | undefined,
  fallbackPage: number,
  fallbackPageSize: number,
): FeedbackCenterPage<FeedbackCenterItem> {
  const page = payload || {};
  const items = (page.content || []).map(mapFeedback);
  const currentPage = Math.max(1, toNumber(page.number, fallbackPage - 1) + 1);
  const pageSize = Math.max(1, toNumber(page.size, fallbackPageSize));
  const total = Math.max(items.length, toNumber(page.totalElements, items.length));
  const hasMore = page.last === undefined ? currentPage * pageSize < total : page.last === false;

  return {
    items,
    total,
    page: currentPage,
    pageSize,
    hasMore,
  };
}

function mapFaqCategory(value: FaqCategoryVO | null | undefined): FeedbackCenterFaqCategory | null {
  const id = toIdString(value?.id);
  const name = toOptionalString(value?.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    icon: toOptionalString(value?.icon),
    faqCount: toNumber(value?.faqCount),
  };
}

function mapFaq(value: FaqVO | FaqDetailVO | null | undefined): FeedbackCenterFaq {
  const candidate = value || {};

  return {
    id: toIdString(candidate.id),
    question: toOptionalString(candidate.question) || '',
    categoryId: toOptionalString(candidate.categoryId),
    categoryName: toOptionalString(candidate.categoryName),
    helpfulCount: toNumber(candidate.helpfulCount),
    viewCount: toNumber(candidate.viewCount),
  };
}

function mapFaqDetail(value: FaqDetailVO | null | undefined): FeedbackCenterFaqDetail {
  const candidate = value || {};

  return {
    ...mapFaq(candidate),
    answer: toOptionalString(candidate.answer) || '',
  };
}

function mapFaqPage(
  payload: PageFaqVO | null | undefined,
  fallbackPage: number,
  fallbackPageSize: number,
): FeedbackCenterPage<FeedbackCenterFaq> {
  const page = payload || {};
  const items = (page.content || []).map(mapFaq);
  const currentPage = Math.max(1, toNumber(page.number, fallbackPage - 1) + 1);
  const pageSize = Math.max(1, toNumber(page.size, fallbackPageSize));
  const total = Math.max(items.length, toNumber(page.totalElements, items.length));
  const hasMore = page.last === undefined ? currentPage * pageSize < total : page.last === false;

  return {
    items,
    total,
    page: currentPage,
    pageSize,
    hasMore,
  };
}

function mapSupportInfo(value: SupportInfoVO | null | undefined): FeedbackCenterSupportInfo {
  const candidate = value || {};

  return {
    hotline: toOptionalString(candidate.hotline),
    email: toOptionalString(candidate.email),
    workingHours: toOptionalString(candidate.workingHours),
    wechatQrcode: toOptionalString(candidate.wechatQrcode),
    onlineSupportUrl: toOptionalString(candidate.onlineSupportUrl),
    faqUrl: toOptionalString(candidate.faqUrl),
    helpCenterUrl: toOptionalString(candidate.helpCenterUrl),
  };
}

export function createFeedbackCenterService(
  options: CreateFeedbackCenterServiceOptions = {},
): FeedbackCenterService {
  const getClient = options.getClient;

  return {
    async listFeedback(params = {}) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFeedbackPage(
        unwrapAppSdkResponse<PageFeedbackVO>(
          await client.feedback.listFeedback(
            withDefinedQuery({
              type: toOptionalString(params.type),
              status: toOptionalString(params.status),
              page: params.page,
              size: params.pageSize,
            }),
          ),
          'Failed to load feedback history.',
        ),
        params.page || 1,
        params.pageSize || 10,
      );
    },

    async submitFeedback(input) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFeedback(
        unwrapAppSdkResponse<FeedbackVO>(
          await client.feedback.submit({
            type: input.type,
            content: input.content,
            contact: toOptionalString(input.contact),
            attachmentUrl: toOptionalString(input.attachmentUrl),
            screenshotUrl: toOptionalString(input.screenshotUrl),
          }),
          'Failed to submit feedback.',
        ),
      );
    },

    async getFeedback(id: string) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFeedbackDetail(
        unwrapAppSdkResponse<FeedbackDetailVO>(
          await client.feedback.getFeedbackDetail(id),
          'Failed to load feedback details.',
        ),
      );
    },

    async followUpFeedback(id: string, content: string, attachmentUrl?: string) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFeedbackDetail(
        unwrapAppSdkResponse<FeedbackDetailVO>(
          await client.feedback.followUp(id, {
            feedbackId: id,
            content,
            attachmentUrl: toOptionalString(attachmentUrl),
          }),
          'Failed to send follow-up feedback.',
        ),
      );
    },

    async closeFeedback(id: string, reason?: string) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFeedbackDetail(
        unwrapAppSdkResponse<FeedbackDetailVO>(
          await client.feedback.close(
            id,
            withDefinedQuery({
              reason: toOptionalString(reason),
            }),
          ),
          'Failed to close feedback.',
        ),
      );
    },

    async listFaqCategories() {
      const client = getClient ? getClient() : getDefaultClient();
      const payload = unwrapAppSdkResponse<FaqCategoryVO[]>(
        await client.feedback.listFaqCategories(),
        'Failed to load FAQ categories.',
      );
      return payload
        .map(mapFaqCategory)
        .filter((item): item is FeedbackCenterFaqCategory => Boolean(item));
    },

    async listFaqs(params = {}) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFaqPage(
        unwrapAppSdkResponse<PageFaqVO>(
          await client.feedback.listFaqs(
            withDefinedQuery({
              categoryId: toOptionalString(params.categoryId),
              page: params.page,
              size: params.pageSize,
            }),
          ),
          'Failed to load FAQs.',
        ),
        params.page || 1,
        params.pageSize || 10,
      );
    },

    async searchFaqs(keyword: string) {
      const normalizedKeyword = toOptionalString(keyword);
      if (!normalizedKeyword) {
        return [];
      }

      const client = getClient ? getClient() : getDefaultClient();
      const payload = unwrapAppSdkResponse<FaqVO[]>(
        await client.feedback.searchFaqs({ keyword: normalizedKeyword }),
        'Failed to search FAQs.',
      );
      return payload.map(mapFaq);
    },

    async getFaq(id: string) {
      const client = getClient ? getClient() : getDefaultClient();
      return mapFaqDetail(
        unwrapAppSdkResponse<FaqDetailVO>(
          await client.feedback.getFaqDetail(id),
          'Failed to load FAQ detail.',
        ),
      );
    },

    async getSupportInfo() {
      const client = getClient ? getClient() : getDefaultClient();
      return mapSupportInfo(
        unwrapAppSdkResponse<SupportInfoVO>(
          await client.feedback.getSupportInfo(),
          'Failed to load support information.',
        ),
      );
    },
  };
}

export const feedbackCenterService = createFeedbackCenterService();
