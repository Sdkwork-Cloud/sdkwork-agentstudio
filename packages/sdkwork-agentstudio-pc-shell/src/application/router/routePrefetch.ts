const sidebarRoutePrefetchers = [
  ['/chat', () => import('@sdkwork/agentstudio-pc-chat')],
  ['/dashboard', () => import('@sdkwork/agentstudio-pc-dashboard')],
  ['/usage', () => import('@sdkwork/agentstudio-pc-dashboard')],
  ['/claw-center', () => import('@sdkwork/agentstudio-pc-center')],
  ['/community', () => import('@sdkwork/agentstudio-pc-community')],
  ['/instances', () => import('@sdkwork/agentstudio-pc-instances')],
  ['/kernel', () => import('@sdkwork/agentstudio-pc-settings')],
  ['/nodes', () => import('@sdkwork/agentstudio-pc-instances')],
  ['/extensions', () => import('@sdkwork/agentstudio-pc-extensions')],
  ['/channels', () => import('@sdkwork/agentstudio-pc-channels')],
  ['/tasks', () => import('@sdkwork/agentstudio-pc-tasks')],
  ['/settings', () => import('@sdkwork/agentstudio-pc-settings')],
  ['/docs', () => import('@sdkwork/agentstudio-pc-docs')],
] as const;
const sidebarRoutePrefetchPaths = sidebarRoutePrefetchers.map(([prefix]) => prefix);

type SidebarRoutePrefetcher = readonly [string, () => Promise<unknown>];
type ScheduledPrefetchHandle = unknown;

function normalizeRoutePath(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || pathname;
}

export function resolveSidebarStartupRoute(pathname: string) {
  const normalizedPath = normalizeRoutePath(pathname);
  return normalizedPath === '/' || !normalizedPath ? '/chat' : normalizedPath;
}

function resolveSidebarRoutePrefetcher(
  routePrefetchers: readonly SidebarRoutePrefetcher[],
  pathname: string,
) {
  const normalizedPath = normalizeRoutePath(pathname);
  return routePrefetchers.find(([prefix]) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

export function createSidebarRoutePrefetchController(input: {
  routePrefetchers: readonly SidebarRoutePrefetcher[];
  scheduleDelayMs?: number;
  schedule?: (callback: () => void, delayMs: number) => ScheduledPrefetchHandle;
  clearScheduled?: (handle: ScheduledPrefetchHandle) => void;
}) {
  const {
    routePrefetchers,
    scheduleDelayMs = 120,
    schedule = (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearScheduled = (handle) => window.clearTimeout(handle as number),
  } = input;

  const prefetchedSidebarRoutes = new Map<string, Promise<unknown>>();
  const scheduledSidebarRoutes = new Map<string, ScheduledPrefetchHandle>();

  const prefetch = (pathname: string) => {
    const match = resolveSidebarRoutePrefetcher(routePrefetchers, pathname);
    if (!match) {
      return;
    }

    const [routePrefix, loadRoute] = match;
    if (prefetchedSidebarRoutes.has(routePrefix)) {
      return;
    }

    const pending = loadRoute().catch((error) => {
      prefetchedSidebarRoutes.delete(routePrefix);
      throw error;
    });

    prefetchedSidebarRoutes.set(routePrefix, pending);
  };

  const cancel = (pathname: string) => {
    const match = resolveSidebarRoutePrefetcher(routePrefetchers, pathname);
    if (!match) {
      return;
    }

    const [routePrefix] = match;
    const scheduled = scheduledSidebarRoutes.get(routePrefix);
    if (!scheduled) {
      return;
    }

    clearScheduled(scheduled);
    scheduledSidebarRoutes.delete(routePrefix);
  };

  const queue = (pathname: string) => {
    const match = resolveSidebarRoutePrefetcher(routePrefetchers, pathname);
    if (!match) {
      return;
    }

    const [routePrefix] = match;
    if (prefetchedSidebarRoutes.has(routePrefix) || scheduledSidebarRoutes.has(routePrefix)) {
      return;
    }

    const handle = schedule(() => {
      scheduledSidebarRoutes.delete(routePrefix);
      prefetch(pathname);
    }, scheduleDelayMs);

    scheduledSidebarRoutes.set(routePrefix, handle);
  };

  return {
    prefetch,
    schedule: queue,
    cancel,
  };
}

const sidebarRoutePrefetchController = createSidebarRoutePrefetchController({
  routePrefetchers: sidebarRoutePrefetchers,
});

export function listSidebarRoutePrefetchPaths() {
  return [...sidebarRoutePrefetchPaths];
}

export function prefetchSidebarRoute(pathname: string) {
  sidebarRoutePrefetchController.prefetch(pathname);
}

export function prefetchSidebarRoutes(
  pathnames: readonly string[],
  prefetch = prefetchSidebarRoute,
) {
  const queuedPaths = new Set<string>();

  for (const pathname of pathnames) {
    const normalizedPath = resolveSidebarStartupRoute(pathname);
    if (queuedPaths.has(normalizedPath)) {
      continue;
    }

    queuedPaths.add(normalizedPath);
    prefetch(normalizedPath);
  }
}

export function scheduleSidebarRoutePrefetch(pathname: string) {
  sidebarRoutePrefetchController.schedule(pathname);
}

export function cancelSidebarRoutePrefetch(pathname: string) {
  sidebarRoutePrefetchController.cancel(pathname);
}
