import type {
  CommunityCategory,
  CommunityPost,
  CommunityServiceLine,
} from './communityService.ts';

export type CommunityRecommendationReason =
  | 'featured'
  | 'intent-service-line'
  | 'matched-service-line'
  | 'multi-listing'
  | 'online-delivery'
  | 'official-presence'
  | 'same-company'
  | 'same-service-line'
  | 'shared-category'
  | 'shared-location'
  | 'shared-tag';

export interface CommunityServiceRecommendation {
  post: CommunityPost;
  reasons: CommunityRecommendationReason[];
  score: number;
}

export interface CommunityCompanyRecommendation {
  company: string;
  primaryPost: CommunityPost;
  listingCount: number;
  categories: CommunityCategory[];
  reasons: CommunityRecommendationReason[];
  serviceLines: CommunityServiceLine[];
  score: number;
}

export interface CommunityRecommendations {
  relatedServices: CommunityServiceRecommendation[];
  relatedCompanies: CommunityCompanyRecommendation[];
}

const CATEGORY_SERVICE_LINE_HINTS: Record<CommunityCategory, CommunityServiceLine[]> = {
  'job-seeking': ['hr', 'consulting', 'content', 'training'],
  recruitment: ['hr', 'marketing', 'development', 'content'],
  services: [],
  partnerships: ['consulting', 'operations', 'marketing', 'legal'],
  news: [],
};

const TAG_SERVICE_LINE_HINTS: Record<string, CommunityServiceLine[]> = {
  'ai-agent': ['consulting', 'training'],
  'ai-product': ['consulting', 'development'],
  analysis: ['data'],
  automation: ['development', 'operations'],
  bi: ['data'],
  bookkeeping: ['tax'],
  branding: ['design', 'marketing'],
  community: ['operations'],
  compliance: ['legal'],
  consulting: ['consulting'],
  content: ['content', 'marketing'],
  contracts: ['legal'],
  copywriting: ['content'],
  dashboard: ['data'],
  data: ['data'],
  deck: ['design'],
  design: ['design'],
  development: ['development'],
  documentation: ['translation', 'content'],
  'employer-brand': ['marketing', 'hr'],
  enablement: ['training'],
  finance: ['tax'],
  gtm: ['consulting', 'marketing'],
  growth: ['marketing', 'consulting'],
  'help-center': ['content', 'translation'],
  hr: ['hr'],
  interview: ['hr'],
  ip: ['legal'],
  'landing-page': ['development', 'marketing'],
  legal: ['legal'],
  localization: ['translation'],
  marketing: ['marketing'],
  online: ['operations'],
  operations: ['operations'],
  partnership: ['consulting'],
  pricing: ['consulting'],
  product: ['consulting'],
  react: ['development'],
  recruitment: ['hr'],
  remote: ['operations'],
  resume: ['hr', 'content'],
  seo: ['marketing', 'content'],
  strategy: ['consulting'],
  support: ['operations'],
  tax: ['tax'],
  trademark: ['legal'],
  training: ['training'],
  translation: ['translation'],
  typescript: ['development'],
  video: ['marketing'],
};

function buildLocationSignals(location?: string) {
  const tokens = new Set<string>();

  if (!location) {
    return tokens;
  }

  const normalized = location.toLowerCase();

  normalized
    .split(/[\s/|,-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => tokens.add(token));

  if (/\u8fdc\u7a0b|remote|\u7ebf\u4e0a|online/.test(normalized)) {
    tokens.add('remote-capable');
  }

  if (/\u5168\u56fd|\u5168\u7403|global/.test(normalized)) {
    tokens.add('wide-coverage');
  }

  if (/\u4e0a\u6d77|shanghai/.test(normalized)) {
    tokens.add('shanghai');
  }

  if (/\u676d\u5dde|hangzhou/.test(normalized)) {
    tokens.add('hangzhou');
  }

  return tokens;
}

function intersectCount(left: Set<string>, right: Set<string>) {
  let count = 0;

  left.forEach((item) => {
    if (right.has(item)) {
      count += 1;
    }
  });

  return count;
}

function collectIntentServiceLines(post: CommunityPost) {
  const serviceLines = new Set<CommunityServiceLine>();

  if (post.serviceLine) {
    serviceLines.add(post.serviceLine);
  }

  CATEGORY_SERVICE_LINE_HINTS[post.category].forEach((serviceLine) => {
    serviceLines.add(serviceLine);
  });

  post.tags.forEach((tag) => {
    TAG_SERVICE_LINE_HINTS[tag.toLowerCase()]?.forEach((serviceLine) => {
      serviceLines.add(serviceLine);
    });
  });

  return serviceLines;
}

function postSignalSets(post: CommunityPost) {
  return {
    locations: buildLocationSignals(post.location),
    tags: new Set(post.tags.map((tag) => tag.toLowerCase())),
  };
}

function postSortScore(post: CommunityPost) {
  return post.stats.likes * 1000 + post.stats.views + Date.parse(post.createdAt) / 100000;
}

function pushReason(
  reasons: CommunityRecommendationReason[],
  reason: CommunityRecommendationReason,
) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function scoreServiceCandidate(
  currentPost: CommunityPost,
  candidate: CommunityPost,
  intentServiceLines: Set<CommunityServiceLine>,
  currentTags: Set<string>,
  currentLocations: Set<string>,
) {
  const candidateSignals = postSignalSets(candidate);
  const locationOverlap = intersectCount(currentLocations, candidateSignals.locations);
  const tagOverlap = intersectCount(currentTags, candidateSignals.tags);
  const reasons: CommunityRecommendationReason[] = [];
  let score = 0;

  if (currentPost.serviceLine && candidate.serviceLine === currentPost.serviceLine) {
    score += 80;
    pushReason(reasons, 'same-service-line');
  }

  if (candidate.serviceLine && intentServiceLines.has(candidate.serviceLine)) {
    score += currentPost.category === 'services' ? 12 : 40;
    pushReason(reasons, 'intent-service-line');
  }

  score += tagOverlap * 14;
  if (tagOverlap > 0) {
    pushReason(reasons, 'shared-tag');
  }

  score += Math.min(locationOverlap, 2) * 8;
  if (locationOverlap > 0) {
    pushReason(reasons, 'shared-location');
  }

  if (candidate.deliveryMode === 'online') {
    score += 4;
    pushReason(reasons, 'online-delivery');
  }

  if (candidate.isFeatured) {
    score += 5;
    pushReason(reasons, 'featured');
  }

  if (currentPost.category === 'recruitment' && candidate.serviceLine === 'hr') {
    score += 12;
  }

  if (currentPost.category === 'job-seeking' && candidate.serviceLine === 'hr') {
    score += 8;
  }

  if (currentPost.category === 'partnerships' && candidate.serviceLine === 'consulting') {
    score += 10;
  }

  return {
    reasons,
    score,
  };
}

function companyKey(post: CommunityPost) {
  if (post.publisherType === 'personal') {
    return null;
  }

  return post.company ?? post.author.name ?? null;
}

function collectCompanySignals(posts: CommunityPost[]) {
  const tags = new Set<string>();
  const locations = new Set<string>();
  const categories = new Set<CommunityCategory>();
  const serviceLines = new Set<CommunityServiceLine>();
  let hasFeatured = false;
  let hasOfficial = false;

  posts.forEach((post) => {
    post.tags.forEach((tag) => tags.add(tag.toLowerCase()));
    buildLocationSignals(post.location).forEach((token) => locations.add(token));
    categories.add(post.category);

    if (post.serviceLine) {
      serviceLines.add(post.serviceLine);
    }

    if (post.isFeatured) {
      hasFeatured = true;
    }

    if (post.publisherType === 'official') {
      hasOfficial = true;
    }
  });

  return {
    categories: [...categories],
    hasFeatured,
    hasOfficial,
    locations,
    serviceLines: [...serviceLines],
    tags,
  };
}

function scoreCompanyGroup(
  currentPost: CommunityPost,
  companyName: string,
  group: CommunityPost[],
  intentServiceLines: Set<CommunityServiceLine>,
  currentTags: Set<string>,
  currentLocations: Set<string>,
) {
  const companySignals = collectCompanySignals(group);
  const locationOverlap = intersectCount(currentLocations, companySignals.locations);
  const tagOverlap = intersectCount(currentTags, companySignals.tags);
  const serviceLineMatches = companySignals.serviceLines.filter((serviceLine) =>
    intentServiceLines.has(serviceLine),
  ).length;
  const sameCompany = Boolean(currentPost.company && currentPost.company === companyName);
  const reasons: CommunityRecommendationReason[] = [];
  let score = 0;

  if (sameCompany) {
    score += 100;
    pushReason(reasons, 'same-company');
  }

  if (companySignals.categories.includes(currentPost.category)) {
    score += 20;
    pushReason(reasons, 'shared-category');
  }

  score += serviceLineMatches * 24;
  if (serviceLineMatches > 0) {
    pushReason(reasons, 'matched-service-line');
  }

  score += tagOverlap * 10;
  if (tagOverlap > 0) {
    pushReason(reasons, 'shared-tag');
  }

  score += Math.min(locationOverlap, 2) * 8;
  if (locationOverlap > 0) {
    pushReason(reasons, 'shared-location');
  }

  if (group.length > 1) {
    score += 8;
    pushReason(reasons, 'multi-listing');
  }

  if (companySignals.hasFeatured) {
    score += 5;
    pushReason(reasons, 'featured');
  }

  if (companySignals.hasOfficial) {
    score += 6;
    pushReason(reasons, 'official-presence');
  }

  return {
    categories: companySignals.categories,
    reasons,
    sameCompany,
    score,
    serviceLines: companySignals.serviceLines,
  };
}

function selectPrimaryPost(
  currentPost: CommunityPost,
  candidates: CommunityPost[],
  intentServiceLines: Set<CommunityServiceLine>,
  currentTags: Set<string>,
  currentLocations: Set<string>,
) {
  return [...candidates].sort((left, right) => {
    const leftScore =
      scoreServiceCandidate(currentPost, left, intentServiceLines, currentTags, currentLocations)
        .score +
      postSortScore(left) / 1000000;
    const rightScore =
      scoreServiceCandidate(currentPost, right, intentServiceLines, currentTags, currentLocations)
        .score +
      postSortScore(right) / 1000000;

    return rightScore - leftScore;
  })[0];
}

export function buildCommunityRecommendations(
  currentPost: CommunityPost,
  posts: CommunityPost[],
  limits: { services?: number; companies?: number } = {},
): CommunityRecommendations {
  const serviceLimit = limits.services ?? 4;
  const companyLimit = limits.companies ?? 4;
  const intentServiceLines = collectIntentServiceLines(currentPost);
  const currentSignals = postSignalSets(currentPost);

  const relatedServices = posts
    .filter((post) => post.category === 'services' && post.id !== currentPost.id)
    .map((post) => {
      const { reasons, score } = scoreServiceCandidate(
        currentPost,
        post,
        intentServiceLines,
        currentSignals.tags,
        currentSignals.locations,
      );

      return {
        post,
        reasons,
        score,
      };
    })
    .filter((item) => item.score > 0 && item.reasons.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return postSortScore(right.post) - postSortScore(left.post);
    })
    .slice(0, serviceLimit);

  const companyGroups = new Map<string, CommunityPost[]>();

  posts.forEach((post) => {
    const key = companyKey(post);

    if (!key) {
      return;
    }

    const group = companyGroups.get(key) ?? [];
    group.push(post);
    companyGroups.set(key, group);
  });

  const relatedCompanies = [...companyGroups.entries()]
    .map(([company, group]) => {
      const { categories, reasons, sameCompany, score, serviceLines } = scoreCompanyGroup(
        currentPost,
        company,
        group,
        intentServiceLines,
        currentSignals.tags,
        currentSignals.locations,
      );
      const primaryPool = group.filter((post) => post.id !== currentPost.id);
      const primaryPost = selectPrimaryPost(
        currentPost,
        primaryPool.length > 0 ? primaryPool : group,
        intentServiceLines,
        currentSignals.tags,
        currentSignals.locations,
      );

      if (!primaryPost) {
        return null;
      }

      if (sameCompany && primaryPool.length === 0) {
        return null;
      }

      return {
        categories,
        company,
        listingCount: group.length,
        primaryPost,
        reasons,
        score,
        serviceLines,
      };
    })
    .filter(
      (item): item is CommunityCompanyRecommendation =>
        item !== null && item.score > 0 && item.reasons.length > 0,
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.listingCount !== left.listingCount) {
        return right.listingCount - left.listingCount;
      }

      return postSortScore(right.primaryPost) - postSortScore(left.primaryPost);
    })
    .slice(0, companyLimit);

  return {
    relatedCompanies,
    relatedServices,
  };
}
