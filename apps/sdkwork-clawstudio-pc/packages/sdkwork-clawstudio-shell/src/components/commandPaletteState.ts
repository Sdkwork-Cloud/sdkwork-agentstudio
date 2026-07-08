interface CommandPaletteInstanceLoaderOptions<T> {
  loadInstances: () => Promise<T[]>;
  now?: () => number;
  cacheTtlMs?: number;
}

interface CommandPaletteSearchIndex<T> {
  search: (query: string) => T[];
}

interface FilterCommandPaletteCommandsOptions<T> {
  search: string;
  commands: T[];
  createSearch: (commands: T[]) => CommandPaletteSearchIndex<T>;
}

interface CommandPaletteInstanceCacheEntry<T> {
  expiresAt: number;
  value: T[];
}

export function filterCommandPaletteCommands<T>({
  search,
  commands,
  createSearch,
}: FilterCommandPaletteCommandsOptions<T>) {
  const normalizedQuery = search.trim();
  if (!normalizedQuery) {
    return commands;
  }

  return createSearch(commands).search(normalizedQuery);
}

export function createCommandPaletteInstanceLoader<T>({
  loadInstances,
  now = () => Date.now(),
  cacheTtlMs = 15_000,
}: CommandPaletteInstanceLoaderOptions<T>) {
  let cache: CommandPaletteInstanceCacheEntry<T> | null = null;
  let pending: Promise<T[]> | null = null;

  return {
    load() {
      const currentTime = now();
      if (cache && cache.expiresAt > currentTime) {
        return Promise.resolve(cache.value);
      }

      if (pending) {
        return pending;
      }

      pending = loadInstances()
        .then((instances) => {
          cache = {
            expiresAt: now() + cacheTtlMs,
            value: instances,
          };
          return instances;
        })
        .finally(() => {
          pending = null;
        });

      return pending;
    },
    invalidate() {
      cache = null;
    },
  };
}
