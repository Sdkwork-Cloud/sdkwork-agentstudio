import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  applyOpenClawRuntimeAgentPathMaterializationPatch,
} from './prepare-openclaw-runtime.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'openclaw-agent-path-patch-test-'));

const originalServerImpl = `function loadSchemaWithPlugins() {
\treturn loadGatewayRuntimeConfigSchema();
}
const configHandlers = {
\t"config.set": async ({ params, respond, context }) => {
\t\tconst { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
\t\tconst parsed = parseValidateConfigFromRawOrRespond(params, "config.set", snapshot, respond);
\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tawait writeConfigFile(parsed.config, writeOptions);
\t\trespond(true, {
\t\t\tok: true,
\t\t\tpath: createConfigIO().configPath,
\t\t\tconfig: redactConfigObject(parsed.config, parsed.schema.uiHints)
\t\t}, void 0);
\t\tqueueSharedGatewayAuthGenerationRefresh(true, parsed.config, context);
\t},
\t"config.patch": async ({ params, respond, client, context }) => {
\t\tconst { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
\t\tconst validated = validateConfigObjectWithPlugins({});
\t\tif (!validated.ok) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: validated.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, validated.config);
\t\tconst actor = resolveControlPlaneActor(client);
\t\tif (changedPaths.length === 0) {
\t\t\trespond(true, {
\t\t\t\tok: true,
\t\t\t\tnoop: true,
\t\t\t\tpath: createConfigIO().configPath,
\t\t\t\tconfig: redactConfigObject(validated.config, schemaPatch.uiHints)
\t\t\t}, void 0);
\t\t\treturn;
\t\t}
\t\tconst disconnectSharedAuthClients = didSharedGatewayAuthChange(snapshot.config, validated.config);
\t\tawait writeConfigFile(validated.config, writeOptions);
\t\tconst restart = shouldScheduleDirectConfigRestart({
\t\t\tchangedPaths,
\t\t\tnextConfig: validated.config
\t\t}) ? scheduleGatewaySigusr1Restart({}) : void 0;
\t\trespond(true, {
\t\t\tok: true,
\t\t\tpath: createConfigIO().configPath,
\t\t\tconfig: redactConfigObject(validated.config, schemaPatch.uiHints),
\t\t\trestart
\t\t}, void 0);
\t\tqueueSharedGatewayAuthGenerationRefresh(true, validated.config, context);
\t\tqueueSharedGatewayAuthDisconnect(disconnectSharedAuthClients, context);
\t},
\t"config.apply": async ({ params, respond, client, context }) => {
\t\tconst { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
\t\tconst parsed = parseValidateConfigFromRawOrRespond(params, "config.apply", snapshot, respond);
\t\tif (!parsed) return;
\t\tif (!await ensureResolvableSecretRefsOrRespond({
\t\t\tconfig: parsed.config,
\t\t\trespond
\t\t})) return;
\t\tconst changedPaths = diffConfigPaths(snapshot.config, parsed.config);
\t\tconst actor = resolveControlPlaneActor(client);
\t\tconst disconnectSharedAuthClients = didSharedGatewayAuthChange(snapshot.config, parsed.config);
\t\tawait writeConfigFile(parsed.config, writeOptions);
\t\tconst restart = shouldScheduleDirectConfigRestart({
\t\t\tchangedPaths,
\t\t\tnextConfig: parsed.config
\t\t}) ? scheduleGatewaySigusr1Restart({}) : void 0;
\t\trespond(true, {
\t\t\tok: true,
\t\t\tpath: createConfigIO().configPath,
\t\t\tconfig: redactConfigObject(parsed.config, parsed.schema.uiHints),
\t\t\trestart
\t\t}, void 0);
\t\tqueueSharedGatewayAuthGenerationRefresh(true, parsed.config, context);
\t\tqueueSharedGatewayAuthDisconnect(disconnectSharedAuthClients, context);
\t}
};
`;

try {
  const packageRoot = path.join(tempRoot, 'runtime', 'package', 'node_modules', 'openclaw');
  const distDir = path.join(packageRoot, 'dist');
  const serverImplPath = path.join(distDir, 'server.impl-test.js');
  await mkdir(distDir, { recursive: true });
  await writeFile(serverImplPath, originalServerImpl, 'utf8');

  const patched = await applyOpenClawRuntimeAgentPathMaterializationPatch({
    runtimeDir: path.join(tempRoot, 'runtime'),
  });
  assert.equal(patched.status, 'patched');

  const source = await readFile(serverImplPath, 'utf8');
  assert.match(source, /function materializeConfigAgentPaths\(/);
  assert.match(source, /function chooseAgentDirPathForConfigWrite\(/);
  assert.match(source, /hasCanonicalAgentDirShape/);
  assert.match(source, /const prepared = materializeConfigAgentPaths\(parsed\.config, snapshot\.config\);/);
  assert.match(source, /await ensureConfigAgentDirectories\(prepared\);/);
  assert.match(source, /const changedPaths = diffConfigPaths\(snapshot\.config, prepared\.config\);/);
  assert.match(source, /nextConfig: prepared\.config/);
  assert.match(source, /writeConfigFile\(prepared\.config, writeOptions\)/);

  const secondPatch = await applyOpenClawRuntimeAgentPathMaterializationPatch({
    runtimeDir: path.join(tempRoot, 'runtime'),
  });
  assert.equal(secondPatch.status, 'already-patched');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
