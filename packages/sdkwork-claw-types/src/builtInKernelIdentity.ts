function normalizeRequiredString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeRuntimeId(value: string | null | undefined) {
  return normalizeRequiredString(value)?.toLowerCase() ?? null;
}

export function buildBuiltInKernelPrimaryInstanceId(
  runtimeId: string | null | undefined,
) {
  const normalizedRuntimeId = normalizeRuntimeId(runtimeId);
  if (!normalizedRuntimeId) {
    return null;
  }

  return `managed-${normalizedRuntimeId}-primary`;
}

export const STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID =
  buildBuiltInKernelPrimaryInstanceId('openclaw') ?? 'managed-openclaw-primary';

export function isBuiltInOpenClawInstanceId(
  value: string | null | undefined,
) {
  const normalized = normalizeRequiredString(value);
  return normalized === STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
}

export function canonicalizeBuiltInOpenClawInstanceId(
  value: string | null | undefined,
) {
  const normalized = normalizeRequiredString(value);
  if (!normalized) {
    return null;
  }

  return normalized === STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID
    ? STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID
    : normalized;
}

export function matchesBuiltInOpenClawInstanceId(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = canonicalizeBuiltInOpenClawInstanceId(left);
  const normalizedRight = canonicalizeBuiltInOpenClawInstanceId(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      normalizedLeft === normalizedRight &&
      normalizedLeft === STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  );
}
