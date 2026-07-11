function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function extractOpenClawSecretEnvName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('${') && trimmed.endsWith('}')) {
    return trimmed.slice(2, -1).trim();
  }

  if (trimmed.toLowerCase().startsWith('env:')) {
    return trimmed.slice(4).trim();
  }

  return '';
}

export function describeOpenClawSecretSource(value: unknown) {
  if (value === undefined || value === null) {
    return 'not-configured';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'not-configured';
    }

    const envName = extractOpenClawSecretEnvName(trimmed);
    if (envName) {
      return `env:${envName}`;
    }

    return 'inline-secret';
  }

  if (isRecord(value)) {
    const source = typeof value.source === 'string' ? value.source.trim() : '';
    const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (source && provider && id) {
      return `${source}:${provider}:${id}`;
    }
  }

  return 'configured';
}

export function normalizeOpenClawSecretSource(value: unknown) {
  const described = describeOpenClawSecretSource(value);
  if (described === 'not-configured' || described === 'configured') {
    return '';
  }

  if (described !== 'inline-secret') {
    return described;
  }

  return typeof value === 'string' ? value.trim() : '';
}

export function serializeOpenClawSecretSource(value: unknown) {
  const normalized = normalizeOpenClawSecretSource(value);
  if (!normalized) {
    return '';
  }

  const envName = extractOpenClawSecretEnvName(normalized);
  if (envName) {
    return `\${${envName}}`;
  }

  return normalized;
}

export function presentOpenClawSecretSource(value: unknown) {
  return normalizeOpenClawSecretSource(value) || 'not-configured';
}
