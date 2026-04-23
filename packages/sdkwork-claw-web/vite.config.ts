import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  isSharedSdkSourceMode,
  resolvePnpmPackageDistEntry,
} from '../../scripts/shared-sdk-mode.mjs';
import { resolveCanonicalWorkspaceRootDir } from '../../scripts/workspace-root.mjs';
import {
  CLAW_VITE_DEDUPE_PACKAGES,
  createClawManualChunks,
  resolveClawModulePreloadDependencies,
} from '../../scripts/viteBuildOptimization.ts';
import {
  remapWorktreeWorkspaceImport,
  resolveWorkspacePackageAliases,
  shouldEnableWorktreeWorkspaceResolver,
  shouldAttemptWorkspaceResolverRemap,
} from '../../scripts/viteWorkspaceResolver.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function workspacePackageResolver(packagesRootDir: string) {
  const resolutionCache = new Map<string, string | null>();

  return {
    name: 'workspace-package-resolver',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (!shouldAttemptWorkspaceResolverRemap(source, importer, packagesRootDir)) {
        return null;
      }

      const cacheKey = `${source}\u0000${importer ?? ''}`;
      if (resolutionCache.has(cacheKey)) {
        return resolutionCache.get(cacheKey);
      }

      const resolved = remapWorktreeWorkspaceImport(source, importer, packagesRootDir);

      resolutionCache.set(cacheKey, resolved);
      return resolved;
    },
  };
}

export default defineConfig(({ mode }) => {
  const useSharedSdkSourceMode = isSharedSdkSourceMode(process.env);
  // Allow pnpm workspace-linked SDK packages that live above apps/claw-studio.
  const workspaceRootDir = path.resolve(__dirname, '../..');
  const canonicalWorkspaceRootDir = resolveCanonicalWorkspaceRootDir(workspaceRootDir);
  const env = loadEnv(mode, workspaceRootDir, '');
  const monorepoRoot = path.resolve(canonicalWorkspaceRootDir, '../..');
  const packagesRootDir = path.resolve(__dirname, '../../packages');
  const workspacePackageAliases = resolveWorkspacePackageAliases(packagesRootDir);
  const enableWorktreeWorkspaceResolver = shouldEnableWorktreeWorkspaceResolver(
    workspaceRootDir,
    process.env,
  );
  const sharedAppSdkSourceEntry = path.resolve(
    canonicalWorkspaceRootDir,
    '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/src/index.ts',
  );
  const sharedSdkCommonSourceEntry = path.resolve(
    canonicalWorkspaceRootDir,
    '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/src/index.ts',
  );
  const sharedAppSdkDistEntry = resolvePnpmPackageDistEntry('@sdkwork/app-sdk', workspaceRootDir) ?? path.resolve(
    canonicalWorkspaceRootDir,
    '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript/dist/index.js',
  );
  const sharedSdkCommonDistEntry = resolvePnpmPackageDistEntry('@sdkwork/sdk-common', workspaceRootDir) ?? path.resolve(
    canonicalWorkspaceRootDir,
    '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript/dist/index.js',
  );
  const sdkworkAuthPcReactShimEntry = path.resolve(
    __dirname,
    './shims/sdkworkAuthPcReact.ts',
  );
  const sdkworkUserPcReactShimEntry = path.resolve(
    __dirname,
    './shims/sdkworkUserPcReact.ts',
  );
  const sharedAppSdkChunkEntry = useSharedSdkSourceMode
    ? sharedAppSdkSourceEntry
    : sharedAppSdkDistEntry;

  return {
    envDir: workspaceRootDir,
    plugins: [
      ...(enableWorktreeWorkspaceResolver
        ? [workspacePackageResolver(packagesRootDir)]
        : []),
      react(),
      tailwindcss(),
    ],
    resolve: {
      dedupe: [...CLAW_VITE_DEDUPE_PACKAGES],
      alias: [
        { find: '@sdkwork/auth-pc-react', replacement: sdkworkAuthPcReactShimEntry },
        { find: '@sdkwork/user-pc-react', replacement: sdkworkUserPcReactShimEntry },
        { find: '@', replacement: path.resolve(__dirname, '.') },
        ...workspacePackageAliases,
        ...(useSharedSdkSourceMode
          ? [
              { find: '@sdkwork/app-sdk', replacement: sharedAppSdkSourceEntry },
              { find: '@sdkwork/sdk-common', replacement: sharedSdkCommonSourceEntry },
            ]
          : [
              { find: '@sdkwork/app-sdk', replacement: sharedAppSdkDistEntry },
              { find: '@sdkwork/sdk-common', replacement: sharedSdkCommonDistEntry },
            ]),
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      fs: {
        allow: [monorepoRoot],
      },
    },
    build: {
      modulePreload: {
        resolveDependencies: (_filename, deps, context) =>
          resolveClawModulePreloadDependencies(deps, context),
      },
      rollupOptions: {
        output: {
          manualChunks: createClawManualChunks(sharedAppSdkChunkEntry),
        },
      },
    },
  };
});
