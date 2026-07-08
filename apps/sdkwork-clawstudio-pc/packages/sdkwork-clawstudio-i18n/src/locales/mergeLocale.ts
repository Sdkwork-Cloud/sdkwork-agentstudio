function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function mergeLocaleResource<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }

  if (isRecord(base)) {
    const overrideRecord = isRecord(override) ? override : {};
    const mergedEntries = Object.entries(base).map(([key, value]) => [
      key,
      mergeLocaleResource(value, overrideRecord[key]),
    ]);
    const extraEntries = Object.entries(overrideRecord).filter(([key]) => !(key in base));
    return Object.fromEntries([...mergedEntries, ...extraEntries]) as T;
  }

  return (override === undefined ? base : override) as T;
}
