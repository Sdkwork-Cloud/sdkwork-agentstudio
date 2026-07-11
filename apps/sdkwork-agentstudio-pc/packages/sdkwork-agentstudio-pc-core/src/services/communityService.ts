import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import { getagentstudioAppClientWithSession } from '../sdk/useAppSdkClient.ts';
import { formatDatetime, now } from '@sdkwork/utils/datetime';

export interface ListParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type CommunityCategory =
  | 'job-seeking'
  | 'recruitment'
  | 'services'
  | 'partnerships'
  | 'news';

export type CommunityPublisherType = 'personal' | 'company' | 'official';

export type CommunityServiceLine =
  | 'legal'
  | 'tax'
  | 'design'
  | 'development'
  | 'marketing'
  | 'translation'
  | 'operations'
  | 'training'
  | 'consulting'
  | 'content'
  | 'data'
  | 'hr';

export type CommunityDeliveryMode = 'online' | 'hybrid' | 'onsite';

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatar: string;
    role: string;
    bio?: string;
  };
  category: CommunityCategory;
  publisherType: CommunityPublisherType;
  tags: string[];
  stats: {
    likes: number;
    comments: number;
    views: number;
  };
  createdAt: string;
  coverImage?: string;
  location?: string;
  compensation?: string;
  company?: string;
  employmentType?: string;
  contactPreference?: string;
  serviceLine?: CommunityServiceLine;
  deliveryMode?: CommunityDeliveryMode;
  turnaround?: string;
  isFeatured?: boolean;
  assistantActions?: string[];
  backendCategoryId?: string;
  backendCategoryCode?: string;
  backendCategoryName?: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
}

export interface CommunityComment {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  createdAt: string;
  likes: number;
}

export interface CreatePostDTO {
  title: string;
  content: string;
  category: CommunityCategory;
  tags: string[];
  coverImage?: string;
  publisherType?: CommunityPublisherType;
  location?: string;
  compensation?: string;
  company?: string;
  employmentType?: string;
  contactPreference?: string;
  serviceLine?: CommunityServiceLine;
  deliveryMode?: CommunityDeliveryMode;
  turnaround?: string;
  isFeatured?: boolean;
  assistantActions?: string[];
}

export interface UpdatePostDTO extends Partial<CreatePostDTO> {}

export interface ICommunityService {
  getList(params?: ListParams & { category?: string }): Promise<PaginatedResult<CommunityPost>>;
  getById(id: string): Promise<CommunityPost | null>;
  create(data: CreatePostDTO): Promise<CommunityPost>;
  update(id: string, data: UpdatePostDTO): Promise<CommunityPost>;
  delete(id: string): Promise<boolean>;
  getPosts(category?: string, query?: string): Promise<CommunityPost[]>;
  getPost(id: string): Promise<CommunityPost>;
  getComments(postId: string): Promise<CommunityComment[]>;
  likePost(id: string): Promise<void>;
  bookmarkPost(id: string): Promise<void>;
  sharePost(id: string): Promise<void>;
  addComment(postId: string, content: string): Promise<CommunityComment>;
  createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>): Promise<CommunityPost>;
}

interface CommunitySdkClient {
  category: {
    listCategories(params?: Record<string, unknown>): Promise<unknown>;
  };
  feed: {
    getFeedList(params?: Record<string, unknown>): Promise<unknown>;
    getFeedDetail(id: string | number): Promise<unknown>;
    create(body: Record<string, unknown>): Promise<unknown>;
    like(id: string | number): Promise<unknown>;
    collect(id: string | number, params?: Record<string, unknown>): Promise<unknown>;
    share(id: string | number): Promise<unknown>;
    delete(id: string | number): Promise<unknown>;
  };
  comment: {
    getComments(params?: Record<string, unknown>): Promise<unknown>;
    createComment(body: Record<string, unknown>): Promise<unknown>;
  };
}

export interface CreateCommunityServiceOptions {
  getClient?: () => CommunitySdkClient | Promise<CommunitySdkClient>;
}

interface CommunityAuthorPayload {
  id?: string | number;
  name?: string;
  avatar?: string;
  bio?: string;
}

interface CommunityFeedPayload {
  id?: string | number;
  title?: string;
  content?: string;
  summary?: string;
  coverImage?: string;
  tags?: string[];
  author?: CommunityAuthorPayload;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isLiked?: boolean;
  isCollected?: boolean;
  categoryId?: number;
  isTop?: boolean;
  isHot?: boolean;
  isRecommended?: boolean;
  createdAt?: string;
}

interface CommunityCategoryPayload {
  id?: string | number;
  code?: string;
  name?: string;
}

interface CommunityCommentPayload {
  commentId?: string;
  content?: string;
  createdAt?: string;
  likes?: number;
  author?: CommunityAuthorPayload;
  userId?: number;
}

interface CommunityCommentPagePayload {
  content?: CommunityCommentPayload[];
}

interface CommunityMetaPayload {
  publisherType?: CommunityPublisherType;
  location?: string;
  compensation?: string;
  company?: string;
  employmentType?: string;
  contactPreference?: string;
  serviceLine?: CommunityServiceLine;
  deliveryMode?: CommunityDeliveryMode;
  turnaround?: string;
  assistantActions?: string[];
}

interface CommunityCategoryDescriptor {
  id: string;
  code?: string;
  name?: string;
  bucket?: CommunityCategory;
}

interface CommunityCategoryCatalog {
  items: CommunityCategoryDescriptor[];
  byId: Map<string, CommunityCategoryDescriptor>;
  preferredByBucket: Partial<Record<CommunityCategory, string>>;
  defaultCategoryId?: string;
}

interface TimedPromise<T> {
  expiresAt: number;
  promise: Promise<T>;
}

const CATEGORY_TYPE = 'feeds';
const FEED_QUERY_TYPE = 'all';
const FEED_PAGE_SIZE = 200;
const COMMENT_PAGE_SIZE = 50;
const CATEGORY_CACHE_TTL_MS = 30_000;
const FEED_CACHE_TTL_MS = 15_000;
const DEFAULT_AUTHOR_AVATAR = '';
const COMMUNITY_META_MARKER = 'claw-community-meta';
const COMMUNITY_META_PATTERN = /^\s*<!--\s*claw-community-meta\s+({[\s\S]*?})\s*-->\s*/;
const COMMUNITY_SOURCE = 'agent-studio-community';
const COMMUNITY_DEVICE_INFO = 'agent-studio-community';
const OFFICIAL_AUTHOR_PATTERN =
  /official|openclaw|sdkwork|\u5b98\u65b9|\u5e73\u53f0|\u516c\u544a|newsroom/u;
const REMOTE_PATTERN = /remote|online|\u7ebf\u4e0a|\u8fdc\u7a0b/u;
const HYBRID_PATTERN = /hybrid|onsite\/remote|\u6df7\u5408/u;
const ONSITE_PATTERN = /onsite|on-site|\u73b0\u573a|\u5230\u573a|\u4e0a\u95e8/u;

const CANONICAL_BUCKET_ALIASES: Record<CommunityCategory, string[]> = {
  'job-seeking': ['job-seeking', 'jobseeking', 'job-seeker', 'candidate', 'resume', 'cv'],
  recruitment: ['recruitment', 'recruit', 'hiring', 'position', 'talent'],
  services: ['services', 'service', 'agency', 'consulting'],
  partnerships: ['partnerships', 'partnership', 'partner', 'cooperation', 'collaboration', 'bd'],
  news: ['news', 'update', 'announcement', 'notice', 'bulletin'],
};

const CATEGORY_PATTERNS: Record<CommunityCategory, RegExp[]> = {
  'job-seeking': [/\b(job[-_\s]?seeking|candidate|resume|cv)\b/, /\u6c42\u804c|\u7b80\u5386|\u5019\u9009\u4eba/u],
  recruitment: [/\b(recruit(ment)?|hiring|position|talent)\b/, /\u62db\u8058|\u62db\u4eba|\u5c97\u4f4d/u],
  services: [
    /\b(service|services|legal|tax|design|develop(ment)?|marketing|translation|operations?|training|consult(ing)?|content|data|hr)\b/,
    /\u670d\u52a1|\u6cd5\u52a1|\u8d22\u7a0e|\u8bbe\u8ba1|\u5f00\u53d1|\u8425\u9500|\u7ffb\u8bd1|\u8fd0\u8425|\u57f9\u8bad|\u54a8\u8be2|\u5185\u5bb9|\u6570\u636e|\u4eba\u529b/u,
  ],
  partnerships: [/\b(partnership|partner|cooperate|collab|business[-_\s]?dev|bd)\b/, /\u5408\u4f5c|\u8054\u8425|\u6e20\u9053/u],
  news: [/\b(news|update|announcement|notice|bulletin)\b/, /\u65b0\u95fb|\u8d44\u8baf|\u516c\u544a|\u5feb\u8baf/u],
};

const SERVICE_LINE_PATTERNS: Array<{ serviceLine: CommunityServiceLine; patterns: RegExp[] }> = [
  {
    serviceLine: 'legal',
    patterns: [/\blegal|contract|trademark|ip|compliance\b/, /\u6cd5\u52a1|\u5408\u540c|\u5546\u6807|\u77e5\u8bc6\u4ea7\u6743|\u5408\u89c4/u],
  },
  {
    serviceLine: 'tax',
    patterns: [/\btax|bookkeeping|finance|invoice\b/, /\u8d22\u7a0e|\u62a5\u7a0e|\u8bb0\u8d26|\u53d1\u7968/u],
  },
  {
    serviceLine: 'design',
    patterns: [/\bdesign|branding|deck|logo\b/, /\u8bbe\u8ba1|\u54c1\u724c|\u89c6\u89c9|\u8def\u6f14/u],
  },
  {
    serviceLine: 'development',
    patterns: [
      /\bdevelopment|developer|engineering|automation|landing-page|react|typescript\b/,
      /\u5f00\u53d1|\u5de5\u7a0b|\u81ea\u52a8\u5316|\u843d\u5730\u9875|\u524d\u7aef|\u540e\u7aef/u,
    ],
  },
  {
    serviceLine: 'marketing',
    patterns: [/\bmarketing|seo|growth|video|employer-brand\b/, /\u8425\u9500|\u589e\u957f|\u77ed\u89c6\u9891|\u96c7\u4e3b\u54c1\u724c|\u6295\u653e/u],
  },
  {
    serviceLine: 'translation',
    patterns: [/\btranslation|localization|multilingual\b/, /\u7ffb\u8bd1|\u672c\u5730\u5316|\u591a\u8bed\u8a00/u],
  },
  {
    serviceLine: 'operations',
    patterns: [/\boperations?|ops|community|support\b/, /\u8fd0\u8425|\u793e\u7fa4|\u652f\u6301/u],
  },
  {
    serviceLine: 'training',
    patterns: [/\btraining|workshop|enablement\b/, /\u57f9\u8bad|\u8bad\u7ec3\u8425|\u5de5\u4f5c\u574a/u],
  },
  {
    serviceLine: 'consulting',
    patterns: [/\bconsult(ing)?|gtm|pricing|strategy|advisory\b/, /\u54a8\u8be2|\u5b9a\u4ef7|\u6218\u7565|\u987e\u95ee|\u5546\u4e1a\u5316/u],
  },
  {
    serviceLine: 'content',
    patterns: [/\bcontent|copywriting|help-center|documentation\b/, /\u5185\u5bb9|\u6587\u6848|\u5e2e\u52a9\u4e2d\u5fc3|\u6587\u6863/u],
  },
  {
    serviceLine: 'data',
    patterns: [/\bdata|dashboard|bi|analytics?|analysis\b/, /\u6570\u636e|\u770b\u677f|\u5206\u6790|\u62a5\u8868|\u6d1e\u5bdf/u],
  },
  {
    serviceLine: 'hr',
    patterns: [/\bhr|recruitment|resume|interview\b/, /\u4eba\u529b|\u62db\u8058|\u7b80\u5386|\u9762\u8bd5/u],
  },
];

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function toIdString(value: string | number | undefined | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return toOptionalString(value) || '';
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toPositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid community post id: ${value}`);
  }

  return Math.trunc(parsed);
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = new Set<string>();
  values.forEach((value) => {
    const item = toOptionalString(value);
    if (item) {
      normalized.add(item);
    }
  });

  return [...normalized];
}

function normalizeText(...values: Array<string | undefined>) {
  return values
    .map((value) => value || '')
    .join(' ')
    .trim()
    .toLowerCase();
}

function isCommunityPublisherType(value: unknown): value is CommunityPublisherType {
  return value === 'personal' || value === 'company' || value === 'official';
}

function isCommunityServiceLine(value: unknown): value is CommunityServiceLine {
  return (
    value === 'legal' ||
    value === 'tax' ||
    value === 'design' ||
    value === 'development' ||
    value === 'marketing' ||
    value === 'translation' ||
    value === 'operations' ||
    value === 'training' ||
    value === 'consulting' ||
    value === 'content' ||
    value === 'data' ||
    value === 'hr'
  );
}

function isCommunityDeliveryMode(value: unknown): value is CommunityDeliveryMode {
  return value === 'online' || value === 'hybrid' || value === 'onsite';
}

function sanitizeAssistantActions(values: unknown): string[] | undefined {
  const items = normalizeStringArray(values);
  return items.length > 0 ? items : undefined;
}

function sanitizeMetaPayload(value: unknown): CommunityMetaPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    publisherType: isCommunityPublisherType(candidate.publisherType) ? candidate.publisherType : undefined,
    location: toOptionalString(candidate.location),
    compensation: toOptionalString(candidate.compensation),
    company: toOptionalString(candidate.company),
    employmentType: toOptionalString(candidate.employmentType),
    contactPreference: toOptionalString(candidate.contactPreference),
    serviceLine: isCommunityServiceLine(candidate.serviceLine) ? candidate.serviceLine : undefined,
    deliveryMode: isCommunityDeliveryMode(candidate.deliveryMode) ? candidate.deliveryMode : undefined,
    turnaround: toOptionalString(candidate.turnaround),
    assistantActions: sanitizeAssistantActions(candidate.assistantActions),
  };
}

function compactMetaPayload(meta: CommunityMetaPayload): CommunityMetaPayload {
  const normalized = sanitizeMetaPayload(meta);
  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && value !== '';
    }),
  ) as CommunityMetaPayload;
}

function parseCommunityStoredContent(value?: string) {
  const raw = value || '';
  const match = raw.match(COMMUNITY_META_PATTERN);
  if (!match) {
    return {
      content: raw.trim(),
      meta: {} as CommunityMetaPayload,
    };
  }

  try {
    const meta = sanitizeMetaPayload(JSON.parse(match[1]));
    const content = raw.slice(match[0].length).trim();
    return {
      content,
      meta,
    };
  } catch {
    return {
      content: raw.trim(),
      meta: {} as CommunityMetaPayload,
    };
  }
}

function buildCommunityStoredContent(content: string, meta: CommunityMetaPayload) {
  const normalizedMeta = compactMetaPayload(meta);
  const body = (content || '').trim();
  if (Object.keys(normalizedMeta).length === 0) {
    return body;
  }

  return `<!-- ${COMMUNITY_META_MARKER} ${JSON.stringify(normalizedMeta)} -->\n\n${body}`;
}

function deriveTitleFromContent(content: string) {
  const line = content
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((item) => item.replace(/^#+\s*/, '').trim())
    .find(Boolean);

  return line || 'Untitled Listing';
}

function getDefaultAssistantActions(category: CommunityCategory): string[] {
  switch (category) {
    case 'job-seeking':
      return ['Polish the candidate summary', 'Generate multi-channel application copy', 'Match better-fit roles'];
    case 'recruitment':
      return ['Polish the role highlights', 'Generate candidate screening questions', 'Sync to more channels'];
    case 'services':
      return ['Structure the service scope', 'Generate pricing and delivery variants', 'Organize client follow-up actions'];
    case 'partnerships':
      return ['Draft the partnership proposal', 'Summarize partnership terms', 'Recommend likely partners'];
    case 'news':
      return ['Generate a summary', 'Extract key points', 'Sync to channels'];
    default:
      return ['Polish the headline', 'Generate more distribution variants'];
  }
}

function isGenericAuthorName(name?: string) {
  const normalized = normalizeText(name);
  return !normalized || normalized.startsWith('user-') || normalized === 'anonymous';
}

function resolvePublisherRole(category: CommunityCategory, publisherType: CommunityPublisherType) {
  if (publisherType === 'official') {
    return 'Official';
  }

  if (publisherType === 'company' && category === 'services') {
    return 'Service Partner';
  }

  if (publisherType === 'company' && category === 'partnerships') {
    return 'Business Dev';
  }

  if (publisherType === 'company') {
    return 'Company';
  }

  return 'Member';
}

function resolvePublisherBio(
  category: CommunityCategory,
  publisherType: CommunityPublisherType,
  company?: string,
  authorBio?: string,
) {
  if (authorBio) {
    return authorBio;
  }

  if (publisherType === 'official') {
    return 'Platform update';
  }

  if (publisherType === 'company' && category === 'recruitment') {
    return 'Company hiring publisher';
  }

  if (publisherType === 'company' && category === 'services') {
    return company ? `${company} service listing` : 'Online service provider';
  }

  if (publisherType === 'company' && category === 'partnerships') {
    return company ? `${company} partnership listing` : 'Business partnership initiator';
  }

  return 'Community member';
}

function bucketFromText(text: string): CommunityCategory | undefined {
  for (const category of Object.keys(CATEGORY_PATTERNS) as CommunityCategory[]) {
    if (CATEGORY_PATTERNS[category].some((pattern) => pattern.test(text))) {
      return category;
    }
  }
  return undefined;
}

function resolveServiceLineFromText(text: string): CommunityServiceLine | undefined {
  const normalized = text.toLowerCase();
  for (const entry of SERVICE_LINE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(normalized))) {
      return entry.serviceLine;
    }
  }
  return undefined;
}

function resolveDeliveryModeFromMeta(meta: CommunityMetaPayload, text: string): CommunityDeliveryMode | undefined {
  if (meta.deliveryMode) {
    return meta.deliveryMode;
  }

  if (HYBRID_PATTERN.test(text)) {
    return 'hybrid';
  }

  if (ONSITE_PATTERN.test(text)) {
    return 'onsite';
  }

  if (REMOTE_PATTERN.test(text)) {
    return 'online';
  }

  return undefined;
}

function normalizeCategoryAlias(value?: string) {
  return (value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function resolveCategoryBucket(category: CommunityCategoryDescriptor): CommunityCategory | undefined {
  const candidates = [
    normalizeCategoryAlias(category.code),
    normalizeCategoryAlias(category.name),
  ].filter(Boolean);

  for (const bucket of Object.keys(CANONICAL_BUCKET_ALIASES) as CommunityCategory[]) {
    const aliases = CANONICAL_BUCKET_ALIASES[bucket];
    if (candidates.some((candidate) => aliases.includes(candidate))) {
      return bucket;
    }
  }

  return bucketFromText(candidates.join(' '));
}

function createCategoryCatalog(categories: CommunityCategoryPayload[]): CommunityCategoryCatalog {
  const items = categories
    .map((item) => {
      const id = toIdString(item.id);
      if (!id) {
        return null;
      }

      const descriptor: CommunityCategoryDescriptor = {
        id,
        code: toOptionalString(item.code),
        name: toOptionalString(item.name),
      };
      descriptor.bucket = resolveCategoryBucket(descriptor);
      return descriptor;
    })
    .filter((item): item is CommunityCategoryDescriptor => Boolean(item));

  const byId = new Map(items.map((item) => [item.id, item]));
  const preferredByBucket = Object.fromEntries(
    (Object.keys(CANONICAL_BUCKET_ALIASES) as CommunityCategory[]).flatMap((bucket) => {
      const exact = items.find((item) => {
        const candidates = [normalizeCategoryAlias(item.code), normalizeCategoryAlias(item.name)];
        return candidates.some((candidate) => CANONICAL_BUCKET_ALIASES[bucket].includes(candidate));
      });
      const derived = items.find((item) => item.bucket === bucket);
      const categoryId = exact?.id || derived?.id;
      return categoryId ? [[bucket, categoryId]] : [];
    }),
  ) as Partial<Record<CommunityCategory, string>>;

  const defaultCategoryId =
    items.find((item) => normalizeCategoryAlias(item.code) === 'app-moment-default')?.id || items[0]?.id;

  return {
    items,
    byId,
    preferredByBucket,
    defaultCategoryId,
  };
}

function resolveCommunityCategory(
  feed: CommunityFeedPayload,
  category: CommunityCategoryDescriptor | undefined,
  meta: CommunityMetaPayload,
  content: string,
) {
  if (category?.bucket) {
    return category.bucket;
  }

  if (meta.serviceLine) {
    return 'services';
  }

  if (meta.publisherType === 'official') {
    return 'news';
  }

  const inferred = bucketFromText(
    normalizeText(
      category?.code,
      category?.name,
      feed.title,
      content,
      ...(feed.tags || []),
    ),
  );
  return inferred || 'recruitment';
}

function resolvePublisherType(
  feed: CommunityFeedPayload,
  category: CommunityCategory,
  meta: CommunityMetaPayload,
) {
  if (meta.publisherType) {
    return meta.publisherType;
  }

  const authorName = toOptionalString(feed.author?.name);
  if (category === 'news' || OFFICIAL_AUTHOR_PATTERN.test(normalizeText(authorName, feed.author?.bio))) {
    return 'official';
  }

  if (meta.company || category === 'services' || category === 'partnerships' || category === 'recruitment') {
    return 'company';
  }

  return 'personal';
}

function resolveCompany(feed: CommunityFeedPayload, publisherType: CommunityPublisherType, meta: CommunityMetaPayload) {
  if (meta.company) {
    return meta.company;
  }

  if (publisherType === 'personal') {
    return undefined;
  }

  const authorName = toOptionalString(feed.author?.name);
  return isGenericAuthorName(authorName) ? undefined : authorName;
}

function mapCommentToCommunityComment(comment: CommunityCommentPayload): CommunityComment | null {
  const id = toOptionalString(comment.commentId);
  if (!id) {
    return null;
  }

  return {
    id,
    author: {
      name: toOptionalString(comment.author?.name) || `User-${comment.userId ?? 'unknown'}`,
      avatar: toOptionalString(comment.author?.avatar) || DEFAULT_AUTHOR_AVATAR,
    },
    content: toOptionalString(comment.content) || '',
    createdAt: toOptionalString(comment.createdAt) || formatDatetime(now()),
    likes: toNumber(comment.likes),
  };
}

function mapFeedToCommunityPost(
  feed: CommunityFeedPayload,
  categories: CommunityCategoryCatalog,
): CommunityPost | null {
  const id = toIdString(feed.id);
  if (!id) {
    return null;
  }

  const category = categories.byId.get(toIdString(feed.categoryId));
  const parsed = parseCommunityStoredContent(toOptionalString(feed.content) || toOptionalString(feed.summary) || '');
  const derivedCategory = resolveCommunityCategory(feed, category, parsed.meta, parsed.content);
  const publisherType = resolvePublisherType(feed, derivedCategory, parsed.meta);
  const company = resolveCompany(feed, publisherType, parsed.meta);
  const authorName = toOptionalString(feed.author?.name) || company || 'Community User';
  const authorBio = resolvePublisherBio(derivedCategory, publisherType, company, toOptionalString(feed.author?.bio));
  const serviceLine =
    parsed.meta.serviceLine ||
    resolveServiceLineFromText(
      normalizeText(
        parsed.content,
        feed.title,
        category?.code,
        category?.name,
        ...(feed.tags || []),
      ),
    );
  const deliveryMode = resolveDeliveryModeFromMeta(
    parsed.meta,
    normalizeText(parsed.meta.location, parsed.content, feed.title, ...(feed.tags || [])),
  );

  return {
    id,
    title: toOptionalString(feed.title) || deriveTitleFromContent(parsed.content),
    content: parsed.content,
    author: {
      name: authorName,
      avatar: toOptionalString(feed.author?.avatar) || DEFAULT_AUTHOR_AVATAR,
      role: resolvePublisherRole(derivedCategory, publisherType),
      bio: authorBio,
    },
    category: derivedCategory,
    publisherType,
    tags: normalizeStringArray(feed.tags),
    stats: {
      likes: toNumber(feed.likeCount),
      comments: toNumber(feed.commentCount),
      views: toNumber(feed.viewCount),
    },
    createdAt: toOptionalString(feed.createdAt) || formatDatetime(now()),
    coverImage: toOptionalString(feed.coverImage),
    location: parsed.meta.location,
    compensation: parsed.meta.compensation,
    company,
    employmentType: parsed.meta.employmentType,
    contactPreference: parsed.meta.contactPreference,
    serviceLine,
    deliveryMode,
    turnaround: parsed.meta.turnaround,
    isFeatured: Boolean(feed.isTop || feed.isHot || feed.isRecommended),
    assistantActions: parsed.meta.assistantActions || getDefaultAssistantActions(derivedCategory),
    backendCategoryId: category?.id || toIdString(feed.categoryId) || undefined,
    backendCategoryCode: category?.code,
    backendCategoryName: category?.name,
    isLiked: Boolean(feed.isLiked),
    isBookmarked: Boolean(feed.isCollected),
  };
}

function matchesCategory(post: CommunityPost, category?: string) {
  if (!category || category === 'all' || category === 'latest' || category === 'popular') {
    return true;
  }

  if (category === 'featured') {
    return post.isFeatured === true;
  }

  return post.category === category;
}

function sortPosts(posts: CommunityPost[], category?: string) {
  const sorted = [...posts];

  if (category === 'popular') {
    sorted.sort((left, right) => right.stats.likes - left.stats.likes);
    return sorted;
  }

  sorted.sort((left, right) => {
    const createdAtDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return Number(right.isFeatured === true) - Number(left.isFeatured === true);
  });

  return sorted;
}

function matchesQuery(post: CommunityPost, query?: string) {
  const normalizedQuery = (query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchable = normalizeText(
    post.title,
    post.content,
    post.author.name,
    post.author.bio,
    post.company,
    post.location,
    post.compensation,
    post.employmentType,
    post.contactPreference,
    post.serviceLine,
    post.deliveryMode,
    post.turnaround,
    post.backendCategoryCode,
    post.backendCategoryName,
    ...post.tags,
  );

  return searchable.includes(normalizedQuery);
}

function defaultClientFactory() {
  return getagentstudioAppClientWithSession() as unknown as CommunitySdkClient;
}

async function unwrapCommunitySdkResponse<T>(payload: unknown, fallbackMessage: string) {
  return unwrapAppSdkResponse<T>(payload as T, fallbackMessage);
}

function resolveCachedPromise<T>(entry: TimedPromise<T> | null) {
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.promise;
}

export function createCommunityService(
  options: CreateCommunityServiceOptions = {},
): ICommunityService {
  const getClient = options.getClient ?? defaultClientFactory;
  let categoryCache: TimedPromise<CommunityCategoryCatalog> | null = null;
  let feedCache: TimedPromise<CommunityPost[]> | null = null;

  async function loadCategoryCatalog() {
    const cached = resolveCachedPromise(categoryCache);
    if (cached) {
      return cached;
    }

    const promise = Promise.resolve(getClient()).then(async (client) => {
      const categories = await unwrapCommunitySdkResponse<CommunityCategoryPayload[]>(
        await client.category.listCategories({
          type: CATEGORY_TYPE,
        }),
        'Failed to load community categories.',
      );
      return createCategoryCatalog(categories);
    });

    categoryCache = {
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      promise,
    };

    return promise;
  }

  async function loadPosts() {
    const cached = resolveCachedPromise(feedCache);
    if (cached) {
      return cached;
    }

    const promise = Promise.all([Promise.resolve(getClient()), loadCategoryCatalog()]).then(
      async ([client, categories]) => {
        const feeds = await unwrapCommunitySdkResponse<CommunityFeedPayload[]>(
          await client.feed.getFeedList({
            type: FEED_QUERY_TYPE,
            page: 1,
            size: FEED_PAGE_SIZE,
          }),
          'Failed to load community posts.',
        );

        return feeds
          .map((feed) => mapFeedToCommunityPost(feed, categories))
          .filter((item): item is CommunityPost => Boolean(item));
      },
    );

    feedCache = {
      expiresAt: Date.now() + FEED_CACHE_TTL_MS,
      promise,
    };

    return promise;
  }

  async function mapSingleFeed(feed: CommunityFeedPayload) {
    const categories = await loadCategoryCatalog();
    const post = mapFeedToCommunityPost(feed, categories);
    if (!post) {
      throw new Error('Failed to map community post.');
    }
    return post;
  }

  function invalidateFeedCache() {
    feedCache = null;
  }

  function resolveCategoryId(category: CommunityCategory, categories: CommunityCategoryCatalog) {
    return categories.preferredByBucket[category] || categories.defaultCategoryId;
  }

  return {
    async getList(params: ListParams & { category?: string } = {}) {
      const posts = await this.getPosts(params.category, params.keyword);
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const total = posts.length;
      const fromIdx = (page - 1) * pageSize;
      const items = posts.slice(fromIdx, fromIdx + pageSize);
      const hasMore = fromIdx + pageSize < total;

      return {
        items,
        pageInfo: {
          mode: 'offset',
          page,
          pageSize,
          hasMore,
          totalItems: String(total),
        },
      };
    },

    async getById(id: string) {
      try {
        return await this.getPost(id);
      } catch {
        return null;
      }
    },

    async create(data: CreatePostDTO) {
      return this.createPost({
        ...data,
        publisherType: data.publisherType ?? 'personal',
        assistantActions: data.assistantActions ?? getDefaultAssistantActions(data.category),
      });
    },

    async update(_id: string, _data: UpdatePostDTO) {
      throw new Error('Community post update is not supported by the current app SDK contract.');
    },

    async delete(id: string) {
      const client = await Promise.resolve(getClient());
      const deleted = await unwrapCommunitySdkResponse<boolean>(
        await client.feed.delete(id),
        'Failed to delete community post.',
      );
      invalidateFeedCache();
      return Boolean(deleted);
    },

    async getPosts(category?: string, query?: string) {
      const posts = await loadPosts();
      const filtered = posts.filter((post) => matchesCategory(post, category)).filter((post) => matchesQuery(post, query));
      return sortPosts(filtered, category);
    },

    async getPost(id: string) {
      const client = await Promise.resolve(getClient());
      const feed = await unwrapCommunitySdkResponse<CommunityFeedPayload>(
        await client.feed.getFeedDetail(id),
        'Failed to load community post details.',
      );
      return mapSingleFeed(feed);
    },

    async getComments(postId: string) {
      const client = await Promise.resolve(getClient());
      const payload = await unwrapCommunitySdkResponse<CommunityCommentPagePayload>(
        await client.comment.getComments({
          contentType: 'feeds',
          contentId: toPositiveInteger(postId),
          page: 1,
          size: COMMENT_PAGE_SIZE,
        }),
        'Failed to load community comments.',
      );

      return (payload.content || [])
        .map(mapCommentToCommunityComment)
        .filter((item): item is CommunityComment => Boolean(item));
    },

    async likePost(id: string) {
      const client = await Promise.resolve(getClient());
      await unwrapCommunitySdkResponse<CommunityFeedPayload>(
        await client.feed.like(id),
        'Failed to like community post.',
      );
      invalidateFeedCache();
    },

    async bookmarkPost(id: string) {
      const client = await Promise.resolve(getClient());
      await unwrapCommunitySdkResponse<CommunityFeedPayload>(
        await client.feed.collect(id),
        'Failed to bookmark community post.',
      );
      invalidateFeedCache();
    },

    async sharePost(id: string) {
      const client = await Promise.resolve(getClient());
      await unwrapCommunitySdkResponse<CommunityFeedPayload>(
        await client.feed.share(id),
        'Failed to share community post.',
      );
      invalidateFeedCache();
    },

    async addComment(postId: string, content: string) {
      const client = await Promise.resolve(getClient());
      const comment = await unwrapCommunitySdkResponse<CommunityCommentPayload>(
        await client.comment.createComment({
          contentType: 'feeds',
          contentId: toPositiveInteger(postId),
          content: content.trim(),
          deviceInfo: COMMUNITY_DEVICE_INFO,
        }),
        'Failed to add community comment.',
      );
      const mappedComment = mapCommentToCommunityComment(comment);
      if (!mappedComment) {
        throw new Error('Failed to map created community comment.');
      }
      invalidateFeedCache();
      return mappedComment;
    },

    async createPost(post: Omit<CommunityPost, 'id' | 'author' | 'stats' | 'createdAt'>) {
      const client = await Promise.resolve(getClient());
      const categories = await loadCategoryCatalog();
      const resolvedCategoryId = resolveCategoryId(post.category, categories);
      const created = await unwrapCommunitySdkResponse<CommunityFeedPayload>(
        await client.feed.create({
          title: post.title.trim(),
          content: buildCommunityStoredContent(post.content, {
            publisherType: post.publisherType,
            location: post.location,
            compensation: post.compensation,
            company: post.company,
            employmentType: post.employmentType,
            contactPreference: post.contactPreference,
            serviceLine: post.serviceLine,
            deliveryMode: post.deliveryMode,
            turnaround: post.turnaround,
            assistantActions: post.assistantActions,
          }),
          categoryId: resolvedCategoryId ? Number(resolvedCategoryId) : undefined,
          images: post.coverImage ? [post.coverImage] : undefined,
          source: COMMUNITY_SOURCE,
          tags: normalizeStringArray(post.tags),
        }),
        'Failed to publish community post.',
      );

      invalidateFeedCache();
      return mapSingleFeed(created);
    },
  };
}

export const communityService = createCommunityService();
