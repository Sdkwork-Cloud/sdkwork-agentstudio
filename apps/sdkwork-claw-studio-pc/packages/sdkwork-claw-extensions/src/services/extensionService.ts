import {
  kernelPlatformService,
  platform,
  type PlatformAPI,
} from '@sdkwork/claw-core';
import type { ListParams, PaginatedResult } from './serviceTypes.ts';

export type ExtensionSource = 'bundled' | 'local';
export type ExtensionCategory = 'provider' | 'channel' | 'plugin';

export interface Extension {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  installed: boolean;
  source: ExtensionSource;
  category: ExtensionCategory;
}

export interface ExtensionService {
  getExtensions(params?: ListParams): Promise<PaginatedResult<Extension>>;
  installExtension(id: string): Promise<void>;
  uninstallExtension(id: string): Promise<void>;
}

interface ExtensionManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name?: string };
  openclaw?: {
    channel?: {
      id?: string;
      label?: string;
    };
  };
}

interface ExtensionDescriptor {
  id: string;
  directoryPath: string;
  manifest: ExtensionManifest;
}

interface ExtensionRuntimePaths {
  bundledExtensionsDir: string;
  pluginsDir: string;
}

type ExtensionPlatform = Pick<
  PlatformAPI,
  'listDirectory' | 'readFile' | 'pathExists' | 'createDirectory' | 'copyPath' | 'removePath'
>;

interface KernelPlatformInfoLike {
  directories?: {
    pluginsDir?: string | null;
  };
}

interface KernelPlatformStatusLike {
  raw?: {
    provenance?: {
      runtimeInstallDir?: string | null;
    };
  };
  provenance?: {
    runtimeInstallDir?: string | null;
  };
}

interface KernelPlatformServiceLike {
  getInfo(): Promise<KernelPlatformInfoLike | null>;
  getStatus(): Promise<KernelPlatformStatusLike | null>;
}

export interface CreateExtensionServiceOptions {
  getKernelPlatformService?: () => KernelPlatformServiceLike;
  getPlatform?: () => ExtensionPlatform;
}

const SOURCE_SORT_ORDER: Record<ExtensionSource, number> = {
  bundled: 0,
  local: 1,
};

const TITLE_CASE_OVERRIDES: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  github: 'GitHub',
  llm: 'LLM',
  line: 'LINE',
  mcp: 'MCP',
  openai: 'OpenAI',
  sdk: 'SDK',
  sql: 'SQL',
  ui: 'UI',
  ux: 'UX',
};

function joinPath(basePath: string, ...segments: string[]) {
  const separator = basePath.includes('\\') ? '\\' : '/';
  const normalizedBase = basePath.replace(/[\\/]+$/, '');
  const normalizedSegments = segments
    .map((segment) => segment.replace(/^[\\/]+/, '').replace(/[\\/]+$/, ''))
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    return normalizedBase;
  }

  return [normalizedBase, ...normalizedSegments].join(separator);
}

function resolveRuntimeInstallDir(status: KernelPlatformStatusLike | null) {
  return status?.raw?.provenance?.runtimeInstallDir ?? status?.provenance?.runtimeInstallDir ?? null;
}

function normalizeDisplaySegment(segment: string) {
  const override = TITLE_CASE_OVERRIDES[segment.toLowerCase()];
  if (override) {
    return override;
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function toDisplayName(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(normalizeDisplaySegment)
    .join(' ');
}

function deriveExtensionName(id: string, manifest: ExtensionManifest) {
  const channelLabel = manifest.openclaw?.channel?.label?.trim();
  if (channelLabel) {
    return channelLabel;
  }

  const packageLabel = manifest.name?.split('/').pop()?.trim();
  if (packageLabel) {
    return toDisplayName(packageLabel);
  }

  return toDisplayName(id);
}

function deriveExtensionAuthor(manifest: ExtensionManifest) {
  if (typeof manifest.author === 'string' && manifest.author.trim()) {
    return manifest.author.trim();
  }

  if (
    typeof manifest.author === 'object' &&
    manifest.author &&
    typeof manifest.author.name === 'string' &&
    manifest.author.name.trim()
  ) {
    return manifest.author.name.trim();
  }

  if (manifest.name?.startsWith('@openclaw/')) {
    return 'OpenClaw';
  }

  return 'Unknown';
}

function deriveExtensionCategory(
  id: string,
  manifest: ExtensionManifest,
): ExtensionCategory {
  if (manifest.openclaw?.channel) {
    return 'channel';
  }

  const packageName = manifest.name?.toLowerCase() ?? '';
  if (packageName.includes('provider') || id.toLowerCase().includes('provider')) {
    return 'provider';
  }

  return 'plugin';
}

function materializeExtension(
  descriptor: ExtensionDescriptor,
  installed: boolean,
  source: ExtensionSource,
): Extension {
  return {
    id: descriptor.id,
    name: deriveExtensionName(descriptor.id, descriptor.manifest),
    description: descriptor.manifest.description?.trim() || 'No description available.',
    author: deriveExtensionAuthor(descriptor.manifest),
    version: descriptor.manifest.version?.trim() || 'unknown',
    installed,
    source,
    category: deriveExtensionCategory(descriptor.id, descriptor.manifest),
  };
}

function matchesKeyword(extension: Extension, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();
  return [
    extension.id,
    extension.name,
    extension.description,
    extension.author,
    extension.version,
  ].some((value) => value.toLowerCase().includes(normalizedKeyword));
}

async function readExtensionDescriptor(
  filesystem: ExtensionPlatform,
  directoryPath: string,
  id: string,
): Promise<ExtensionDescriptor | null> {
  const manifestPath = joinPath(directoryPath, 'package.json');
  if (!(await filesystem.pathExists(manifestPath))) {
    return null;
  }

  const manifest = JSON.parse(await filesystem.readFile(manifestPath)) as ExtensionManifest;
  return {
    id,
    directoryPath,
    manifest,
  };
}

async function listExtensionDescriptors(
  filesystem: ExtensionPlatform,
  rootPath: string,
): Promise<ExtensionDescriptor[]> {
  if (!(await filesystem.pathExists(rootPath))) {
    return [];
  }

  const entries = await filesystem.listDirectory(rootPath);
  const directories = entries
    .filter((entry) => entry.kind === 'directory')
    .sort((left, right) => left.name.localeCompare(right.name));

  const descriptors = await Promise.all(
    directories.map((entry) => readExtensionDescriptor(filesystem, entry.path, entry.name)),
  );

  return descriptors.filter((descriptor): descriptor is ExtensionDescriptor => descriptor !== null);
}

async function resolveRuntimePaths(
  kernelService: KernelPlatformServiceLike,
): Promise<ExtensionRuntimePaths> {
  const [info, status] = await Promise.all([
    kernelService.getInfo(),
    kernelService.getStatus(),
  ]);

  const pluginsDir = info?.directories?.pluginsDir?.trim();
  const runtimeInstallDir = resolveRuntimeInstallDir(status)?.trim();
  if (!pluginsDir || !runtimeInstallDir) {
    throw new Error('OpenClaw runtime directories unavailable');
  }

  return {
    bundledExtensionsDir: joinPath(runtimeInstallDir, 'dist', 'extensions'),
    pluginsDir,
  };
}

function paginateExtensions(
  items: Extension[],
  params: ListParams = {},
): PaginatedResult<Extension> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    total: items.length,
    page,
    pageSize,
    hasMore: startIndex + pageSize < items.length,
  };
}

export function createExtensionService(
  options: CreateExtensionServiceOptions = {},
): ExtensionService {
  const getKernelService = options.getKernelPlatformService ?? (() => kernelPlatformService);
  const getFilesystem = options.getPlatform ?? (() => platform);

  return {
    async getExtensions(params = {}) {
      const kernelService = getKernelService();
      const filesystem = getFilesystem();
      const runtimePaths = await resolveRuntimePaths(kernelService);
      const [bundledDescriptors, localDescriptors] = await Promise.all([
        listExtensionDescriptors(filesystem, runtimePaths.bundledExtensionsDir),
        listExtensionDescriptors(filesystem, runtimePaths.pluginsDir),
      ]);

      const localDescriptorsById = new Map(
        localDescriptors.map((descriptor) => [descriptor.id, descriptor]),
      );
      const merged = new Map<string, Extension>();

      for (const descriptor of bundledDescriptors) {
        merged.set(
          descriptor.id,
          materializeExtension(
            descriptor,
            localDescriptorsById.has(descriptor.id),
            'bundled',
          ),
        );
      }

      for (const descriptor of localDescriptors) {
        if (merged.has(descriptor.id)) {
          continue;
        }

        merged.set(descriptor.id, materializeExtension(descriptor, true, 'local'));
      }

      let items = [...merged.values()].sort((left, right) => {
        const sourceOrderDifference =
          SOURCE_SORT_ORDER[left.source] - SOURCE_SORT_ORDER[right.source];
        if (sourceOrderDifference !== 0) {
          return sourceOrderDifference;
        }

        return left.id.localeCompare(right.id);
      });

      if (params.keyword?.trim()) {
        items = items.filter((extension) => matchesKeyword(extension, params.keyword!.trim()));
      }

      return paginateExtensions(items, params);
    },

    async installExtension(id) {
      const kernelService = getKernelService();
      const filesystem = getFilesystem();
      const runtimePaths = await resolveRuntimePaths(kernelService);
      const sourcePath = joinPath(runtimePaths.bundledExtensionsDir, id);
      const destinationPath = joinPath(runtimePaths.pluginsDir, id);

      if (!(await filesystem.pathExists(sourcePath))) {
        throw new Error('Extension not found');
      }

      if (!(await filesystem.pathExists(runtimePaths.pluginsDir))) {
        await filesystem.createDirectory(runtimePaths.pluginsDir);
      }

      if (await filesystem.pathExists(destinationPath)) {
        await filesystem.removePath(destinationPath);
      }

      await filesystem.copyPath(sourcePath, destinationPath);
    },

    async uninstallExtension(id) {
      const kernelService = getKernelService();
      const filesystem = getFilesystem();
      const runtimePaths = await resolveRuntimePaths(kernelService);
      const destinationPath = joinPath(runtimePaths.pluginsDir, id);

      if (!(await filesystem.pathExists(destinationPath))) {
        throw new Error('Extension not found');
      }

      await filesystem.removePath(destinationPath);
    },
  };
}

export const extensionService = createExtensionService();
