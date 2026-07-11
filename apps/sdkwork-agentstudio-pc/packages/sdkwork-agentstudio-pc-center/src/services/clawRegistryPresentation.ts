import type { ClawRegistryEntry, ClawRegistryQuickConnectAction } from '../types';

export interface ClawRegistryCatalogEntry extends ClawRegistryEntry {
  searchScore: number;
  matchReasons: string[];
}

export interface ClawRegistryCatalog {
  keyword: string;
  activeCategory: string;
  categories: string[];
  entries: ClawRegistryCatalogEntry[];
}

export interface ClawRegistryQuickConnectCandidate {
  id: string;
  runtimeKind: string;
  status: string;
  transportKind: string;
  baseUrl?: string | null;
  websocketUrl?: string | null;
}

const PREFERRED_CATEGORY_ORDER = [
  'Engineering',
  'Research',
  'Operations',
  'Support',
  'Content',
  'Automation',
] as const;

const SEARCH_REASON_LIMIT = 2;
const SEARCH_SUGGESTION_LIMIT = 8;

const SEARCH_GROUPS = [
  {
    weight: 140,
    getValues: (entry: ClawRegistryEntry) => [entry.name],
  },
  {
    weight: 110,
    getValues: (entry: ClawRegistryEntry) => entry.capabilities,
  },
  {
    weight: 95,
    getValues: (entry: ClawRegistryEntry) => entry.searchTerms,
  },
  {
    weight: 85,
    getValues: (entry: ClawRegistryEntry) => entry.bestFor,
  },
  {
    weight: 72,
    getValues: (entry: ClawRegistryEntry) => entry.tags,
  },
  {
    weight: 54,
    getValues: (entry: ClawRegistryEntry) => [
      entry.category,
      ...entry.serviceModes,
      ...entry.integrations,
    ],
  },
  {
    weight: 26,
    getValues: (entry: ClawRegistryEntry) => [
      entry.summary,
      entry.description,
      entry.region,
      entry.latency,
    ],
  },
] as const;

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function normalizeSearchTokens(keyword: string) {
  return normalizeKeyword(keyword)
    .split(/\s+/)
    .filter(Boolean);
}

function dedupeValues(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeKeyword(value);
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    result.push(value);
  }

  return result;
}

function buildSearchMetadata(entry: ClawRegistryEntry, keyword: string) {
  const tokens = normalizeSearchTokens(keyword);
  if (tokens.length === 0) {
    return {
      searchScore: 0,
      matchReasons: [] as string[],
    };
  }

  let score = 0;
  const reasons: string[] = [];

  for (const token of tokens) {
    let tokenMatched = false;

    for (const group of SEARCH_GROUPS) {
      const match = group.getValues(entry).find((value) => normalizeKeyword(value).includes(token));
      if (!match) {
        continue;
      }

      tokenMatched = true;
      score += group.weight;
      if (normalizeKeyword(match) === token) {
        score += 24;
      }
      reasons.push(match);
    }

    if (!tokenMatched) {
      return null;
    }
  }

  return {
    searchScore: score + tokens.length * 6,
    matchReasons: dedupeValues(reasons).slice(0, SEARCH_REASON_LIMIT),
  };
}

function matchesCategory(entry: ClawRegistryEntry, activeCategory: string) {
  return activeCategory === 'All' || entry.category === activeCategory;
}

function sortRegistryEntries<T extends ClawRegistryEntry & { searchScore?: number }>(entries: T[]) {
  return [...entries].sort((left, right) => {
    const leftSearchScore = left.searchScore || 0;
    const rightSearchScore = right.searchScore || 0;

    if (rightSearchScore !== leftSearchScore) {
      return rightSearchScore - leftSearchScore;
    }

    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    if (left.verified !== right.verified) {
      return left.verified ? -1 : 1;
    }

    if (right.matchCount !== left.matchCount) {
      return right.matchCount - left.matchCount;
    }

    if (right.activeAgents !== left.activeAgents) {
      return right.activeAgents - left.activeAgents;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortLatestRegistryEntries<T extends ClawRegistryEntry>(entries: T[]) {
  return [...entries].sort((left, right) => {
    const leftUpdatedAt = Date.parse(left.updatedAt);
    const rightUpdatedAt = Date.parse(right.updatedAt);

    if (rightUpdatedAt !== leftUpdatedAt) {
      return rightUpdatedAt - leftUpdatedAt;
    }

    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    if (left.verified !== right.verified) {
      return left.verified ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortPopularRegistryEntries<T extends ClawRegistryEntry>(entries: T[]) {
  return [...entries].sort((left, right) => {
    if (right.matchCount !== left.matchCount) {
      return right.matchCount - left.matchCount;
    }

    if (right.activeAgents !== left.activeAgents) {
      return right.activeAgents - left.activeAgents;
    }

    if (left.verified !== right.verified) {
      return left.verified ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function createRegistryCategoryIds(entries: ClawRegistryEntry[]) {
  const existingCategories = new Set(
    entries
      .map((entry) => entry.category.trim())
      .filter((category) => Boolean(category)),
  );

  const preferredCategories = PREFERRED_CATEGORY_ORDER.filter((category) =>
    existingCategories.has(category),
  );
  const extraCategories = [...existingCategories]
    .filter(
      (category) =>
        !PREFERRED_CATEGORY_ORDER.includes(category as (typeof PREFERRED_CATEGORY_ORDER)[number]),
    )
    .sort((left, right) => left.localeCompare(right));

  return ['All', ...preferredCategories, ...extraCategories];
}

export function createRegistryCatalog(input: {
  entries: ClawRegistryEntry[];
  keyword: string;
  activeCategory: string;
}): ClawRegistryCatalog {
  const entries = sortRegistryEntries(
    input.entries
      .filter((entry) => matchesCategory(entry, input.activeCategory))
      .map((entry) => {
        const searchMetadata = buildSearchMetadata(entry, input.keyword);
        if (input.keyword.trim() && !searchMetadata) {
          return null;
        }

        return {
          ...entry,
          searchScore: searchMetadata?.searchScore || 0,
          matchReasons: searchMetadata?.matchReasons || [],
        };
      })
      .filter((entry): entry is ClawRegistryCatalogEntry => Boolean(entry)),
  );

  return {
    keyword: input.keyword,
    activeCategory: input.activeCategory,
    categories: createRegistryCategoryIds(input.entries),
    entries,
  };
}

export function selectRegistrySpotlight<T extends ClawRegistryEntry>(entries: T[], limit = 3) {
  return sortRegistryEntries(entries).slice(0, limit);
}

export function selectLatestRegistryEntries<T extends ClawRegistryEntry>(entries: T[], limit = 4) {
  return sortLatestRegistryEntries(entries).slice(0, limit);
}

export function selectPopularRegistryEntries<T extends ClawRegistryEntry>(entries: T[], limit = 4) {
  return sortPopularRegistryEntries(entries).slice(0, limit);
}

export function selectRecommendedRegistryEntries<T extends ClawRegistryEntry>(
  entries: T[],
  limit = 4,
) {
  return sortRegistryEntries(entries).slice(0, limit);
}

export function createRegistrySearchSuggestions(entries: ClawRegistryEntry[], limit = SEARCH_SUGGESTION_LIMIT) {
  const suggestions: string[] = [];
  const sortedEntries = sortRegistryEntries(entries);

  for (const entry of sortedEntries) {
    const candidates = [...entry.bestFor, ...entry.capabilities, ...entry.tags];
    for (const candidate of candidates) {
      if (normalizeKeyword(candidate).length < 3) {
        continue;
      }

      suggestions.push(candidate);
      const dedupedSuggestions = dedupeValues(suggestions);
      if (dedupedSuggestions.length >= limit) {
        return dedupedSuggestions.slice(0, limit);
      }
    }
  }

  return dedupeValues(suggestions).slice(0, limit);
}

export function supportsRegistryQuickConnectInstance(
  candidate: ClawRegistryQuickConnectCandidate,
) {
  return candidate.transportKind === 'openclawGatewayWs';
}

export function isRegistryGatewayReadyInstance(candidate: ClawRegistryQuickConnectCandidate) {
  return (
    supportsRegistryQuickConnectInstance(candidate) &&
    candidate.status === 'online' &&
    Boolean(candidate.baseUrl || candidate.websocketUrl)
  );
}

export function resolveRegistryQuickConnectAction(
  candidates: ClawRegistryQuickConnectCandidate[],
): ClawRegistryQuickConnectAction {
  const gatewayReady = candidates.find(isRegistryGatewayReadyInstance);
  if (gatewayReady) {
    return {
      kind: 'chat',
      to: '/chat',
      instanceId: gatewayReady.id,
    };
  }

  const quickConnectInstance = candidates.find(supportsRegistryQuickConnectInstance);
  if (quickConnectInstance) {
    return {
      kind: 'instance',
      to: `/instances/${quickConnectInstance.id}`,
      instanceId: quickConnectInstance.id,
    };
  }

  return {
    kind: 'install',
    to: '/docs#script',
    instanceId: null,
  };
}

export function buildRegistryConnectCommand(entry: ClawRegistryEntry) {
  const args = ['openclaw', 'acp'];
  const url = entry.connection.websocketUrl || entry.connection.gatewayUrl;

  if (url) {
    args.push('--url', url);
  }

  if (entry.connection.authMode === 'token') {
    args.push(
      '--token',
      entry.connection.token || entry.connection.tokenPlaceholder || '<gateway-token>',
    );
  }

  if (entry.connection.defaultSession) {
    args.push('--session', entry.connection.defaultSession);
  }

  return args.join(' ');
}
