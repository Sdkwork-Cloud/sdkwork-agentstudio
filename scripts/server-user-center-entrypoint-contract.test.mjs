import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
}

const dockerComposeSource = read('deploy/docker/docker-compose.yml');
const dockerReadmeSource = read('deploy/docker/README.md');
const helmValuesSource = read('deploy/kubernetes/values.yaml');
const helmConfigMapSource = read('deploy/kubernetes/templates/configmap.yaml');
const helmSecretSource = read('deploy/kubernetes/templates/secret.yaml');

assert.match(
  dockerComposeSource,
  /AGENT_STUDIO_USER_CENTER_MODE:\s*\$\{AGENT_STUDIO_USER_CENTER_MODE:-builtin-local\}/u,
  'docker-compose must default server deployments to builtin-local user-center mode.',
);
assert.match(
  dockerComposeSource,
  /AGENT_STUDIO_USER_CENTER_APP_API_BASE_URL:\s*\$\{AGENT_STUDIO_USER_CENTER_APP_API_BASE_URL:-\}/u,
  'docker-compose must expose sdkwork-cloud-app-api upstream base-url wiring.',
);
assert.match(
  dockerComposeSource,
  /AGENT_STUDIO_USER_CENTER_EXTERNAL_BASE_URL:\s*\$\{AGENT_STUDIO_USER_CENTER_EXTERNAL_BASE_URL:-\}/u,
  'docker-compose must expose external user-center base-url wiring.',
);
assert.match(
  dockerComposeSource,
  /AGENT_STUDIO_USER_CENTER_SECRET_ID:\s*\$\{AGENT_STUDIO_USER_CENTER_SECRET_ID:-\}/u,
  'docker-compose must expose the shared secret-id bridge variable.',
);
assert.match(
  dockerComposeSource,
  /AGENT_STUDIO_USER_CENTER_SHARED_SECRET:\s*\$\{AGENT_STUDIO_USER_CENTER_SHARED_SECRET:-\}/u,
  'docker-compose must expose the shared-secret bridge variable.',
);

for (const mode of ['builtin-local', 'sdkwork-cloud-app-api', 'external-user-center']) {
  assert.match(
    dockerReadmeSource,
    new RegExp('`' + mode + '`', 'u'),
    `deploy/docker/README.md must document ${mode}.`,
  );
}

assert.match(
  helmValuesSource,
  /userCenter:\s*\n\s*mode:\s*builtin-local/u,
  'Helm values must default server deployments to builtin-local mode.',
);
assert.match(
  helmValuesSource,
  /appApiBaseUrl:\s*""/u,
  'Helm values must expose sdkwork-cloud-app-api base-url wiring.',
);
assert.match(
  helmValuesSource,
  /externalBaseUrl:\s*""/u,
  'Helm values must expose external user-center base-url wiring.',
);
assert.match(
  helmValuesSource,
  /secretId:\s*""/u,
  'Helm values must expose the shared secret-id field.',
);
assert.match(
  helmValuesSource,
  /sharedSecret:\s*""/u,
  'Helm values must expose the shared shared-secret field.',
);

assert.match(
  helmConfigMapSource,
  /AGENT_STUDIO_USER_CENTER_MODE:\s*\{\{\s*\.Values\.userCenter\.mode/u,
  'Helm ConfigMap must project the active user-center mode into the server runtime.',
);
assert.match(
  helmConfigMapSource,
  /AGENT_STUDIO_USER_CENTER_APP_API_BASE_URL:\s*\{\{\s*\.Values\.userCenter\.appApiBaseUrl/u,
  'Helm ConfigMap must project the sdkwork-cloud-app-api base-url into the server runtime.',
);
assert.match(
  helmConfigMapSource,
  /AGENT_STUDIO_USER_CENTER_EXTERNAL_BASE_URL:\s*\{\{\s*\.Values\.userCenter\.externalBaseUrl/u,
  'Helm ConfigMap must project the external user-center base-url into the server runtime.',
);

assert.match(
  helmSecretSource,
  /AGENT_STUDIO_USER_CENTER_SECRET_ID:/u,
  'Helm Secret must project the shared secret-id bridge variable.',
);
assert.match(
  helmSecretSource,
  /AGENT_STUDIO_USER_CENTER_SHARED_SECRET:/u,
  'Helm Secret must project the shared shared-secret bridge variable.',
);

console.log('agent-studio server deployment user-center entrypoint contract passed.');
