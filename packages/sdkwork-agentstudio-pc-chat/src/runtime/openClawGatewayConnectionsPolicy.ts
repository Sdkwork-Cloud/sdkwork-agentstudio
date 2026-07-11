function normalizePathname(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || pathname;
}

function isColdRoute(pathname: string) {
  return (
    pathname === '/auth' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/login/oauth/callback')
  );
}

function normalizeInstanceIds(instanceIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      instanceIds
        .map((instanceId) => instanceId?.trim() || '')
        .filter(Boolean),
    ),
  ).sort();
}

function normalizeDirectoryInstanceStatuses(
  instances: Array<{ id: string | null | undefined; status?: string | null | undefined }>,
) {
  const statusByInstanceId = new Map<string, string>();

  for (const instance of instances) {
    const normalizedId = instance.id?.trim() || '';
    if (!normalizedId || statusByInstanceId.has(normalizedId)) {
      continue;
    }

    statusByInstanceId.set(normalizedId, instance.status?.trim() || 'unknown');
  }

  return statusByInstanceId;
}

export interface OpenClawGatewayWarmPlan {
  shouldQueryDirectory: boolean;
  instanceIds: string[];
}

export function resolveOpenClawGatewayWarmPlan(params: {
  pathname: string;
  activeInstanceId?: string | null;
  directoryInstanceIds?: string[];
}): OpenClawGatewayWarmPlan {
  const normalizedPathname = normalizePathname(params.pathname);
  if (isColdRoute(normalizedPathname)) {
    return {
      shouldQueryDirectory: false,
      instanceIds: [],
    };
  }

  if (normalizedPathname === '/chat') {
    return {
      shouldQueryDirectory: true,
      instanceIds: normalizeInstanceIds([
        ...(params.directoryInstanceIds ?? []),
        params.activeInstanceId,
      ]),
    };
  }

  return {
    shouldQueryDirectory: false,
    instanceIds: normalizeInstanceIds([params.activeInstanceId]),
  };
}

export function shouldWarmOpenClawGatewayConnections(pathname: string) {
  return !isColdRoute(normalizePathname(pathname));
}

export function shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange(params: {
  pathname: string;
  warmedInstanceIds?: Array<string | null | undefined>;
  eventInstanceId?: string | null;
}) {
  if (!shouldWarmOpenClawGatewayConnections(params.pathname)) {
    return false;
  }

  const eventInstanceId = params.eventInstanceId?.trim() || '';
  if (!eventInstanceId) {
    return false;
  }

  return normalizeInstanceIds(params.warmedInstanceIds ?? []).includes(eventInstanceId);
}

export function resolveOpenClawGatewayWarmRefreshKey(params: {
  pathname: string;
  activeInstanceId?: string | null;
  directoryInstances?: Array<{
    id: string | null | undefined;
    status?: string | null | undefined;
  }>;
}) {
  const plan = resolveOpenClawGatewayWarmPlan({
    pathname: params.pathname,
    activeInstanceId: params.activeInstanceId,
    directoryInstanceIds: params.directoryInstances?.map((instance) => instance.id || ''),
  });

  if (plan.instanceIds.length === 0) {
    return '';
  }

  const statusByInstanceId = normalizeDirectoryInstanceStatuses(params.directoryInstances ?? []);
  return plan.instanceIds
    .map((instanceId) => `${instanceId}:${statusByInstanceId.get(instanceId) ?? 'unknown'}`)
    .join('|');
}
