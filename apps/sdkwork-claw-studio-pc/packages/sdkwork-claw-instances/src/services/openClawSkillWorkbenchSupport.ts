import type { OpenClawSkillsStatusResult } from '@sdkwork/claw-infrastructure';
import type { Skill } from '@sdkwork/claw-types';
import { isRecord, summarizeMarkdown } from './openClawSupport.ts';

export function inferSkillCategory(skillName: string, content: string) {
  const source = `${skillName} ${content}`.toLowerCase();

  if (source.includes('browser') || source.includes('web')) {
    return 'Integration';
  }
  if (source.includes('image') || source.includes('audio')) {
    return 'Media';
  }
  if (source.includes('cron') || source.includes('automation')) {
    return 'Automation';
  }
  if (source.includes('code') || source.includes('patch') || source.includes('git')) {
    return 'Code';
  }

  return 'General';
}

function normalizePath(path?: string | null) {
  const trimmed = path?.trim();
  return trimmed ? trimmed.replace(/\\/g, '/') : undefined;
}

function joinPath(root?: string | null, ...segments: string[]) {
  const normalizedRoot = normalizePath(root);
  if (!normalizedRoot) {
    return undefined;
  }

  return [normalizedRoot.replace(/\/+$/g, ''), ...segments].join('/');
}

function isEmbeddedWorkspaceSkillsPath(path?: string | null) {
  const normalized = normalizePath(path);
  return normalized
    ? /\/\.openclaw\/workspace(?:-[^/]+)?\/skills(?:\/|$)/.test(normalized)
    : false;
}

function countMissingRequirements(entry: Record<string, unknown>) {
  const missing = isRecord(entry.missing) ? entry.missing : undefined;
  if (!missing) {
    return 0;
  }

  return [
    Array.isArray(missing.bins) ? missing.bins.length : 0,
    Array.isArray(missing.anyBins) ? missing.anyBins.length : 0,
    Array.isArray(missing.env) ? missing.env.length : 0,
    Array.isArray(missing.config) ? missing.config.length : 0,
  ].reduce((total, count) => total + count, 0);
}

function resolveSkillScope(entry: Record<string, unknown>, workspacePath?: string | null) {
  const source = typeof entry.source === 'string' ? entry.source.trim().toLowerCase() : '';
  const baseDir = normalizePath(typeof entry.baseDir === 'string' ? entry.baseDir : undefined);
  const filePath = normalizePath(typeof entry.filePath === 'string' ? entry.filePath : undefined);
  const workspaceSkillsPath = joinPath(workspacePath, 'skills');

  if (entry.bundled === true || source.includes('bundled')) {
    return 'bundled' as const;
  }

  if (
    workspaceSkillsPath &&
    ((baseDir &&
      (baseDir === workspaceSkillsPath || baseDir.startsWith(`${workspaceSkillsPath}/`))) ||
      (filePath &&
        (filePath === workspaceSkillsPath || filePath.startsWith(`${workspaceSkillsPath}/`))) ||
      source.includes('workspace'))
  ) {
    return 'workspace' as const;
  }

  if (isEmbeddedWorkspaceSkillsPath(baseDir) || isEmbeddedWorkspaceSkillsPath(filePath)) {
    return 'workspace' as const;
  }

  if (
    source.includes('managed') ||
    source.includes('.openclaw/skills') ||
    baseDir?.includes('/.openclaw/skills') ||
    filePath?.includes('/.openclaw/skills')
  ) {
    return 'managed' as const;
  }

  return 'unknown' as const;
}

function buildSkillInstanceAsset(
  entry: Record<string, unknown>,
  workspacePath?: string | null,
): Skill['instanceAsset'] {
  const hasAssetMetadata =
    typeof entry.source === 'string' ||
    typeof entry.baseDir === 'string' ||
    typeof entry.filePath === 'string' ||
    typeof entry.bundled === 'boolean' ||
    typeof entry.disabled === 'boolean' ||
    typeof entry.blockedByAllowlist === 'boolean' ||
    typeof entry.eligible === 'boolean' ||
    isRecord(entry.missing);
  if (!hasAssetMetadata) {
    return undefined;
  }

  const source = typeof entry.source === 'string' && entry.source.trim() ? entry.source : 'unknown';
  const blocked = entry.blockedByAllowlist === true || entry.eligible === false;
  const missingRequirementCount = countMissingRequirements(entry);

  return {
    source,
    scope: resolveSkillScope(entry, workspacePath),
    status: blocked ? 'blocked' : entry.disabled === true ? 'disabled' : 'enabled',
    compatibility: blocked
      ? 'blocked'
      : missingRequirementCount > 0
        ? 'attention'
        : 'compatible',
    bundled: entry.bundled === true || source.toLowerCase().includes('bundled'),
    ...(typeof entry.filePath === 'string'
      ? { filePath: normalizePath(entry.filePath) }
      : {}),
    ...(typeof entry.baseDir === 'string'
      ? { baseDir: normalizePath(entry.baseDir) }
      : {}),
    missingRequirementCount,
  };
}

export function buildOpenClawSkills(status: OpenClawSkillsStatusResult): Skill[] {
  const workspacePath = typeof status.workspace === 'string' ? status.workspace : undefined;
  const entries =
    (Array.isArray(status.skills) ? status.skills : Array.isArray(status.entries) ? status.entries : [])
      .filter(isRecord);

  return entries.map((entry) => {
    const name =
      (typeof entry.name === 'string' && entry.name.trim()) ||
      (typeof entry.id === 'string' && entry.id.trim()) ||
      'Unnamed Skill';
    const readme = typeof entry.readme === 'string' ? entry.readme : undefined;
    const description =
      (typeof entry.description === 'string' && entry.description.trim()) ||
      (readme ? summarizeMarkdown(readme, 220) : 'Installed OpenClaw skill.');

    return {
      id: (typeof entry.id === 'string' && entry.id.trim()) || name,
      name,
      description,
      author:
        (typeof entry.author === 'string' && entry.author.trim()) || 'OpenClaw',
      rating: 5,
      downloads: 1,
      category: inferSkillCategory(name, `${description} ${readme || ''}`),
      icon: undefined,
      version: typeof entry.version === 'string' ? entry.version : undefined,
      size: typeof entry.size === 'string' ? entry.size : undefined,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
      readme,
      instanceAsset: buildSkillInstanceAsset(entry, workspacePath),
    };
  });
}
