import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function collectTextFiles(directory: string, results: string[] = []) {
  if (!fs.existsSync(directory)) {
    return results;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const nextPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'target') {
        continue;
      }

      collectTextFiles(nextPath, results);
      continue;
    }

    if (TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(nextPath);
    }
  }

  return results;
}

function findFilesContaining(
  searchRoot: string,
  pattern: RegExp,
  options?: {
    excludeTestFiles?: boolean;
  },
) {
  return collectTextFiles(path.join(root, searchRoot))
    .filter((filePath) => !(options?.excludeTestFiles && /\.test\./.test(filePath)))
    .filter((filePath) => pattern.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(root, filePath).replace(/\\/g, '/'))
    .sort();
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-i18n is implemented locally instead of re-exporting claw-studio infrastructure', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-i18n/package.json');
  const source = read('packages/sdkwork-claw-i18n/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/en.json'));
  assert.ok(exists('packages/sdkwork-claw-i18n/src/locales/zh.json'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-infrastructure']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(source, /ensureI18n/);
});

runTest('sdkwork-claw-types is implemented locally instead of re-exporting claw-studio domain', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-types/package.json');
  const source = read('packages/sdkwork-claw-types/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-types/src/service.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-domain']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-domain/);
  assert.match(source, /export \* from '.\/service(?:\.ts)?'/);
});

runTest('sdkwork-claw-distribution is implemented locally instead of re-exporting claw-studio distribution', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-distribution/package.json');
  const source = read('packages/sdkwork-claw-distribution/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/cn/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-distribution/src/manifests/global/index.ts'));
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-distribution']);
  assert.doesNotMatch(source, /@sdkwork\/claw-studio-distribution/);
  assert.match(source, /getDistributionManifest/);
});

runTest('sdkwork-claw-web pins stable build chunks for infrastructure without shipping mock-only chunks', () => {
  const viteConfigSource = read('packages/sdkwork-claw-web/vite.config.ts');
  const buildHelperSource = read('scripts/viteBuildOptimization.ts');
  const registrySource = read('packages/sdkwork-claw-infrastructure/src/platform/registry.ts');

  assert.match(viteConfigSource, /createClawManualChunks/);
  assert.match(viteConfigSource, /resolveClawModulePreloadDependencies/);
  assert.match(viteConfigSource, /CLAW_VITE_DEDUPE_PACKAGES/);
  assert.match(buildHelperSource, /react-vendor/);
  assert.match(buildHelperSource, /app-router/);
  assert.match(buildHelperSource, /app-state/);
  assert.match(buildHelperSource, /app-ui/);
  assert.doesNotMatch(buildHelperSource, /markdown-highlight/);
  assert.match(buildHelperSource, /sdkwork-app-sdk/);
  assert.match(buildHelperSource, /sdkwork-claw-infrastructure/);
  assert.match(buildHelperSource, /claw-platform-web-studio/);
  assert.match(registrySource, /LazyWebStudioPlatform/);
  assert.doesNotMatch(registrySource, /import \{ WebStudioPlatform \} from '\.\/webStudio\.ts';/);
  assert.doesNotMatch(registrySource, /studio:\s*new WebStudioPlatform\(\)/);
  assert.doesNotMatch(viteConfigSource, /studioMockService/);
  assert.doesNotMatch(viteConfigSource, /claw-studio-mock/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/pages\/community\/NewPost\.tsx/);
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-community\/src\/CommunityPostDetail\.tsx/);
  assert.doesNotMatch(
    viteConfigSource,
    /sdkwork-claw-community\/src\/pages\/community\/CommunityPostDetail\.tsx/,
  );
  assert.doesNotMatch(viteConfigSource, /sdkwork-claw-chat\/src\/components\/ChatMessage\.tsx/);
  assert.doesNotMatch(viteConfigSource, /@sdkwork\/claw-studio-infrastructure/);
  assert.match(viteConfigSource, /dedupe:\s*\[\.\.\.CLAW_VITE_DEDUPE_PACKAGES\]/);
});

runTest('web studio no longer references mock task services in the platform runtime path', () => {
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');

  assert.doesNotMatch(
    webStudioSource,
    /import\s+\{\s*studioMockService\s*\}\s+from\s+'..\/services\/index\.ts'/,
  );
  assert.doesNotMatch(
    webStudioSource,
    /import\s+\{\s*studioMockService\s*\}\s+from\s+'..\/services\/studioMockService\.ts'/,
  );
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/studioMockService\.ts'\)/);
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/studioMockServiceProxy\.ts'\)/);
  assert.doesNotMatch(webStudioSource, /import\('..\/services\/index\.ts'\)/);
});

runTest('infrastructure root keeps mock-service helpers private instead of exporting them to runtime consumers', () => {
  const infrastructureIndexSource = read('packages/sdkwork-claw-infrastructure/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-infrastructure/src/services/index.ts');
  const platformIndexSource = read('packages/sdkwork-claw-infrastructure/src/platform/index.ts');

  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/studioMockService\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/studioMockService\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/studioMockServiceProxy\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/studioMockServiceProxy\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \{ WebStudioPlatform \} from '\.\/platform\/webStudio\.ts';/);
  assert.doesNotMatch(platformIndexSource, /export \{ WebStudioPlatform \} from '\.\/webStudio\.ts';/);
});

runTest('infrastructure root keeps legacy raw-http auth helpers private instead of exporting bypass clients', () => {
  const infrastructureIndexSource = read('packages/sdkwork-claw-infrastructure/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-infrastructure/src/services/index.ts');

  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/http\/httpClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/http\/apiClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/authClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/userClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/accountClient\.ts'/);
  assert.doesNotMatch(infrastructureIndexSource, /export \* from '.\/services\/notificationClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/authClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/userClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/accountClient\.ts'/);
  assert.doesNotMatch(servicesIndexSource, /export \* from '.\/notificationClient\.ts'/);
});

runTest('desktop update client uses generated app-sdk instead of handwritten raw HTTP', () => {
  const updateClientSource = read('packages/sdkwork-claw-infrastructure/src/updates/updateClient.ts');

  assert.match(updateClientSource, /@sdkwork\/app-sdk/);
  assert.doesNotMatch(updateClientSource, /postJson/);
  assert.doesNotMatch(updateClientSource, /getApiUrl/);
  assert.doesNotMatch(updateClientSource, /httpClient/);
});

runTest('mock studio helpers are removed from the production source tree', () => {
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockService.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockServiceProxy.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/studioMockService.test.ts'));
});

runTest('dead raw-http business helper files are removed after app-sdk migration', () => {
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/http/apiClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/authClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/authClient.test.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/userClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/accountClient.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/services/notificationClient.ts'));
});

runTest('foundation removes legacy api-router runtime bridge files and dead locale blocks after extraction', () => {
  const enLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const envExampleSource = read('.env.example');
  const envDevelopmentSource = read('.env.development');
  const envTestSource = read('.env.test');
  const envProductionSource = read('.env.production');
  const pnpmLockSource = read('pnpm-lock.yaml');
  const upstreamReferenceSource = read('docs/reference/upstream-integration.md');
  const upstreamReferenceZhSource = read('docs/zh-CN/reference/upstream-integration.md');

  assert.doesNotThrow(() => JSON.parse(enLocaleSource));
  assert.doesNotThrow(() => JSON.parse(zhLocaleSource));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/webApiRouter.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/webApiRouter.test.ts'));
  assert.ok(!exists('packages/sdkwork-claw-infrastructure/src/platform/contracts/apiRouter.ts'));
  assert.doesNotMatch(enLocaleSource, /"apiRouterComingSoon"/);
  assert.doesNotMatch(enLocaleSource, /"apiRouterPage"/);
  assert.doesNotMatch(enLocaleSource, /"apiRouterWorkspace"/);
  assert.doesNotMatch(enLocaleSource, /VITE_API_ROUTER_ADMIN_TOKEN/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterComingSoon"/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterPage"/);
  assert.doesNotMatch(zhLocaleSource, /"apiRouterWorkspace"/);
  assert.doesNotMatch(zhLocaleSource, /VITE_API_ROUTER_ADMIN_TOKEN/);
  assert.doesNotMatch(envExampleSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envDevelopmentSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envTestSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(envProductionSource, /VITE_API_ROUTER_/);
  assert.doesNotMatch(pnpmLockSource, /packages\/sdkwork-claw-apirouter:/);
  assert.doesNotMatch(pnpmLockSource, /@sdkwork\/claw-apirouter/);
  assert.match(upstreamReferenceSource, /OpenClaw/);
  assert.match(upstreamReferenceZhSource, /OpenClaw/);
});

runTest('foundation removes local legacy api-router provider-id helpers after extracting them into shared local-api-proxy', () => {
  const matches = findFilesContaining('packages', /api-router-/, {
    excludeTestFiles: true,
  });

  assert.deepEqual(matches, []);
});

runTest('foundation composes local api proxy from shared sdkwork-local-api-proxy packages instead of reviving local compat helpers', () => {
  const corePackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-core/package.json',
  );
  const settingsPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-settings/package.json',
  );
  const desktopCargoSource = read('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml');
  const openClawConfigServiceSource = read(
    'packages/sdkwork-claw-core/src/services/openClawConfigService.ts',
  );
  const providerConfigImportServiceSource = read(
    'packages/sdkwork-claw-settings/src/services/providerConfigImportService.ts',
  );
  const providerConfigEditorPolicySource = read(
    'packages/sdkwork-claw-settings/src/services/providerConfigEditorPolicy.ts',
  );
  const localAiProxyLogsServiceSource = read(
    'packages/sdkwork-claw-settings/src/services/localAiProxyLogsService.ts',
  );
  const localAiProxyConfigSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/config.rs',
  );
  const localAiProxySnapshotSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy_snapshot.rs',
  );
  const localAiProxyObservabilitySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy_observability.rs',
  );

  assert.equal(
    corePackage.dependencies?.['@sdkwork/local-api-proxy'],
    'link:../../../sdkwork-appbase/packages/pc-react/intelligence/sdkwork-local-api-proxy',
  );
  assert.equal(
    settingsPackage.dependencies?.['@sdkwork/local-api-proxy'],
    'link:../../../sdkwork-appbase/packages/pc-react/intelligence/sdkwork-local-api-proxy',
  );
  assert.match(
    desktopCargoSource,
    /sdkwork-local-api-proxy-native = \{ path = "\.\.\/\.\.\/\.\.\/\.\.\/sdkwork-appbase\/packages\/pc-react\/intelligence\/sdkwork-local-api-proxy\/native\/tauri-rust" \}/,
  );

  assert.match(openClawConfigServiceSource, /from '@sdkwork\/local-api-proxy'/);
  assert.match(providerConfigImportServiceSource, /createLocalApiProxyProviderImportService/);
  assert.match(providerConfigImportServiceSource, /from "@sdkwork\/local-api-proxy"/);
  assert.match(providerConfigEditorPolicySource, /from "@sdkwork\/local-api-proxy"/);
  assert.match(localAiProxyLogsServiceSource, /createLocalApiProxyLogsService/);
  assert.match(localAiProxyLogsServiceSource, /from "@sdkwork\/local-api-proxy"/);

  assert.match(localAiProxyConfigSource, /use sdkwork_local_api_proxy_native::config::\{/);
  assert.match(localAiProxySnapshotSource, /pub use sdkwork_local_api_proxy_native::snapshot::\{/);
  assert.match(localAiProxyObservabilitySource, /pub use sdkwork_local_api_proxy_native::observability::\*/);

  assert.equal(exists('packages/sdkwork-claw-core/src/services/json5Compat.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/legacyProviderCompat.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/localAiProxyRouteService.ts'), false);
});

runTest('foundation sources Hermes kernel-config path semantics from the shared local-api-proxy package boundary', () => {
  const hermesKernelConfigPathServiceSource = read(
    'packages/sdkwork-claw-core/src/services/hermesKernelConfigPathService.ts',
  );
  const hermesPathResolutionServiceSource = read(
    'packages/sdkwork-claw-core/src/services/hermesPathResolutionService.ts',
  );
  const sharedHermesKernelConfigSource = read(
    '../sdkwork-appbase/packages/pc-react/intelligence/sdkwork-local-api-proxy/src/kernel/hermesKernelConfig.ts',
  );

  assert.match(hermesKernelConfigPathServiceSource, /from '@sdkwork\/local-api-proxy'/);
  assert.match(hermesKernelConfigPathServiceSource, /buildStandardHermesConfigFilePath/);
  assert.match(hermesKernelConfigPathServiceSource, /resolveHermesStateDatabasePathFromConfigFile/);
  assert.doesNotMatch(hermesKernelConfigPathServiceSource, /createUserRootKernelConfigDefinition\(/);
  assert.doesNotMatch(hermesKernelConfigPathServiceSource, /const hermesKernelConfigDefinition =/);

  assert.match(hermesPathResolutionServiceSource, /from '@sdkwork\/local-api-proxy'/);
  assert.match(hermesPathResolutionServiceSource, /resolveHermesLogsRootFromConfigFile/);
  assert.doesNotMatch(hermesPathResolutionServiceSource, /from '\.\/hermesKernelConfigPathService\.ts'/);

  assert.match(sharedHermesKernelConfigSource, /configFileName: "config\.yaml"/);
  assert.match(sharedHermesKernelConfigSource, /format: "yaml"/);
});

runTest('foundation sources local ai proxy runtime status models from the shared native package boundary', () => {
  const localAiProxyTypesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs',
  );

  assert.match(
    localAiProxyTypesSource,
    /pub use sdkwork_local_api_proxy_native::runtime::\{/,
  );
  assert.match(localAiProxyTypesSource, /LocalAiProxyLifecycle/);
  assert.match(localAiProxyTypesSource, /LocalAiProxyServiceStatus/);
  assert.match(localAiProxyTypesSource, /LocalAiProxyServiceHealth/);
  assert.match(localAiProxyTypesSource, /LocalAiProxyRouteRuntimeMetrics/);
  assert.match(localAiProxyTypesSource, /LocalAiProxyRouteTestRecord/);
  assert.doesNotMatch(localAiProxyTypesSource, /pub enum LocalAiProxyLifecycle/);
  assert.doesNotMatch(localAiProxyTypesSource, /pub struct LocalAiProxyServiceStatus/);
  assert.doesNotMatch(localAiProxyTypesSource, /pub struct LocalAiProxyServiceHealth/);
});

runTest('foundation sources local ai proxy observability state and health projection from the shared native package boundary', () => {
  const observabilityStoreSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs',
  );
  const healthSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  );

  assert.match(
    observabilityStoreSource,
    /sdkwork_local_api_proxy_native::runtime::\{/,
  );
  assert.match(observabilityStoreSource, /LocalAiProxyObservabilityStore/);
  assert.match(observabilityStoreSource, /LocalAiProxyRouteMetricsState/);
  assert.match(observabilityStoreSource, /lock_observability/);
  assert.doesNotMatch(
    observabilityStoreSource,
    /struct LocalAiProxyObservabilityStore/,
  );
  assert.doesNotMatch(
    observabilityStoreSource,
    /struct LocalAiProxyRouteMetricsState/,
  );

  assert.match(
    healthSource,
    /sdkwork_local_api_proxy_native::runtime::reconcile_observability_store;/,
  );
  assert.match(healthSource, /build_route_metrics as project_route_metrics/);
  assert.match(healthSource, /collect_route_tests as project_route_tests/);
  assert.match(healthSource, /collect_default_route_health/);
  assert.doesNotMatch(healthSource, /fn derive_route_health\(/);
  assert.doesNotMatch(healthSource, /fn collect_default_route_health\(/);
  assert.doesNotMatch(healthSource, /fn reconcile_observability_store\(/);
});

runTest('foundation sources local ai proxy request-audit projection from the shared native package boundary', () => {
  const observabilitySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  );

  assert.match(
    observabilitySource,
    /sdkwork_local_api_proxy_native::runtime::/,
  );
  assert.match(observabilitySource, /build_request_audit_projection/);
  assert.doesNotMatch(observabilitySource, /fn extract_logged_model_id\(/);
  assert.doesNotMatch(observabilitySource, /fn parse_model_id_from_endpoint\(/);
  assert.doesNotMatch(observabilitySource, /fn extract_logged_messages\(/);
  assert.doesNotMatch(observabilitySource, /fn collect_openai_logged_messages\(/);
  assert.doesNotMatch(observabilitySource, /fn collect_openai_response_logged_messages\(/);
  assert.doesNotMatch(observabilitySource, /fn collect_anthropic_logged_messages\(/);
  assert.doesNotMatch(observabilitySource, /fn collect_gemini_logged_messages\(/);
  assert.doesNotMatch(observabilitySource, /fn push_logged_message\(/);
  assert.doesNotMatch(observabilitySource, /fn extract_text_from_value\(/);
  assert.doesNotMatch(observabilitySource, /fn collect_text_fragments\(/);
  assert.doesNotMatch(observabilitySource, /fn resolve_request_preview\(/);
});

runTest('foundation sources local ai proxy translation semantics from the shared native package boundary', () => {
  const requestTranslationSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs',
  );
  const responseTranslationSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs',
  );
  const openaiCompatibleSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  );

  assert.match(
    requestTranslationSource,
    /sdkwork_local_api_proxy_native::translation::\{/,
  );
  assert.match(requestTranslationSource, /build_shared_anthropic_request_from_openai_chat/);
  assert.match(requestTranslationSource, /build_shared_anthropic_request_from_openai_response/);
  assert.match(requestTranslationSource, /build_shared_gemini_request_from_openai_chat/);
  assert.match(requestTranslationSource, /build_shared_gemini_request_from_openai_embeddings/);
  assert.match(requestTranslationSource, /build_shared_gemini_request_from_openai_response/);
  assert.match(requestTranslationSource, /build_shared_ollama_request_from_openai_chat/);
  assert.match(requestTranslationSource, /build_shared_ollama_request_from_openai_embeddings/);
  assert.match(requestTranslationSource, /build_shared_ollama_request_from_openai_response/);
  assert.match(openaiCompatibleSource, /resolve_request_model_id as resolve_shared_request_model_id/);
  assert.match(
    openaiCompatibleSource,
    /openai_stream_endpoint_for_suffix as resolve_shared_openai_stream_endpoint/,
  );
  assert.doesNotMatch(requestTranslationSource, /parse_openai_chat_conversation/);
  assert.doesNotMatch(requestTranslationSource, /parse_openai_response_conversation/);
  assert.doesNotMatch(requestTranslationSource, /extract_openai_text_content/);
  assert.doesNotMatch(requestTranslationSource, /fn read_request_max_tokens\(/);
  assert.doesNotMatch(openaiCompatibleSource, /payload\s*\.get\("model"\)/);

  assert.match(
    responseTranslationSource,
    /sdkwork_local_api_proxy_native::translation::\{/,
  );
  assert.match(responseTranslationSource, /build_openai_chat_completion_from_anthropic/);
  assert.match(responseTranslationSource, /build_openai_chat_completion_from_gemini/);
  assert.match(responseTranslationSource, /build_openai_chat_completion_from_ollama/);
  assert.match(responseTranslationSource, /build_openai_response_from_anthropic/);
  assert.match(responseTranslationSource, /build_openai_response_from_gemini/);
  assert.match(responseTranslationSource, /build_openai_response_from_ollama/);
  assert.match(responseTranslationSource, /build_openai_embeddings_from_gemini/);
  assert.match(responseTranslationSource, /build_openai_embeddings_from_ollama/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_chat_completion_from_anthropic\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_chat_completion_from_gemini\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_chat_completion_from_ollama\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_response_from_anthropic\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_response_from_gemini\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_response_from_ollama\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_embeddings_from_gemini\(/);
  assert.doesNotMatch(responseTranslationSource, /fn build_openai_embeddings_from_ollama\(/);
});

runTest('foundation sources local ai proxy payload builders from the shared native package boundary', () => {
  const requestTranslationSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs',
  );

  assert.match(requestTranslationSource, /build_shared_anthropic_request_from_openai_chat/);
  assert.match(requestTranslationSource, /build_shared_gemini_request_from_openai_embeddings/);
  assert.match(requestTranslationSource, /build_shared_ollama_request_from_openai_embeddings/);
  assert.doesNotMatch(requestTranslationSource, /build_anthropic_request_payload/);
  assert.doesNotMatch(requestTranslationSource, /build_gemini_generate_content_payload/);
  assert.doesNotMatch(requestTranslationSource, /build_gemini_embeddings_request_payload/);
  assert.doesNotMatch(requestTranslationSource, /build_ollama_chat_request_payload/);
  assert.doesNotMatch(requestTranslationSource, /build_ollama_messages\(/);
  assert.doesNotMatch(requestTranslationSource, /build_ollama_request_options\(/);
  assert.doesNotMatch(requestTranslationSource, /build_ollama_embeddings_request_payload/);
});

runTest('foundation sources local ai proxy response semantics from the shared native package boundary', () => {
  const responseIoSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs',
  );
  const observabilitySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  );
  const openaiCompatibleSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  );
  const localAiProxyTypesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs',
  );
  const streamingSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs',
  );

  assert.match(responseIoSource, /sdkwork_local_api_proxy_native::response::/);
  assert.match(responseIoSource, /format_json_response_body/);
  assert.match(responseIoSource, /normalize_response_text/);
  assert.match(responseIoSource, /resolve_response_preview/);
  assert.match(responseIoSource, /resolve_error_message/);
  assert.doesNotMatch(responseIoSource, /fn resolve_error_message\(/);
  assert.doesNotMatch(responseIoSource, /fn extract_error_message_from_payload\(/);

  assert.match(observabilitySource, /sdkwork_local_api_proxy_native::response::/);
  assert.match(observabilitySource, /format_json_response_body/);
  assert.match(observabilitySource, /normalize_response_text/);
  assert.match(observabilitySource, /resolve_response_preview/);

  assert.match(openaiCompatibleSource, /sdkwork_local_api_proxy_native::response::extract_token_usage/);
  assert.doesNotMatch(openaiCompatibleSource, /fn extract_token_usage\(/);
  assert.doesNotMatch(openaiCompatibleSource, /fn value_u64\(/);

  assert.match(localAiProxyTypesSource, /sdkwork_local_api_proxy_native::response::LocalAiProxyTokenUsage/);
  assert.doesNotMatch(localAiProxyTypesSource, /struct LocalAiProxyTokenUsage/);

  assert.match(streamingSource, /sdkwork_local_api_proxy_native::streaming::/);
  assert.match(streamingSource, /build_openai_chat_stream_chunk/);
  assert.match(streamingSource, /build_openai_response_completed_event/);
  assert.match(streamingSource, /build_openai_response_created_event/);
  assert.match(streamingSource, /build_openai_response_delta_event/);
  assert.match(streamingSource, /drain_json_line_payloads/);
  assert.match(streamingSource, /drain_sse_frames/);
  assert.match(streamingSource, /flush_json_line_payload/);
  assert.match(streamingSource, /flush_sse_frame/);
  assert.match(streamingSource, /merge_stream_usage/);
  assert.match(streamingSource, /is_openai_stream_request/);
  assert.match(streamingSource, /OpenAiStreamEndpoint/);
  assert.match(streamingSource, /ParsedSseEvent/);
  assert.match(streamingSource, /project_anthropic_openai_stream_frame/);
  assert.match(streamingSource, /project_gemini_openai_stream_frame/);
  assert.match(streamingSource, /project_ollama_openai_stream_frame/);
  assert.doesNotMatch(streamingSource, /pub\(super\) enum OpenAiStreamEndpoint/);
  assert.doesNotMatch(streamingSource, /struct ParsedSseEvent/);
  assert.doesNotMatch(streamingSource, /fn build_openai_chat_stream_chunk\(/);
  assert.doesNotMatch(streamingSource, /fn build_openai_response_created_event\(/);
  assert.doesNotMatch(streamingSource, /fn build_openai_response_delta_event\(/);
  assert.doesNotMatch(streamingSource, /fn build_openai_response_usage\(/);
  assert.doesNotMatch(streamingSource, /fn build_openai_response_completed_event\(/);
  assert.doesNotMatch(streamingSource, /fn drain_sse_frames\(/);
  assert.doesNotMatch(streamingSource, /fn flush_sse_frame\(/);
  assert.doesNotMatch(streamingSource, /fn drain_json_line_payloads\(/);
  assert.doesNotMatch(streamingSource, /fn flush_json_line_payload\(/);
  assert.doesNotMatch(streamingSource, /fn openai_stream_endpoint_for_suffix\(/);
  assert.doesNotMatch(streamingSource, /fn is_openai_stream_request\(/);
  assert.doesNotMatch(streamingSource, /fn map_gemini_finish_reason\(/);
  assert.doesNotMatch(streamingSource, /fn merge_usage_from_payload\(/);
});

runTest('foundation sources local ai proxy generic support, upstream, and probe helpers from the shared native package boundary', () => {
  const localAiProxyServiceSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  );
  const anthropicNativeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  );
  const geminiNativeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  );
  const openaiCompatibleSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  );
  const observabilitySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  );
  const healthSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  );
  const requestContextSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs',
  );
  const requestTranslationSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs',
  );
  const responseIoSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs',
  );
  const streamingSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs',
  );

  assert.match(localAiProxyServiceSource, /sdkwork_local_api_proxy_native::probe::probe_route/);
  assert.match(
    localAiProxyServiceSource,
    /sdkwork_local_api_proxy_native::support::current_time_ms/,
  );

  assert.match(anthropicNativeSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(geminiNativeSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(geminiNativeSource, /sdkwork_local_api_proxy_native::upstream::/);
  assert.match(openaiCompatibleSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(openaiCompatibleSource, /sdkwork_local_api_proxy_native::upstream::/);
  assert.match(observabilitySource, /sdkwork_local_api_proxy_native::support::\{/);
  assert.match(healthSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(requestContextSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(requestTranslationSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(responseIoSource, /sdkwork_local_api_proxy_native::support::proxy_error/);
  assert.match(streamingSource, /sdkwork_local_api_proxy_native::support::\{/);

  assert.equal(
    exists('packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/support.rs'),
    false,
  );
  assert.equal(
    exists('packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/upstream.rs'),
    false,
  );
  assert.equal(
    exists('packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy/probe.rs'),
    false,
  );
});

runTest('foundation sources local ai proxy generic server launch from the shared native runtime boundary', () => {
  const localAiProxyServiceSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  );
  const sharedRuntimeSource = read(
    '../sdkwork-appbase/packages/pc-react/intelligence/sdkwork-local-api-proxy/native/tauri-rust/src/runtime/mod.rs',
  );

  assert.match(
    localAiProxyServiceSource,
    /sdkwork_local_api_proxy_native::runtime::start_local_api_proxy_server/,
  );
  assert.match(
    localAiProxyServiceSource,
    /sdkwork_local_api_proxy_native::runtime::LocalApiProxyServerHandle/,
  );
  assert.doesNotMatch(localAiProxyServiceSource, /tokio::net::TcpListener::bind/);
  assert.doesNotMatch(localAiProxyServiceSource, /axum::serve\(/);
  assert.doesNotMatch(localAiProxyServiceSource, /oneshot::channel\(/);
  assert.doesNotMatch(localAiProxyServiceSource, /thread::spawn\(/);

  assert.match(sharedRuntimeSource, /pub struct LocalApiProxyServerHandle/);
  assert.match(sharedRuntimeSource, /pub fn start_local_api_proxy_server/);
});

runTest('foundation keeps obsolete gateway docs and implementation plans out of the workspace docs surface', () => {
  const matches = findFilesContaining(
    'docs',
    /API Router|api router|@sdkwork\/claw-apirouter|sdkwork-claw-apirouter|api-router-|apirouter|apiRouter|ApiRouter|VITE_API_ROUTER_|openApiRouter/,
  );

  assert.deepEqual(matches, []);
});

runTest('foundation removes active apiRouter naming from package source outside tests', () => {
  const matches = findFilesContaining('packages', /apiRouter|ApiRouter/, {
    excludeTestFiles: true,
  });

  assert.deepEqual(matches, []);
});
