import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('docker deployment templates keep compose commands and overlay profiles aligned with the packaged bundle layout', () => {
  const dockerReadme = read('deploy/docker/README.md');
  const dockerCompose = read('deploy/docker/docker-compose.yml');
  const nvidiaCompose = read('deploy/docker/docker-compose.nvidia-cuda.yml');
  const amdCompose = read('deploy/docker/docker-compose.amd-rocm.yml');
  const defaultEnv = read('deploy/docker/profiles/default.env');
  const nvidiaEnv = read('deploy/docker/profiles/nvidia-cuda.env');
  const amdEnv = read('deploy/docker/profiles/amd-rocm.env');
  const releaseDoc = read('docs/core/release-and-deployment.md');

  assert.match(dockerReadme, /docker compose -f deploy\/docker\/docker-compose\.yml up -d/);
  assert.match(dockerReadme, /docker compose -f deploy\/docker\/docker-compose\.yml -f deploy\/docker\/docker-compose\.nvidia-cuda\.yml up -d/);
  assert.match(dockerReadme, /docker compose -f deploy\/docker\/docker-compose\.yml -f deploy\/docker\/docker-compose\.amd-rocm\.yml up -d/);
  assert.match(
    dockerReadme,
    /source (?:tree|repository)[\s\S]*deploy\/docker\/docker-compose\.yml/i,
    'docker deployment docs must explain the source-tree template path separately from the packaged bundle command',
  );
  assert.match(
    dockerReadme,
    /extracted bundle root[\s\S]*deploy\/docker\/docker-compose\.yml/i,
    'docker deployment docs must explain the packaged bundle command separately from the source-tree template path',
  );
  assert.match(
    dockerReadme,
    /pnpm release:package:container/,
    'docker deployment docs must explain how to render the packaged bundle layout locally from the source tree',
  );
  assert.match(
    dockerReadme,
    /refreshes a matching Linux server binary through an incremental build/i,
    'docker deployment docs must describe the local container packaging wrapper as an incremental refresh of the matching Linux server binary',
  );
  assert.match(dockerCompose, /context:\s+\.\./);
  assert.match(
    dockerCompose,
    /dockerfile:\s+deploy\/docker\/Dockerfile/,
    'source-tree docker compose must reference deploy/docker/Dockerfile before packaging rewrites the bundle layout',
  );
  assert.match(dockerCompose, /profiles\/default\.env/);
  assert.match(dockerCompose, /18797:18797/);
  assert.match(dockerCompose, /\/var\/lib\/claw-server/);
  assert.match(
    dockerCompose,
    /CLAW_SERVER_MANAGE_USERNAME:\s+\$\{CLAW_SERVER_MANAGE_USERNAME:\?/,
    'docker compose must require an explicit manage username for public deployments',
  );
  assert.match(
    dockerCompose,
    /CLAW_SERVER_MANAGE_PASSWORD:\s+\$\{CLAW_SERVER_MANAGE_PASSWORD:\?/,
    'docker compose must require an explicit manage password for public deployments',
  );
  assert.match(nvidiaCompose, /profiles\/nvidia-cuda\.env/);
  assert.match(amdCompose, /profiles\/amd-rocm\.env/);
  assert.match(defaultEnv, /CLAW_ACCELERATOR_PROFILE=cpu/);
  assert.match(defaultEnv, /CLAW_DEPLOYMENT_FAMILY=container/);
  assert.match(defaultEnv, /CLAW_SERVER_DATA_DIR=\/var\/lib\/claw-server/);
  assert.match(defaultEnv, /CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false/);
  assert.match(nvidiaEnv, /CLAW_ACCELERATOR_PROFILE=nvidia-cuda/);
  assert.match(nvidiaEnv, /CLAW_DEPLOYMENT_FAMILY=container/);
  assert.match(amdEnv, /CLAW_ACCELERATOR_PROFILE=amd-rocm/);
  assert.match(amdEnv, /CLAW_DEPLOYMENT_FAMILY=container/);
  assert.match(
    releaseDoc,
    /source (?:tree|repository)[\s\S]*deploy\/docker\/docker-compose\.yml/i,
    'release docs must distinguish source-tree docker template paths from packaged bundle paths',
  );
  assert.match(
    releaseDoc,
    /extracted bundle root[\s\S]*deploy\/docker\/docker-compose\.yml/i,
    'release docs must describe the packaged bundle command surface explicitly',
  );
  assert.match(releaseDoc, /docker compose -f deploy\/docker\/docker-compose\.yml up -d/);
  assert.match(
    dockerReadme,
    /CLAW_SERVER_MANAGE_USERNAME/i,
    'docker deployment docs must explain the required control-plane credentials',
  );
});

test('kubernetes deployment templates keep accelerator overlays and chart wiring aligned', () => {
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const chart = read('deploy/kubernetes/Chart.yaml');
  const values = read('deploy/kubernetes/values.yaml');
  const cpuValues = read('deploy/kubernetes/values-cpu.yaml');
  const nvidiaValues = read('deploy/kubernetes/values-nvidia-cuda.yaml');
  const amdValues = read('deploy/kubernetes/values-amd-rocm.yaml');
  const configmap = read('deploy/kubernetes/templates/configmap.yaml');
  const deployment = read('deploy/kubernetes/templates/deployment.yaml');
  const secret = read('deploy/kubernetes/templates/secret.yaml');
  const pvc = read('deploy/kubernetes/templates/persistentvolumeclaim.yaml');
  const releaseDoc = read('docs/core/release-and-deployment.md');

  assert.match(
    kubernetesReadme,
    /helm upgrade --install claw-studio \.\/chart[\s\S]*-f values\.release\.yaml/,
  );
  assert.match(kubernetesReadme, /values-nvidia-cuda\.yaml/);
  assert.match(kubernetesReadme, /values-amd-rocm\.yaml/);
  assert.match(
    kubernetesReadme,
    /image tag/i,
    'kubernetes deployment docs must explain the versioned image tag contract',
  );
  assert.match(chart, /name:\s+claw-studio/);
  assert.match(values, /targetArchitecture:\s+x64/);
  assert.match(values, /repository:\s+claw-studio-server/);
  assert.match(values, /auth:\s*[\s\S]*existingSecret:/);
  assert.match(values, /persistence:\s*[\s\S]*enabled:\s+true/);
  assert.match(values, /persistence:\s*[\s\S]*mountPath:\s+\/var\/lib\/claw-server/);
  assert.doesNotMatch(
    values,
    /tag:\s+latest/,
    'kubernetes chart defaults must not rely on the mutable latest image tag',
  );
  assert.match(cpuValues, /acceleratorProfile:\s+cpu/);
  assert.match(nvidiaValues, /acceleratorProfile:\s+nvidia-cuda/);
  assert.match(amdValues, /acceleratorProfile:\s+amd-rocm/);
  assert.match(configmap, /CLAW_ACCELERATOR_PROFILE/);
  assert.match(configmap, /CLAW_DEPLOYMENT_FAMILY:\s+"kubernetes"/);
  assert.match(configmap, /CLAW_SERVER_DATA_DIR/);
  assert.match(deployment, /secretRef:/);
  assert.match(deployment, /volumeMounts:/);
  assert.match(deployment, /mountPath:\s+\{\{\s*\.Values\.persistence\.mountPath\s*\}\}/);
  assert.match(deployment, /persistentVolumeClaim:/);
  assert.match(
    deployment,
    /readinessProbe:\s*\n\s*httpGet:\s*\n\s*path:\s+\/claw\/health\/ready/,
    'kubernetes readiness probe must target the runtime-aware /claw/health/ready endpoint',
  );
  assert.doesNotMatch(
    deployment,
    /readinessProbe:\s*\n\s*httpGet:\s*\n\s*path:\s+\/claw\/health\/live/,
    'kubernetes readiness probe must not use the always-OK liveness endpoint',
  );
  assert.match(
    deployment,
    /\{\{- if gt \(int \.Values\.replicaCount\) 1 \}\}[\s\S]*\{\{- fail "claw-studio currently supports only replicaCount=1 because the shared host runtime does not coordinate multi-replica state yet." \}\}/,
    'kubernetes deployment template must reject unsupported multi-replica shared-runtime installs',
  );
  assert.match(secret, /kind:\s+Secret/);
  assert.match(secret, /CLAW_SERVER_MANAGE_USERNAME/);
  assert.match(secret, /CLAW_SERVER_MANAGE_PASSWORD/);
  assert.match(secret, /CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND/);
  assert.match(pvc, /kind:\s+PersistentVolumeClaim/);
  assert.match(deployment, /kubernetes\.io\/arch:\s+arm64/);
  assert.match(deployment, /kubernetes\.io\/arch:\s+amd64/);
  assert.match(
    deployment,
    /image:\s+\{\{[^}]*\.Values\.image\.repository[^}]*\}\}@\{\{[^}]*\.Values\.image\.digest[^}]*\}\}/,
    'kubernetes deployment template must support digest-pinned images',
  );
  assert.match(
    deployment,
    /image:\s+\{\{[^}]*\.Values\.image\.repository[^}]*\}\}:\{\{[^}]*\.Values\.image\.tag[^}]*\}\}/,
    'kubernetes deployment template must retain explicit tag-based fallback',
  );
  assert.match(releaseDoc, /helm upgrade --install claw-studio \.\/chart -f values\.release\.yaml/);
  assert.match(
    releaseDoc,
    /release tag/i,
    'release docs must describe the immutable image tag contract for kubernetes bundles',
  );
  assert.match(
    kubernetesReadme,
    /Secret/i,
    'kubernetes deployment docs must explain the required control-plane secret',
  );
});

test('docker image, kubernetes chart, and server readiness routes share the same truthful readiness contract', () => {
  const dockerfile = read('deploy/docker/Dockerfile');
  const deployment = read('deploy/kubernetes/templates/deployment.yaml');
  const healthRoute = read('packages/sdkwork-claw-server/src-host/src/http/routes/health.rs');

  assert.match(
    dockerfile,
    /apt-get[\s\S]*install[\s\S]*curl/i,
    'docker image must install curl or an equivalent HTTP client for image-native readiness checks',
  );
  assert.match(
    dockerfile,
    /chmod \+x \/opt\/claw\/app\/bin\/claw-server/,
    'docker image must chmod the packaged claw-server binary rather than a stale legacy binary path',
  );
  assert.match(
    dockerfile,
    /CMD\s+\["\/opt\/claw\/app\/bin\/claw-server"\]/,
    'docker image must launch the canonical packaged claw-server binary directly',
  );
  assert.doesNotMatch(
    dockerfile,
    /CMD\s+\["\/bin\/sh",\s*"\/opt\/claw\/app\/start-claw-server\.sh"\]/,
    'docker image must not route container startup through the optional wrapper script',
  );
  assert.match(
    dockerfile,
    /HEALTHCHECK[\s\S]*curl[\s\S]*\/claw\/health\/ready/i,
    'docker image must expose a container-native health contract against /claw/health/ready',
  );
  assert.match(
    deployment,
    /readinessProbe:\s*\n\s*httpGet:\s*\n\s*path:\s+\/claw\/health\/ready/,
    'kubernetes chart must keep probing the runtime-aware /claw/health/ready endpoint',
  );
  assert.match(
    healthRoute,
    /runtime_ready && gateway_ready/,
    'server readiness route must depend on both runtime and gateway readiness',
  );
  assert.match(
    healthRoute,
    /StatusCode::SERVICE_UNAVAILABLE/,
    'server readiness route must fail when the runtime projection is unavailable',
  );
});

test('deployment bootstrap smoke report preserves runtime-backed docker and singleton-k8s evidence contracts', () => {
  const smokeReportPath = path.join(
    rootDir,
    'docs',
    'reports',
    '2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md',
  );

  assert.equal(
    existsSync(smokeReportPath),
    true,
    'missing docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md',
  );

  const smokeReport = read('docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md');

  assert.match(
    smokeReport,
    /Automated Verification/,
    'deployment bootstrap smoke report must retain automated verification evidence',
  );
  assert.match(
    smokeReport,
    /Packaged container image startup/i,
    'deployment bootstrap smoke report must document packaged container image startup smoke',
  );
  assert.match(
    smokeReport,
    /docker build -f deploy\/docker\/Dockerfile -t/,
    'deployment bootstrap smoke report must include the packaged container image build command',
  );
  assert.match(
    smokeReport,
    /docker run --rm -d[\s\S]*18797:18797/,
    'deployment bootstrap smoke report must include the packaged container runtime launch command',
  );
  assert.match(
    smokeReport,
    /docker compose -f deploy\/docker\/docker-compose\.yml up -d/,
    'deployment bootstrap smoke report must include docker compose startup smoke',
  );
  assert.match(
    smokeReport,
    /singleton-k8s readiness/i,
    'deployment bootstrap smoke report must include singleton-k8s readiness smoke',
  );
  assert.match(
    smokeReport,
    /helm upgrade --install claw-studio \.\/chart -f values\.release\.yaml/,
    'deployment bootstrap smoke report must include the singleton-k8s install command',
  );
  assert.match(
    smokeReport,
    /kubectl wait --for=condition=ready/i,
    'deployment bootstrap smoke report must include the singleton-k8s readiness wait command',
  );
  assert.match(
    smokeReport,
    /\/claw\/health\/ready/,
    'deployment bootstrap smoke report must verify the runtime-aware readiness endpoint',
  );
  assert.match(
    smokeReport,
    /\/claw\/manage\/v1\/host-endpoints/,
    'deployment bootstrap smoke report must verify shared-host endpoint projection truth',
  );
  assert.match(
    smokeReport,
    /not executed in this sandbox|pending manual execution/i,
    'deployment bootstrap smoke report must distinguish sandbox verification from pending live runtime execution',
  );
});
