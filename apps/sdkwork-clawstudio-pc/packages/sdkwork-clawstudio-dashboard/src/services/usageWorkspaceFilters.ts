import type {
  UsageWorkspaceAggregates,
  UsageWorkspaceLogEntry,
  UsageWorkspaceSession,
} from '../types/usage.ts';

export interface UsageWorkspaceQueryTerm {
  key?: string;
  value: string;
  raw: string;
}

export interface UsageWorkspaceQueryResult<TSession> {
  sessions: TSession[];
  warnings: string[];
}

export interface UsageWorkspaceQuerySuggestion {
  label: string;
  value: string;
}

export interface UsageWorkspaceLogFilterState {
  roles: string[];
  tools: string[];
  hasTools: boolean;
  query: string;
}

export interface UsageWorkspaceParsedLogEntry {
  log: UsageWorkspaceLogEntry;
  cleanContent: string;
  tools: Array<[string, number]>;
  summary: string;
}

const QUERY_KEYS = [
  'agent',
  'channel',
  'provider',
  'model',
  'tool',
  'label',
  'key',
  'session',
  'id',
  'has',
  'mintokens',
  'maxtokens',
  'mincost',
  'maxcost',
  'minmessages',
  'maxmessages',
] as const;

const QUERY_KEY_SET = new Set<string>(QUERY_KEYS);

function normalizeQueryText(value: string) {
  return value.trim().toLowerCase();
}

function parseUsageQueryNumber(value: string) {
  let normalized = normalizeQueryText(value);
  if (!normalized) return null;
  if (normalized.startsWith('$')) normalized = normalized.slice(1);

  let multiplier = 1;
  if (normalized.endsWith('k')) {
    multiplier = 1_000;
    normalized = normalized.slice(0, -1);
  } else if (normalized.endsWith('m')) {
    multiplier = 1_000_000;
    normalized = normalized.slice(0, -1);
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function globToRegExp(pattern: string) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function getSessionText(session: UsageWorkspaceSession) {
  return [session.label, session.key, session.sessionId]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
}

function getSessionProviders(session: UsageWorkspaceSession) {
  const providers = new Set<string>();
  if (session.modelProvider) providers.add(session.modelProvider.toLowerCase());
  if (session.providerOverride) providers.add(session.providerOverride.toLowerCase());
  for (const entry of session.usage?.modelUsage ?? []) {
    if (entry.provider) providers.add(entry.provider.toLowerCase());
  }
  return [...providers];
}

function getSessionModels(session: UsageWorkspaceSession) {
  const models = new Set<string>();
  if (session.model) models.add(session.model.toLowerCase());
  if (session.modelOverride) models.add(session.modelOverride.toLowerCase());
  for (const entry of session.usage?.modelUsage ?? []) {
    if (entry.model) models.add(entry.model.toLowerCase());
  }
  return [...models];
}

function getSessionTools(session: UsageWorkspaceSession) {
  return (session.usage?.toolUsage.tools ?? []).map((tool) => tool.name.toLowerCase());
}

function uniqueStrings(values: Array<string | undefined>) {
  const seen = new Set<string>();
  for (const value of values) {
    if (value) seen.add(value);
  }
  return [...seen];
}

export function extractUsageWorkspaceQueryTerms(query: string): UsageWorkspaceQueryTerm[] {
  const rawTokens = query.match(/"[^"]+"|\S+/g) ?? [];
  return rawTokens.map((token) => {
    const cleaned = token.replace(/^"|"$/g, '');
    const splitIndex = cleaned.indexOf(':');
    if (splitIndex > 0) {
      return {
        key: cleaned.slice(0, splitIndex),
        value: cleaned.slice(splitIndex + 1),
        raw: cleaned,
      };
    }
    return { value: cleaned, raw: cleaned };
  });
}

function matchesUsageWorkspaceQuery(
  session: UsageWorkspaceSession,
  term: UsageWorkspaceQueryTerm,
) {
  const value = normalizeQueryText(term.value);
  if (!value) return true;
  if (!term.key) {
    return getSessionText(session).some((text) => text.includes(value));
  }

  const key = normalizeQueryText(term.key);
  switch (key) {
    case 'agent':
      return session.agentId?.toLowerCase().includes(value) ?? false;
    case 'channel':
      return session.channel?.toLowerCase().includes(value) ?? false;
    case 'provider':
      return getSessionProviders(session).some((provider) => provider.includes(value));
    case 'model':
      return getSessionModels(session).some((model) => model.includes(value));
    case 'tool':
      return getSessionTools(session).some((tool) => tool.includes(value));
    case 'label':
      return session.label?.toLowerCase().includes(value) ?? false;
    case 'key':
    case 'session':
    case 'id': {
      if (value.includes('*') || value.includes('?')) {
        const matcher = globToRegExp(value);
        return matcher.test(session.key) || (session.sessionId ? matcher.test(session.sessionId) : false);
      }
      return session.key.toLowerCase().includes(value) || (session.sessionId?.toLowerCase().includes(value) ?? false);
    }
    case 'has':
      switch (value) {
        case 'tools':
          return (session.usage?.toolUsage.totalCalls ?? 0) > 0;
        case 'errors':
          return (session.usage?.messageCounts.errors ?? 0) > 0;
        case 'usage':
          return Boolean(session.usage);
        case 'provider':
          return getSessionProviders(session).length > 0;
        case 'model':
          return getSessionModels(session).length > 0;
        default:
          return true;
      }
    case 'mintokens': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.totalTokens ?? 0) >= threshold;
    }
    case 'maxtokens': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.totalTokens ?? 0) <= threshold;
    }
    case 'mincost': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.totalCost ?? 0) >= threshold;
    }
    case 'maxcost': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.totalCost ?? 0) <= threshold;
    }
    case 'minmessages': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.messageCounts.total ?? 0) >= threshold;
    }
    case 'maxmessages': {
      const threshold = parseUsageQueryNumber(value);
      return threshold === null ? true : (session.usage?.messageCounts.total ?? 0) <= threshold;
    }
    default:
      return true;
  }
}

export function filterUsageWorkspaceSessionsByQuery<TSession extends UsageWorkspaceSession>(
  sessions: TSession[],
  query: string,
): UsageWorkspaceQueryResult<TSession> {
  const terms = extractUsageWorkspaceQueryTerms(query);
  if (terms.length === 0) {
    return { sessions, warnings: [] };
  }

  const warnings: string[] = [];
  for (const term of terms) {
    if (!term.key) continue;

    const normalizedKey = normalizeQueryText(term.key);
    if (!QUERY_KEY_SET.has(normalizedKey)) {
      warnings.push(`Unknown filter: ${term.key}`);
      continue;
    }

    if (term.value === '') {
      warnings.push(`Missing value for ${term.key}`);
      continue;
    }

    if (
      ['mintokens', 'maxtokens', 'mincost', 'maxcost', 'minmessages', 'maxmessages'].includes(
        normalizedKey,
      ) &&
      parseUsageQueryNumber(term.value) === null
    ) {
      warnings.push(`Invalid number for ${term.key}`);
    }
  }

  return {
    sessions: sessions.filter((session) =>
      terms.every((term) => matchesUsageWorkspaceQuery(session, term)),
    ),
    warnings,
  };
}

export function buildUsageWorkspaceQuerySuggestions(
  query: string,
  sessions: UsageWorkspaceSession[],
  aggregates?: UsageWorkspaceAggregates | null,
) {
  const trimmed = query.trim();
  const topLevelSuggestions = QUERY_KEYS.map((key) => ({
    label: `${key}:`,
    value: `${key}:`,
  }));

  if (!trimmed) return topLevelSuggestions.slice(0, 8);

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? '';

  if (!lastToken.includes(':')) {
    const prefix = normalizeQueryText(lastToken);
    return topLevelSuggestions.filter((entry) => normalizeQueryText(entry.value).startsWith(prefix));
  }

  const separatorIndex = lastToken.indexOf(':');
  const key = normalizeQueryText(lastToken.slice(0, separatorIndex));
  const value = normalizeQueryText(lastToken.slice(separatorIndex + 1));

  const providers = uniqueStrings([
    ...sessions.map((session) => session.modelProvider),
    ...sessions.map((session) => session.providerOverride),
    ...(aggregates?.byProvider.map((entry) => entry.provider) ?? []),
  ]).slice(0, 8);
  const models = uniqueStrings([
    ...sessions.map((session) => session.model),
    ...sessions.map((session) => session.modelOverride),
    ...(aggregates?.byModel.map((entry) => entry.model) ?? []),
  ]).slice(0, 8);
  const agents = uniqueStrings(sessions.map((session) => session.agentId)).slice(0, 8);
  const channels = uniqueStrings(sessions.map((session) => session.channel)).slice(0, 8);
  const tools = uniqueStrings(aggregates?.tools.tools.map((tool) => tool.name) ?? []).slice(0, 8);

  const suggestionsFor = (prefix: string, values: string[]) =>
    values
      .filter((entry) => !value || entry.toLowerCase().includes(value))
      .map((entry) => ({
        label: `${prefix}:${entry}`,
        value: `${prefix}:${entry}`,
      }));

  switch (key) {
    case 'provider':
      return suggestionsFor('provider', providers);
    case 'model':
      return suggestionsFor('model', models);
    case 'agent':
      return suggestionsFor('agent', agents);
    case 'channel':
      return suggestionsFor('channel', channels);
    case 'tool':
      return suggestionsFor('tool', tools);
    case 'has':
      return ['errors', 'tools', 'usage', 'provider', 'model']
        .filter((entry) => !value || entry.includes(value))
        .map((entry) => ({ label: `has:${entry}`, value: `has:${entry}` }));
    default:
      return [];
  }
}

export function applyUsageWorkspaceQuerySuggestion(query: string, suggestion: string) {
  const trimmed = query.trim();
  if (!trimmed) return `${suggestion} `;

  const tokens = trimmed.split(/\s+/);
  tokens[tokens.length - 1] = suggestion;
  return `${tokens.join(' ')} `;
}

export function addUsageWorkspaceQueryToken(query: string, token: string) {
  const trimmed = query.trim();
  if (!trimmed) return `${token} `;

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? '';
  const tokenKey = token.includes(':') ? token.split(':')[0] : null;
  const lastKey = lastToken.includes(':') ? lastToken.split(':')[0] : null;

  if (lastToken.endsWith(':') && tokenKey && lastKey === tokenKey) {
    tokens[tokens.length - 1] = token;
    return `${tokens.join(' ')} `;
  }
  if (tokens.includes(token)) return `${tokens.join(' ')} `;
  return `${tokens.join(' ')} ${token} `;
}

export function removeUsageWorkspaceQueryToken(query: string, token: string) {
  const nextTokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((entry) => entry !== token);
  return nextTokens.length ? `${nextTokens.join(' ')} ` : '';
}

export function setUsageWorkspaceQueryTokensForKey(
  query: string,
  key: string,
  values: string[],
) {
  const normalizedKey = normalizeQueryText(key);
  const retained = extractUsageWorkspaceQueryTerms(query)
    .filter((term) => normalizeQueryText(term.key ?? '') !== normalizedKey)
    .map((term) => term.raw);
  const nextTokens = [...retained, ...values.map((value) => `${key}:${value}`)];
  return nextTokens.length ? `${nextTokens.join(' ')} ` : '';
}

export function applyShiftRangeSelection<TValue extends string | number>(
  current: TValue[],
  value: TValue,
  ordered: TValue[],
  shiftKey: boolean,
) {
  if (!ordered.includes(value)) return current;

  if (shiftKey && current.length > 0) {
    const anchor = current[current.length - 1];
    const anchorIndex = ordered.indexOf(anchor);
    const targetIndex = ordered.indexOf(value);
    if (anchorIndex !== -1 && targetIndex !== -1) {
      const [start, end] =
        anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      return [...new Set([...current, ...ordered.slice(start, end + 1)])];
    }
  }

  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
}

export function parseUsageWorkspaceLogTools(content: string) {
  const lines = content.split('\n');
  const toolCounts = new Map<string, number>();
  const contentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = /^\[Tool:\s*([^\]]+)\]/.exec(trimmed);
    if (match) {
      const name = match[1];
      toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
      continue;
    }
    if (trimmed.startsWith('[Tool Result]')) continue;
    contentLines.push(line);
  }

  const tools = [...toolCounts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });

  const totalCalls = tools.reduce((sum, [, count]) => sum + count, 0);
  return {
    tools,
    summary:
      tools.length > 0
        ? `Tools: ${tools.map(([name, count]) => `${name} x${count}`).join(', ')} (${totalCalls} calls)`
        : '',
    cleanContent: contentLines.join('\n').trim(),
  };
}

export function filterUsageWorkspaceLogs(
  logs: UsageWorkspaceLogEntry[],
  filters: UsageWorkspaceLogFilterState,
) {
  const parsedEntries: UsageWorkspaceParsedLogEntry[] = logs.map((log) => {
    const parsed = parseUsageWorkspaceLogTools(log.content);
    return {
      log,
      cleanContent: parsed.cleanContent || log.content,
      tools: parsed.tools,
      summary: parsed.summary,
    };
  });

  const normalizedQuery = normalizeQueryText(filters.query);
  const toolOptions = [...new Set(parsedEntries.flatMap((entry) => entry.tools.map(([name]) => name)))]
    .sort((left, right) => left.localeCompare(right));

  const entries = parsedEntries.filter((entry) => {
    if (filters.roles.length > 0 && !filters.roles.includes(entry.log.role)) return false;
    if (filters.hasTools && entry.tools.length === 0) return false;
    if (filters.tools.length > 0) {
      const names = entry.tools.map(([name]) => name);
      if (!filters.tools.some((tool) => names.includes(tool))) return false;
    }
    if (normalizedQuery && !entry.cleanContent.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    return true;
  });

  return {
    entries,
    toolOptions,
  };
}
