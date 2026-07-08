import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return null;
  }

  return readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  const content = readText(relativePath);
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    failures.push(
      `Invalid JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertScript(pkg, pkgPath, scriptName) {
  if (!pkg?.scripts || typeof pkg.scripts[scriptName] !== 'string' || pkg.scripts[scriptName].trim().length === 0) {
    failures.push(`Missing script "${scriptName}" in ${pkgPath}`);
  }
}

function assertDependency(pkg, pkgPath, dependencyName, bucket = 'dependencies') {
  if (!pkg?.[bucket] || typeof pkg[bucket][dependencyName] !== 'string') {
    failures.push(`Missing ${bucket} dependency "${dependencyName}" in ${pkgPath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected to find "${expectedText}"`);
  }
}

function assertNotIncludes(relativePath, unexpectedText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  if (content.includes(unexpectedText)) {
    failures.push(`Unexpected ${label} in ${relativePath}: should not find "${unexpectedText}"`);
  }
}

const requiredPaths = [
  ['packages/sdkwork-clawstudio-shell/package.json', 'shell package'],
  ['packages/sdkwork-clawstudio-shell/src/index.ts', 'shell entry'],
  ['packages/sdkwork-clawstudio-desktop/package.json', 'desktop package'],
  ['packages/sdkwork-clawstudio-desktop/.env.example', 'desktop env example'],
  ['packages/sdkwork-clawstudio-desktop/src/main.tsx', 'desktop entry'],
  ['packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts', 'desktop command and event catalog module'],
  ['packages/sdkwork-clawstudio-desktop/src/desktop/runtime.ts', 'desktop runtime bridge module'],
  ['packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts', 'desktop bridge'],
  ['packages/sdkwork-clawstudio-desktop/src/desktop/studioCommandCompat.ts', 'desktop studio command compatibility bridge'],
  ['packages/sdkwork-clawstudio-infrastructure/src/config/env.ts', 'desktop env config module'],
  ['packages/sdkwork-clawstudio-infrastructure/src/updates/contracts.ts', 'desktop update contracts module'],
  ['packages/sdkwork-clawstudio-infrastructure/src/updates/updateClient.ts', 'desktop update client module'],
  ['packages/sdkwork-clawstudio-core/src/services/updateService.ts', 'desktop update business service'],
  ['packages/sdkwork-clawstudio-core/src/stores/useUpdateStore.ts', 'desktop update state store'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml', 'desktop Cargo manifest'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json', 'desktop Tauri config'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/tauri.windows.conf.json', 'desktop Windows Tauri config'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/tauri.linux.conf.json', 'desktop Linux Tauri config'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/tauri.macos.conf.json', 'desktop macOS Tauri config'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/generated', 'desktop generated resource root'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/resources/openclaw/.gitkeep', 'packaged OpenClaw runtime placeholder'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/mod.rs', 'desktop framework module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/error.rs', 'desktop framework error module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/context.rs', 'desktop framework context module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/paths.rs', 'desktop framework paths module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/config.rs', 'desktop framework config module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/kernel.rs', 'desktop framework kernel contract module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/logging.rs', 'desktop framework logging module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/events.rs', 'desktop framework events module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/filesystem.rs', 'desktop framework filesystem module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/policy.rs', 'desktop framework policy module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/runtime.rs', 'desktop framework runtime module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/storage.rs', 'desktop framework storage contract module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs', 'desktop framework services module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/system.rs', 'desktop system service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/kernel.rs', 'desktop kernel assembler service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs', 'desktop local ai proxy runtime service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/config.rs', 'desktop local ai proxy config module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs', 'desktop local ai proxy managed provider projection module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs', 'desktop local ai proxy health and status projection module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs', 'desktop local ai proxy openai-compatible request-serving module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability_store.rs', 'desktop local ai proxy observability-store module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs', 'desktop local ai proxy request-context module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/types.rs', 'desktop local ai proxy shared types module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs', 'desktop local ai proxy shared response/error module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs', 'desktop local ai proxy router module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy_snapshot.rs', 'desktop local ai proxy snapshot module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/security.rs', 'desktop security service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/notifications.rs', 'desktop notifications service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/payments.rs', 'desktop payments service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/integrations.rs', 'desktop integrations service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/openclaw_runtime.rs', 'desktop packaged OpenClaw runtime service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/path_registration.rs', 'desktop packaged OpenClaw path registration service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/permissions.rs', 'desktop permissions service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/process.rs', 'desktop process service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/jobs.rs', 'desktop jobs service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/browser.rs', 'desktop browser service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/dialog.rs', 'desktop dialog service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs', 'desktop storage service module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/plugins/mod.rs', 'desktop plugin registration module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/app_info.rs', 'desktop app info command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/desktop_kernel.rs', 'desktop kernel command module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/get_app_paths.rs', 'desktop app paths command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/get_app_config.rs', 'desktop app config command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/process_commands.rs', 'desktop process command module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/job_commands.rs', 'desktop job command module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/list_directory.rs', 'desktop list directory command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/create_directory.rs', 'desktop create directory command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/remove_path.rs', 'desktop remove path command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/copy_path.rs', 'desktop copy path command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/move_path.rs', 'desktop move path command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/path_exists.rs', 'desktop path exists command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/get_path_info.rs', 'desktop path info command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/read_binary_file.rs', 'desktop binary read command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/write_binary_file.rs', 'desktop binary write command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/open_external.rs', 'desktop open external command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/select_files.rs', 'desktop select files command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/save_blob_file.rs', 'desktop save blob file command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/fetch_remote_url.rs', 'desktop remote url fetch command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/capture_screenshot.rs', 'desktop capture screenshot command'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/state/mod.rs', 'desktop state module'],
  ['packages/sdkwork-clawstudio-desktop/src-tauri/src/platform/mod.rs', 'desktop platform module'],
  ['scripts/prepare-openclaw-runtime.mjs', 'packaged OpenClaw runtime prepare script'],
  ['scripts/prepare-openclaw-runtime.test.mjs', 'packaged OpenClaw runtime prepare test'],
  ['scripts/run-cargo.mjs', 'shared Rust toolchain launcher'],
  ['scripts/run-cargo.mjs', 'shared Rust toolchain launcher'],
  ['scripts/verify-desktop-build-assets.mjs', 'desktop bundled asset verification script'],
  ['scripts/ensure-tauri-dev-binary-unlocked.mjs', 'tauri dev binary unlock guard script'],
  ['scripts/ensure-tauri-dev-binary-unlocked.test.mjs', 'tauri dev binary unlock guard test'],
  ['packages/sdkwork-clawstudio-distribution/package.json', 'distribution package'],
  ['packages/sdkwork-clawstudio-distribution/src/index.ts', 'distribution entry'],
  ['packages/sdkwork-clawstudio-distribution/src/manifests/cn/index.ts', 'cn distribution manifest'],
  ['packages/sdkwork-clawstudio-distribution/src/manifests/global/index.ts', 'global distribution manifest'],
];

for (const [relativePath, label] of requiredPaths) {
  assertPath(relativePath, label);
}

for (const [relativePath, label] of [
  [
    'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/api_router_managed_runtime.rs',
    'desktop bundled api router runtime service module',
  ],
  [
    'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/api_router_runtime.rs',
    'desktop api router runtime service module',
  ],
  [
    'packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/api_router_runtime.rs',
    'desktop api router runtime command',
  ],
]) {
  if (existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Unexpected removed ${label}: ${relativePath}`);
  }
}

const rootPackagePath = 'package.json';
const desktopPackagePath = 'packages/sdkwork-clawstudio-desktop/package.json';
const rootPackage = readJson(rootPackagePath);
const desktopPackage = readJson(desktopPackagePath);

for (const scriptName of ['tauri:dev', 'tauri:build', 'tauri:icon', 'tauri:info']) {
  assertScript(rootPackage, rootPackagePath, scriptName);
  assertScript(desktopPackage, desktopPackagePath, scriptName);
}

assertScript(desktopPackage, desktopPackagePath, 'dev:tauri');
assertScript(desktopPackage, desktopPackagePath, 'prepare:openclaw-runtime');
assertScript(rootPackage, rootPackagePath, 'sync:bundled-components');

if (
  rootPackage?.scripts?.['check:desktop']
  && !rootPackage.scripts['check:desktop'].includes('sdkwork-run-node scripts/run-cargo.mjs test --manifest-path packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml')
) {
  failures.push('Root package check:desktop script must execute cargo through the shared Rust toolchain launcher.');
}

assertDependency(desktopPackage, desktopPackagePath, '@tauri-apps/cli', 'devDependencies');
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod config;',
  'desktop local ai proxy config submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'config::ensure_local_ai_proxy_config',
  'desktop local ai proxy config module usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod projection;',
  'desktop local ai proxy projection submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'projection::project_managed_openclaw_provider',
  'desktop local ai proxy projection module usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'probe::probe_route',
  'desktop local ai proxy probe module usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod health;',
  'desktop local ai proxy health submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod openai_compatible;',
  'desktop local ai proxy openai-compatible submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod response_io;',
  'desktop local ai proxy shared response/error submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod observability_store;',
  'desktop local ai proxy observability-store submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod request_context;',
  'desktop local ai proxy request-context submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod types;',
  'desktop local ai proxy shared types submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod router;',
  'desktop local ai proxy router submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'router::build_router(state)',
  'desktop local ai proxy router owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'get(health::health_handler)',
  'desktop local ai proxy router health handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'get(openai_compatible::models_handler)',
  'desktop local ai proxy router openai-compatible models handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(openai_compatible::chat_completions_handler)',
  'desktop local ai proxy router openai-compatible chat completions handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(openai_compatible::openai_responses_handler)',
  'desktop local ai proxy router openai-compatible responses handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(openai_compatible::openai_embeddings_handler)',
  'desktop local ai proxy router openai-compatible embeddings handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(anthropic_native::messages_handler)',
  'desktop local ai proxy router anthropic-native handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'get(gemini_native::models_handler_v1beta)',
  'desktop local ai proxy router gemini-native models handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(gemini_native::model_action_handler_v1beta)',
  'desktop local ai proxy router gemini-native v1beta action handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(gemini_native::model_action_handler_v1)',
  'desktop local ai proxy router gemini-native v1 action handler delegation',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn models_handler(',
  'desktop local ai proxy in-file models handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn chat_completions_handler(',
  'desktop local ai proxy in-file chat completions handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn openai_responses_handler(',
  'desktop local ai proxy in-file responses handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn openai_embeddings_handler(',
  'desktop local ai proxy in-file embeddings handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn openai_compatible_passthrough_handler(',
  'desktop local ai proxy in-file openai-compatible passthrough handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn ollama_openai_compatible_handler(',
  'desktop local ai proxy in-file ollama openai-compatible handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn anthropic_openai_compatible_handler(',
  'desktop local ai proxy in-file anthropic openai-compatible handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_openai_compatible_handler(',
  'desktop local ai proxy in-file gemini openai-compatible handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn resolve_request_model_id(',
  'desktop local ai proxy in-file openai-compatible model resolver',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn extract_token_usage(',
  'desktop local ai proxy in-file openai-compatible token usage extractor',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn value_u64(',
  'desktop local ai proxy in-file openai-compatible token usage pointer helper',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'get(health::health_handler)',
  'desktop local ai proxy router health handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'health::reconcile_observability_store',
  'desktop local ai proxy observability-store reconciliation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'health::build_health',
  'desktop local ai proxy health builder usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'health::build_route_metrics',
  'desktop local ai proxy route metrics projection usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'health::collect_route_tests',
  'desktop local ai proxy route test projection usage',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_router(state: LocalAiProxyAppState) -> Router',
  'desktop local ai proxy in-file router builder',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  '.route("/health", get(health::health_handler))',
  'desktop local ai proxy in-file health route assembly',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  '.route("/v1/models", get(openai_compatible::models_handler))',
  'desktop local ai proxy in-file openai models route assembly',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  '.route("/v1/messages", post(anthropic_native::messages_handler))',
  'desktop local ai proxy in-file anthropic route assembly',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  '.route("/v1beta/models", get(gemini_native::models_handler_v1beta))',
  'desktop local ai proxy in-file gemini route assembly',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn reconcile_observability_store(',
  'desktop local ai proxy in-file observability-store reconciliation helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_route_metrics(',
  'desktop local ai proxy in-file route metrics helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn collect_route_tests(',
  'desktop local ai proxy in-file route test collection helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn derive_route_health(',
  'desktop local ai proxy in-file route health derivation helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn health_handler(',
  'desktop local ai proxy in-file health handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_health(',
  'desktop local ai proxy in-file health builder helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn collect_default_route_health(',
  'desktop local ai proxy in-file default route health helper',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'observability_store::lock_observability',
  'desktop local ai proxy observability-store lock usage in runtime service',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  'observability_store::{LocalAiProxyObservabilityStore, LocalAiProxyRouteMetricsState}',
  'desktop local ai proxy observability-store type usage in observability module',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  'observability_store::{',
  'desktop local ai proxy observability-store type import in health module',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  'lock_observability',
  'desktop local ai proxy observability-store lock usage in health module',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'struct LocalAiProxyObservabilityStore {',
  'desktop local ai proxy in-file observability store struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'struct LocalAiProxyRouteMetricsState {',
  'desktop local ai proxy in-file route metrics state struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn lock_observability(',
  'desktop local ai proxy in-file observability lock helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'type ProxyHttpResult<T> =',
  'desktop local ai proxy in-file proxy http result type alias',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub enum LocalAiProxyLifecycle {',
  'desktop local ai proxy in-file lifecycle enum',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub struct LocalAiProxyDefaultRouteHealth {',
  'desktop local ai proxy in-file default route health struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub struct LocalAiProxyServiceHealth {',
  'desktop local ai proxy in-file service health struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub struct LocalAiProxyServiceStatus {',
  'desktop local ai proxy in-file service status struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub struct LocalAiProxyRouteRuntimeMetrics {',
  'desktop local ai proxy in-file route runtime metrics struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'pub struct LocalAiProxyRouteTestRecord {',
  'desktop local ai proxy in-file route test record struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'struct LocalAiProxyTokenUsage {',
  'desktop local ai proxy in-file token usage struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'struct LocalAiProxyAppState {',
  'desktop local ai proxy in-file app state struct',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs',
  'support::proxy_error',
  'desktop local ai proxy request-context shared support usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_context.rs',
  'types::{LocalAiProxyAppState, ProxyHttpResult}',
  'desktop local ai proxy request-context shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs',
  'types::ProxyHttpResult',
  'desktop local ai proxy request-translation shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_io.rs',
  'types::{LocalAiProxyTokenUsage, ProxyHttpResult}',
  'desktop local ai proxy response-io shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  'types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}',
  'desktop local ai proxy observability shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs',
  'support::{duration_to_ms, proxy_error, trim_optional_text}',
  'desktop local ai proxy streaming shared support usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs',
  'types::LocalAiProxyTokenUsage',
  'desktop local ai proxy streaming shared token-usage type usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_context::current_snapshot',
  'desktop local ai proxy openai-compatible snapshot owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}',
  'desktop local ai proxy openai-compatible shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'support::proxy_error',
  'desktop local ai proxy openai-compatible shared error helper usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_context::require_client_auth',
  'desktop local ai proxy openai-compatible auth owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_context::require_route_for_protocol',
  'desktop local ai proxy openai-compatible route selection owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_context::parse_json_body',
  'desktop local ai proxy openai-compatible request-body parse owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'request_context::current_snapshot',
  'desktop local ai proxy anthropic-native snapshot owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}',
  'desktop local ai proxy anthropic-native shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'request_context::require_client_auth',
  'desktop local ai proxy anthropic-native auth owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'request_context::require_route_for_protocol',
  'desktop local ai proxy anthropic-native route selection owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'request_context::parse_json_body',
  'desktop local ai proxy anthropic-native request-body parse owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'request_context::header_text',
  'desktop local ai proxy anthropic-native header-text owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  'request_context::current_snapshot',
  'desktop local ai proxy gemini-native snapshot owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  'types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult}',
  'desktop local ai proxy gemini-native shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  'request_context::require_client_auth',
  'desktop local ai proxy gemini-native auth owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  'request_context::require_route_for_protocol',
  'desktop local ai proxy gemini-native route selection owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  'request_context::current_snapshot',
  'desktop local ai proxy health snapshot owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/health.rs',
  'types::{',
  'desktop local ai proxy health shared types usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/projection.rs',
  'types::LocalAiProxyServiceHealth',
  'desktop local ai proxy projection shared service-health type usage',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn current_snapshot(',
  'desktop local ai proxy in-file snapshot helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn require_route_for_protocol<',
  'desktop local ai proxy in-file route selection helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn require_client_auth(',
  'desktop local ai proxy in-file auth helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn header_text(',
  'desktop local ai proxy in-file header-text helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn parse_json_body(',
  'desktop local ai proxy in-file json-body parse helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn proxy_error(',
  'desktop local ai proxy in-file shared error helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn duration_to_ms(',
  'desktop local ai proxy in-file duration helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn trim_optional_text(',
  'desktop local ai proxy in-file trimmed text helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn current_time_ms(',
  'desktop local ai proxy in-file current-time helper',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/streaming.rs',
  'desktop local ai proxy streaming submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod streaming;',
  'desktop local ai proxy streaming submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'streaming::is_openai_stream_request',
  'desktop local ai proxy streaming request detection usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'streaming::openai_stream_endpoint_for_suffix',
  'desktop local ai proxy streaming endpoint resolver usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'streaming::build_passthrough_response',
  'desktop local ai proxy passthrough streaming module usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'streaming::build_translated_openai_sse_response',
  'desktop local ai proxy translated sse module usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'streaming::build_translated_openai_jsonl_response',
  'desktop local ai proxy translated jsonl module usage',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/request_translation.rs',
  'desktop local ai proxy request-translation submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod request_translation;',
  'desktop local ai proxy request-translation submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_translation::build_anthropic_request_from_openai_chat',
  'desktop local ai proxy anthropic request-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_translation::build_gemini_request_from_openai_chat',
  'desktop local ai proxy gemini request-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_translation::build_ollama_request_from_openai_chat',
  'desktop local ai proxy ollama request-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_translation::build_gemini_request_from_openai_embeddings',
  'desktop local ai proxy gemini embedding request-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'request_translation::build_ollama_request_from_openai_embeddings',
  'desktop local ai proxy ollama embedding request-translation usage',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/response_translation.rs',
  'desktop local ai proxy response-translation submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod response_translation;',
  'desktop local ai proxy response-translation submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_chat_completion_from_anthropic',
  'desktop local ai proxy anthropic response-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_chat_completion_from_gemini',
  'desktop local ai proxy gemini chat response-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_chat_completion_from_ollama',
  'desktop local ai proxy ollama chat response-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_response_from_anthropic',
  'desktop local ai proxy anthropic responses-api translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_response_from_gemini',
  'desktop local ai proxy gemini responses-api translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_response_from_ollama',
  'desktop local ai proxy ollama responses-api translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_embeddings_from_gemini',
  'desktop local ai proxy gemini embedding response-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_translation::build_openai_embeddings_from_ollama',
  'desktop local ai proxy ollama embedding response-translation usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'response_io::{',
  'desktop local ai proxy response-io owner import',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'build_buffered_upstream_response',
  'desktop local ai proxy buffered upstream response owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'build_json_outcome',
  'desktop local ai proxy json outcome owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'parse_json_response',
  'desktop local ai proxy json response parsing owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  'response_io::{extract_proxy_error_message, ProxyRouteOutcome}',
  'desktop local ai proxy observability error extraction owner usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  'response_io::{extract_proxy_error_message, ProxyRouteOutcome}',
  'desktop local ai proxy observability outcome owner usage',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'struct ProxyRouteOutcome {',
  'desktop local ai proxy in-file route outcome struct',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_json_outcome(',
  'desktop local ai proxy in-file json outcome helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn build_buffered_upstream_response(',
  'desktop local ai proxy in-file buffered upstream response helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn resolve_error_message(',
  'desktop local ai proxy in-file error message resolver',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn extract_error_message_from_payload(',
  'desktop local ai proxy in-file error payload extractor',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn extract_proxy_error_message(',
  'desktop local ai proxy in-file proxy error extractor',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn parse_json_response(',
  'desktop local ai proxy in-file json response parser',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_json_response(',
  'desktop local ai proxy in-file json response builder',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/observability.rs',
  'desktop local ai proxy observability submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod observability;',
  'desktop local ai proxy observability submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'observability::build_request_audit_context',
  'desktop local ai proxy request audit context usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'observability::record_proxy_route_outcome',
  'desktop local ai proxy route outcome observability usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'observability::record_proxy_route_usage_adjustment',
  'desktop local ai proxy usage adjustment observability usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'observability::record_proxy_request_log',
  'desktop local ai proxy request log observability usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/openai_compatible.rs',
  'observability::record_completed_stream_request_log',
  'desktop local ai proxy completed stream log usage',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn record_proxy_route_outcome(',
  'desktop local ai proxy in-file route outcome helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn record_proxy_route_usage_adjustment(',
  'desktop local ai proxy in-file usage adjustment helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn record_proxy_request_log(',
  'desktop local ai proxy in-file request log helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn record_completed_stream_request_log(',
  'desktop local ai proxy in-file completed stream log helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn build_request_audit_context(',
  'desktop local ai proxy in-file request audit context helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn extract_logged_messages(',
  'desktop local ai proxy in-file logged message extraction helper',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn extract_response_preview_from_value(',
  'desktop local ai proxy in-file response preview helper',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/gemini_native.rs',
  'desktop local ai proxy gemini native protocol submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod gemini_native;',
  'desktop local ai proxy gemini native protocol submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'get(gemini_native::models_handler_v1beta)',
  'desktop local ai proxy router gemini models handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(gemini_native::model_action_handler_v1beta)',
  'desktop local ai proxy router gemini v1beta action handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(gemini_native::model_action_handler_v1)',
  'desktop local ai proxy router gemini v1 action handler delegation',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_models_handler_v1beta(',
  'desktop local ai proxy in-file gemini v1beta models handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_models_handler(',
  'desktop local ai proxy in-file gemini models handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_model_action_handler_v1beta(',
  'desktop local ai proxy in-file gemini v1beta action handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_model_action_handler_v1(',
  'desktop local ai proxy in-file gemini v1 action handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'async fn gemini_model_action_handler(',
  'desktop local ai proxy in-file gemini action handler',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn parse_model_action(',
  'desktop local ai proxy in-file gemini model-action parser',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'fn gemini_supported_generation_methods(',
  'desktop local ai proxy in-file gemini generation-method helper',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/anthropic_native.rs',
  'desktop local ai proxy anthropic native protocol submodule',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  'mod anthropic_native;',
  'desktop local ai proxy anthropic native protocol submodule declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/local_ai_proxy/router.rs',
  'post(anthropic_native::messages_handler)',
  'desktop local ai proxy router anthropic messages handler delegation',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'export const DESKTOP_COMMANDS',
  'desktop command catalog export',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'getApiRouterRuntimeStatus',
  'desktop api router runtime command catalog entry',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'captureScreenshot',
  'desktop screenshot command catalog entry',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'fetchRemoteUrl',
  'desktop remote url fetch command catalog entry',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'desktopComponentCatalog',
  'desktop component catalog command catalog entry',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'desktopComponentControl',
  'desktop component control command catalog entry',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/catalog.ts',
  'export const DESKTOP_EVENTS',
  'desktop event catalog export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/runtime.ts',
  'export class DesktopBridgeError',
  'desktop bridge error export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/runtime.ts',
  'export async function invokeDesktopCommand',
  'desktop invoke wrapper export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/runtime.ts',
  'export async function listenDesktopEvent',
  'desktop event listener wrapper export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppInfo',
  'desktop app info bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppPaths',
  'desktop app paths bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getAppConfig',
  'desktop app config bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopKernelInfo',
  'desktop kernel info bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopStorageInfo',
  'desktop storage info bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function captureScreenshot',
  'desktop screenshot bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function fetchRemoteUrl',
  'desktop remote url fetch bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  "from './componentsBridge'",
  'desktop components bridge integration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export function supportsNativeScreenshot',
  'desktop screenshot support bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function listDirectory',
  'desktop list directory bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function createDirectory',
  'desktop create directory bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function removePath',
  'desktop remove path bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function copyPath',
  'desktop copy path bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function movePath',
  'desktop move path bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function pathExists',
  'desktop path exists bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getPathInfo',
  'desktop path info bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function readBinaryFile',
  'desktop binary read bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function writeBinaryFile',
  'desktop binary write bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function subscribeJobUpdates',
  'desktop job event subscription export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function subscribeProcessOutput',
  'desktop process event subscription export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS',
  'desktop command catalog usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_EVENTS',
  'desktop event catalog usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'invokeDesktopCommand',
  'desktop invoke wrapper usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'listenDesktopEvent',
  'desktop event wrapper usage',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export const desktopTemplateApi',
  'desktop template API facade export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  "from './studioCommandCompat'",
  'desktop studio command compat re-export wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function studioListInstances',
  'inline desktop studio compat list export in canonical bridge',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function invokeOpenClawGateway',
  'inline desktop studio compat gateway export in canonical bridge',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/studioCommandCompat.ts',
  'export const desktopLegacyStudioCompatApi',
  'desktop studio compat facade export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/studioCommandCompat.ts',
  'DESKTOP_COMMANDS.studioListInstances',
  'desktop studio compat list command wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/studioCommandCompat.ts',
  'DESKTOP_COMMANDS.studioCreateInstanceTask',
  'desktop studio compat task command wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'catalog:',
  'desktop template API catalog grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'meta:',
  'desktop template API meta grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'app:',
  'desktop template API app grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'kernel:',
  'desktop template API kernel grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'storage:',
  'desktop template API storage grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'filesystem:',
  'desktop template API filesystem grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'jobs:',
  'desktop template API job grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'shell:',
  'desktop template API shell grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'installer:',
  'desktop template API installer grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'runtime:',
  'desktop template API runtime grouping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'DESKTOP_COMMANDS',
  'desktop package command catalog export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'DESKTOP_EVENTS',
  'desktop package event catalog export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'desktopTemplateApi',
  'desktop package template API export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'captureScreenshot',
  'desktop package screenshot export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'controlDesktopComponent',
  'desktop package component control export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'fetchRemoteUrl',
  'desktop package remote url fetch export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/index.ts',
  'DesktopBridgeError',
  'desktop package bridge error export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.openExternal',
  'desktop open external invoke wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.selectFiles',
  'desktop select files invoke wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.saveBlobFile',
  'desktop save blob file invoke wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.captureScreenshot',
  'desktop screenshot invoke wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.fetchRemoteUrl',
  'desktop remote url fetch invoke wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.runInstall',
  'desktop removed install invoke wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'DESKTOP_COMMANDS.runUninstall',
  'desktop removed uninstall invoke wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getApiRouterRuntimeStatus',
  'desktop api router runtime bridge export',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function ensureApiRouterRuntimeStarted',
  'desktop api router runtime starter bridge export',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function getApiRouterAdminBootstrapSession',
  'desktop api router bootstrap bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'listenDesktopEvent',
  'desktop event listener wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-single-instance',
  'single-instance plugin dependency',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-dialog',
  'dialog plugin dependency',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'tauri-plugin-opener',
  'opener plugin dependency',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'xcap = "0.9.3"',
  'desktop screenshot crate dependency',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  '[patch.crates-io]',
  'desktop cargo patch section for screenshot crate',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'xcap = { path = "vendor/xcap" }',
  'desktop patched screenshot crate source',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'image',
  'desktop screenshot image dependency',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.toml',
  'screenshots',
  'temporary desktop screenshot crate dependency',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.lock',
  'name = "pipewire"',
  'pipewire lockfile entry pulled by screenshot stack',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/Cargo.lock',
  'name = "libspa"',
  'libspa lockfile entry pulled by screenshot stack',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'plugins',
  'plugin bootstrap wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_kernel_info',
  'desktop kernel command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_storage_info',
  'desktop storage command registration',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::run_install::run_install',
  'desktop removed install command registration',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::run_uninstall::run_uninstall',
  'desktop removed uninstall command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::capture_screenshot::capture_screenshot',
  'desktop screenshot command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::component_commands::desktop_component_catalog',
  'desktop component catalog command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::component_commands::desktop_component_control',
  'desktop component control command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::fetch_remote_url::fetch_remote_url',
  'desktop remote url fetch command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'activate_bundled_openclaw',
  'bundled openclaw startup activation wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'ensure_local_ai_proxy_ready(&context.paths, &context.config)',
  'bundled local ai proxy activation wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'inspect_api_router_runtime_on_startup(&app_handle, context.as_ref())?;',
  'bundled api router startup inspection wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'activate_bundled_api_router',
  'bundled api router startup activation wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'restart_openclaw_gateway',
  'bundled openclaw supervisor restart wiring',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::api_router_runtime::get_api_router_runtime_status',
  'desktop api router runtime command registration',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/mod.rs',
  'pub mod api_router_runtime;',
  'desktop api router runtime command module export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod openclaw_runtime;',
  'packaged OpenClaw runtime service export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod local_ai_proxy;',
  'local ai proxy service export',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod api_router_managed_runtime;',
  'bundled api router runtime service export',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod api_router_runtime;',
  'desktop api router runtime service export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json',
  'foundation/components/',
  'bundled component metadata resource packaging',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json',
  'generated/bundled/',
  'generated desktop asset resource packaging',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json',
  '../dist/',
  'desktop browser shell dist resource packaging',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json',
  'resources/openclaw/',
  'packaged OpenClaw runtime resource declaration',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.conf.json',
  '/**/*',
  'desktop recursive resource glob packaging',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.linux.conf.json',
  'generated/release/openclaw-resource/',
  'Linux packaged OpenClaw archive bridge resource mapping',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.linux.conf.json',
  './linux-postinstall-openclaw.sh',
  'legacy Linux OpenClaw postinstall hook wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.macos.conf.json',
  'generated/release/openclaw-resource/',
  'macOS packaged OpenClaw archive bridge resource mapping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/tauri.macos.conf.json',
  'generated/release/macos-install-root/',
  'macOS preexpanded OpenClaw managed runtime layout mapping',
);
const tauriWindowsBundleConfig = readJson('packages/sdkwork-clawstudio-desktop/src-tauri/tauri.windows.conf.json');
if (typeof tauriWindowsBundleConfig?.bundle?.windows?.nsis?.installerHooks !== 'undefined') {
  failures.push('Desktop Windows Tauri config must not wire legacy OpenClaw installer hooks.');
}
if (existsSync(path.join(rootDir, 'packages/sdkwork-clawstudio-desktop/src-tauri/installer-hooks.nsh'))) {
  failures.push('Legacy Windows OpenClaw installer hooks must be removed after the external-runtime hard cut.');
}

const tauriLinuxBundleConfig = readJson('packages/sdkwork-clawstudio-desktop/src-tauri/tauri.linux.conf.json');
if (typeof tauriLinuxBundleConfig?.bundle?.linux?.deb?.postInstallScript !== 'undefined') {
  failures.push('Desktop Linux deb packaging must not wire a legacy OpenClaw postinstall script.');
}
if (typeof tauriLinuxBundleConfig?.bundle?.linux?.rpm?.postInstallScript !== 'undefined') {
  failures.push('Desktop Linux rpm packaging must not wire a legacy OpenClaw postinstall script.');
}
if (existsSync(path.join(rootDir, 'packages/sdkwork-clawstudio-desktop/src-tauri/linux-postinstall-openclaw.sh'))) {
  failures.push('Legacy Linux OpenClaw postinstall hook must be removed after the external-runtime hard cut.');
}
assertIncludes(
  'scripts/sync-bundled-components.mjs',
  "desktopWebDistBundleSourceRoot",
  'desktop browser shell bundle source root wiring',
);
assertIncludes(
  'scripts/sync-bundled-components.mjs',
  "'web-dist': ['generated', 'br', 'w']",
  'windows desktop browser shell bridge root mapping',
);
assertIncludes(
  'scripts/run-windows-tauri-bundle.mjs',
  "['bridge-web-dist', 'web-dist', ['generated', 'br', 'w'], true]",
  'windows NSIS browser shell bridge rewrite mapping',
);
assertIncludes(
  'scripts/run-windows-tauri-bundle.mjs',
  "['bridge-openclaw', 'openclaw', ['generated', 'br', 'o'], false]",
  'windows NSIS OpenClaw bridge rewrite mapping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod path_registration;',
  'packaged OpenClaw path registration service export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/mod.rs',
  'pub mod runtime;',
  'desktop runtime export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/mod.rs',
  'pub mod services;',
  'desktop services export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/context.rs',
  'services',
  'desktop context services wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/events.rs',
  'job://updated',
  'desktop job event constant',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/events.rs',
  'process://output',
  'desktop process output event constant',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'RuntimeApiRouterRuntimeStatus',
  'runtime api router status contract',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'RuntimeApiRouterAdminBootstrapSession',
  'runtime api router bootstrap session contract',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'subscribeJobUpdates',
  'runtime job subscription contract',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'subscribeProcessOutput',
  'runtime process subscription contract',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/config/env.ts',
  'export function createAppEnvConfig',
  'typed env factory',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/updates/updateClient.ts',
  'APP_UPDATE_CHECK_PATH',
  'backend update check path constant',
);
assertIncludes(
  'packages/sdkwork-clawstudio-core/src/services/updateService.ts',
  'checkForAppUpdate',
  'business update check service',
);
assertIncludes(
  'packages/sdkwork-clawstudio-core/src/services/updateService.ts',
  'resolvePreferredUpdateAction',
  'business update action resolver',
);
assertIncludes(
  'packages/sdkwork-clawstudio-core/src/services/updateService.ts',
  'isStartupCheckEnabled',
  'business startup update flag helper',
);
assertIncludes(
  'packages/sdkwork-clawstudio-core/src/stores/useUpdateStore.ts',
  'runStartupCheck',
  'startup update store action',
);
assertIncludes(
  'packages/sdkwork-clawstudio-core/src/stores/useUpdateStore.ts',
  'openLatestUpdateTarget',
  'manual update action store helper',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  'configureDesktopPlatformBridge()',
  'desktop bridge bootstrap wiring',
);
assertIncludes(
  'packages/sdkwork-clawstudio-shell/src/application/providers/AppProviders.tsx',
  'runStartupCheck',
  'shell startup update check wiring',
);
assertIncludes('.gitignore', '.venv/', 'Python virtual environment ignore rule');
assertIncludes('.gitignore', '__pycache__/', 'Python bytecode cache ignore rule');
assertIncludes('.gitignore', '*.pyc', 'Python compiled file ignore rule');
assertIncludes('.gitignore', '.pytest_cache/', 'pytest cache ignore rule');
assertIncludes('.gitignore', '.cache/', 'generic cache ignore rule');
assertIncludes(
  '.gitignore',
  'packages/sdkwork-clawstudio-desktop/src-tauri/resources/openclaw/*',
  'bundled openclaw generated resource ignore rule',
);
assertIncludes(
  '.gitignore',
  '!packages/sdkwork-clawstudio-desktop/src-tauri/resources/openclaw/.gitkeep',
  'bundled openclaw placeholder keep rule',
);

const tauriLeakTargets = [];

for (const relativePath of tauriLeakTargets) {
  const content = readText(relativePath);
  if (!content) {
    continue;
  }

  if (content.includes('@tauri-apps/api/core')) {
    failures.push(`Direct Tauri API import is not allowed in page layer: ${relativePath}`);
  }
}

if (failures.length > 0) {
  console.error('Desktop platform foundation check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Desktop platform foundation check passed.');
