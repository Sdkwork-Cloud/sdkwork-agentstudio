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
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected "${expectedText}"`);
  }
}

function assertMatches(relativePath, expectedPattern, label) {
  const content = readText(relativePath);
  if (!expectedPattern.test(content)) {
    failures.push(
      `Missing ${label} in ${relativePath}: expected pattern "${expectedPattern.source}"`,
    );
  }
}

function extractRustStructBody(relativePath, structName) {
  const content = readText(relativePath);
  const declaration = new RegExp(`pub(?:\\(crate\\))? struct ${structName}\\s*\\{`, 'u');
  const declarationMatch = declaration.exec(content);
  if (!declarationMatch) {
    failures.push(`Missing Rust struct ${structName} in ${relativePath}`);
    return '';
  }

  const startIndex = declarationMatch.index + declarationMatch[0].length;
  const endIndex = content.indexOf('\n}', startIndex);
  if (endIndex === -1) {
    failures.push(`Unable to parse Rust struct ${structName} in ${relativePath}`);
    return '';
  }

  return content.slice(startIndex, endIndex);
}

assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'desktop process service facade module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/process_commands.rs',
  'desktop process command module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/job_commands.rs',
  'desktop job command module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/profiles.rs',
  'desktop process profiles module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  'desktop process request module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/runtime.rs',
  'desktop process runtime module',
);

assertIncludes(
  'package.json',
  '"check:desktop-process"',
  'desktop process verification script',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'mod profiles;',
  'process profiles module declaration',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'mod requests;',
  'process requests module declaration',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'mod runtime;',
  'process runtime module declaration',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'pub use self::requests::ProcessRequest;',
  'process request public re-export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'pub use self::runtime::{ProcessEventSink, ProcessOutputEvent, ProcessOutputStream, ProcessResult};',
  'process runtime public re-exports',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'pub fn run_profile_and_emit_with_started',
  'process facade profile execution method',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process.rs',
  'pub fn resolve_profile',
  'process facade profile resolution method',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/profiles.rs',
  'pub struct ProcessProfile',
  'process profile type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  'ValidatedProcessRequest',
  'validated process request type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  '#[serde(deny_unknown_fields, rename_all = "camelCase")]',
  'public process request rejects unrecognized fields',
);
{
  const processRequestBody = extractRustStructBody(
    'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
    'ProcessRequest',
  );
  if (/\benv\s*:/.test(processRequestBody)) {
    failures.push(
      'Public ProcessRequest must not expose env injection; managed runtime env must use an internal request type.',
    );
  }
}
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  'pub(crate) struct ProcessExecutionRequest',
  'internal process execution request type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  'extra_env: BTreeMap<String, String>',
  'internal-only process environment overlay',
);
assertMatches(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  /SpawnPolicyScope::Public\s*=>\s*policy\.validate_command_spawn\(&command,\s*&request\.args\)\?/,
  'public process requests use public spawn policy',
);
assertMatches(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/requests.rs',
  /SpawnPolicyScope::Profile\s*=>\s*\{?\s*policy\.validate_profile_command_spawn\(&command,\s*&request\.args\)\?/,
  'internal process profile requests use profile spawn policy',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/policy.rs',
  'pub fn validate_profile_command_spawn(&self, command: &str, args: &[String]) -> Result<()>',
  'profile-only spawn policy entrypoint',
);
assertMatches(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/policy.rs',
  /fn is_node_command\(command: &str\) -> bool \{\s*let normalized = command\.replace\('\\\\', "\/"\);/s,
  'profile-only node allowlist normalizes Windows command paths',
);
assertMatches(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/policy.rs',
  /fn is_npx_command\(command: &str\) -> bool \{\s*let normalized = command\.replace\('\\\\', "\/"\);/s,
  'profile-only npx allowlist normalizes Windows command paths',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/process/runtime.rs',
  'struct ProcessRuntime',
  'process runtime coordinator',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/process_commands.rs',
  '.run_capture_and_emit(',
  'process command remains facade-based',
);
assertMatches(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/job_commands.rs',
  /\.submit_process_and_emit\(\s*state\.context\.services\.process\.clone\(\),\s*&profile_id,\s*app,\s*\)/,
  'job command remains process-service based',
);

if (failures.length > 0) {
  console.error('desktop process kernel contract failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('desktop process kernel contract passed');
