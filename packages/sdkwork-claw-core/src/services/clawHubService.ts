import type {
  PageSkillVO,
  SdkworkAppClient,
  SkillCategoryVO,
  SkillPackageVO,
  SkillReviewVO,
  SkillVO,
} from '@sdkwork/app-sdk';
import type { Review, Skill, SkillPack } from '@sdkwork/claw-types';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import {
  getAppSdkClientWithSession,
  readAppSdkSessionTokens,
} from '../sdk/useAppSdkClient.ts';

export interface ClawHubCategory {
  id: string;
  code?: string;
  name: string;
  icon?: string;
}

export interface ClawHubSkillListParams {
  categoryId?: string;
  packageId?: string;
  keyword?: string;
  sortBy?: string;
}

export interface ClawHubPackageListParams {
  categoryId?: string;
  keyword?: string;
}

type ClawHubClient = Pick<SdkworkAppClient, 'skill'>;
type ClawHubSessionTokens = {
  authToken?: string | null;
};

export interface CreateClawHubServiceOptions {
  getClient?: () => ClawHubClient;
  getSessionTokens?: () => ClawHubSessionTokens;
}

export interface ClawHubService {
  listCategories(): Promise<ClawHubCategory[]>;
  listSkills(params?: ClawHubSkillListParams): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill>;
  listPackages(params?: ClawHubPackageListParams): Promise<SkillPack[]>;
  getPackage(id: string): Promise<SkillPack>;
  listReviews(skillId: string): Promise<Review[]>;
}

const SKILL_PAGE_SIZE = 100;
const MAX_SKILL_PAGES = 25;

function getDefaultClient(): ClawHubClient {
  return getAppSdkClientWithSession();
}

function getDefaultSessionTokens(): ClawHubSessionTokens {
  return readAppSdkSessionTokens();
}

function toOptionalString(value: string | number | undefined | null): string | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  const normalized = (value || '').trim();
  return normalized || undefined;
}

function requireAuthToken(authToken?: string | null): boolean {
  return Boolean(toOptionalString(authToken));
}

function toIdString(value: string | number | undefined | null): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const normalized = toOptionalString(value);
  return normalized || '';
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

function toOptionalQueryValue(value: number | string | undefined | null): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = toOptionalString(value);
  return normalized || undefined;
}

function withDefinedQuery<T extends Record<string, number | string | undefined>>(query: T): T {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as T;
}

function pickDescription(value: SkillVO | SkillPackageVO): string {
  return toOptionalString(value.summary) || toOptionalString(value.description) || '';
}

function mapSkill(value: SkillVO | null | undefined): Skill {
  const candidate = (value || {}) as SkillVO & {
    descriptionMd?: string;
    id?: string | number;
  };
  const id = toIdString(candidate.skillId ?? candidate.id);

  return {
    id,
    skillKey: toOptionalString(candidate.skillKey),
    name: toOptionalString(candidate.name) || id || 'Unnamed Skill',
    description: pickDescription(candidate),
    author:
      toOptionalString(candidate.authorName) ||
      toOptionalString(candidate.provider) ||
      'SDKWork',
    rating: toNumber(candidate.ratingAvg),
    ratingCount:
      candidate.ratingCount === undefined || candidate.ratingCount === null
        ? undefined
        : toNumber(candidate.ratingCount),
    downloads: toNumber(candidate.installCount),
    category: toOptionalString(candidate.categoryName) || 'General',
    icon: toOptionalString(candidate.icon),
    version: toOptionalString(candidate.version),
    size: undefined,
    updatedAt: toOptionalString(candidate.updatedAt) || toOptionalString(candidate.latestPublishedAt),
    readme:
      toOptionalString(candidate.descriptionMd) ||
      toOptionalString(candidate.description) ||
      toOptionalString(candidate.summary),
    repositoryUrl: toOptionalString(candidate.repositoryUrl),
    homepageUrl: toOptionalString(candidate.homepageUrl),
    documentationUrl: toOptionalString(candidate.documentationUrl),
  };
}

function mapPackage(value: SkillPackageVO | null | undefined): SkillPack {
  const candidate = value || {};
  const id = toIdString(candidate.packageId);

  return {
    id,
    packageKey: toOptionalString(candidate.packageKey),
    name: toOptionalString(candidate.name) || id || 'Unnamed Package',
    description: pickDescription(candidate),
    author: toOptionalString(candidate.authorName) || 'SDKWork',
    rating: toNumber(candidate.ratingAvg),
    downloads: toNumber(candidate.installCount),
    skills: (candidate.skills || []).map(mapSkill),
    category: toOptionalString(candidate.categoryName) || 'General',
  };
}

function mapCategory(value: SkillCategoryVO | null | undefined): ClawHubCategory | null {
  const id = toIdString(value?.id);
  const name = toOptionalString(value?.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    code: toOptionalString(value?.code),
    name,
    icon: toOptionalString(value?.icon),
  };
}

function mapReview(value: SkillReviewVO | null | undefined): Review {
  const createdAt = toOptionalString(value?.createdAt) || '';

  return {
    id: toOptionalString(value?.reviewId) || createdAt || 'review',
    user: toIdString(value?.userId),
    user_name: toOptionalString(value?.userName) || 'Anonymous',
    rating: Math.max(0, Math.round(toNumber(value?.rating))),
    comment: toOptionalString(value?.comment) || '',
    date: createdAt,
    created_at: createdAt,
  };
}

function matchesPackageFilters(
  value: SkillPackageVO | null | undefined,
  params: ClawHubPackageListParams,
) {
  if (!value) {
    return false;
  }

  const categoryId = toOptionalString(params.categoryId);
  if (categoryId && toIdString(value.categoryId) !== categoryId) {
    return false;
  }

  const keyword = normalizeLookupKey(toOptionalString(params.keyword));
  if (!keyword) {
    return true;
  }

  const searchText = [
    value.packageKey,
    value.name,
    value.summary,
    value.description,
    value.categoryName,
    value.authorName,
    ...(value.tags || []),
  ]
    .map((item) => normalizeLookupKey(item))
    .join(' ');

  return searchText.includes(keyword);
}

function normalizeLookupKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

async function listAllSkillPages(
  client: ClawHubClient,
  params: ClawHubSkillListParams = {},
): Promise<SkillVO[]> {
  const results: SkillVO[] = [];
  let reachedTerminalPage = false;

  for (let pageNum = 1; pageNum <= MAX_SKILL_PAGES; pageNum += 1) {
    const page = unwrapAppSdkResponse<PageSkillVO>(
      await client.skill.list(withDefinedQuery({
        pageNum,
        pageSize: SKILL_PAGE_SIZE,
        categoryId: toOptionalQueryValue(params.categoryId),
        packageId: toOptionalQueryValue(params.packageId),
        keyword: toOptionalQueryValue(params.keyword),
        sortBy: toOptionalQueryValue(params.sortBy),
      })),
      'Failed to load ClawHub skills.',
    );
    const content = page.content || [];
    results.push(...content);

    if (page.last === true || content.length === 0) {
      reachedTerminalPage = true;
      break;
    }

    const totalPages = toNumber(page.totalPages);
    if (totalPages > 0 && pageNum >= totalPages) {
      reachedTerminalPage = true;
      break;
    }

    if (totalPages <= 1 && content.length < SKILL_PAGE_SIZE) {
      reachedTerminalPage = true;
      break;
    }
  }

  if (reachedTerminalPage) {
    return results;
  }

  throw new Error(
    `ClawHub skills pagination exceeded ${MAX_SKILL_PAGES} pages without reaching a terminal page.`,
  );
}

export function createClawHubService(
  options: CreateClawHubServiceOptions = {},
): ClawHubService {
  const getClient = options.getClient;
  const getSessionTokens = options.getSessionTokens;

  return {
    async listCategories() {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        return [];
      }

      const client = getClient ? getClient() : getDefaultClient();
      const payload = unwrapAppSdkResponse<SkillCategoryVO[]>(
        await client.skill.listCategories(),
        'Failed to load ClawHub categories.',
      );
      const categories = payload
        .map(mapCategory)
        .filter((item): item is ClawHubCategory => Boolean(item));
      return Array.from(new Map(categories.map((category) => [category.name, category])).values());
    },

    async listSkills(params = {}) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        return [];
      }

      const client = getClient ? getClient() : getDefaultClient();
      return (await listAllSkillPages(client, params)).map(mapSkill);
    },

    async getSkill(id: string) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        throw new Error('Failed to load ClawHub skill without an authenticated app session.');
      }

      const client = getClient ? getClient() : getDefaultClient();
      return mapSkill(
        unwrapAppSdkResponse<SkillVO>(
          await client.skill.detail(id),
          'Failed to load ClawHub skill details.',
        ),
      );
    },

    async listPackages(params = {}) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        return [];
      }

      const client = getClient ? getClient() : getDefaultClient();
      const payload = unwrapAppSdkResponse<SkillPackageVO[]>(
        await client.skill.listPackages(),
        'Failed to load ClawHub packages.',
      );
      return payload
        .filter((item) => matchesPackageFilters(item, params))
        .map(mapPackage);
    },

    async getPackage(id: string) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        throw new Error('Failed to load ClawHub package without an authenticated app session.');
      }

      const client = getClient ? getClient() : getDefaultClient();
      return mapPackage(
        unwrapAppSdkResponse<SkillPackageVO>(
          await client.skill.detailPackage(id),
          'Failed to load ClawHub package details.',
        ),
      );
    },

    async listReviews(skillId: string) {
      const sessionTokens = getSessionTokens ? getSessionTokens() : getDefaultSessionTokens();
      if (!requireAuthToken(sessionTokens.authToken)) {
        return [];
      }

      const client = getClient ? getClient() : getDefaultClient();
      const payload = unwrapAppSdkResponse<SkillReviewVO[]>(
        await client.skill.listReviews(skillId),
        'Failed to load ClawHub skill reviews.',
      );
      return payload.map(mapReview);
    },
  };
}

export const clawHubService = createClawHubService();
