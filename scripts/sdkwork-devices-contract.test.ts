import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
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

runTest('sdkwork-clawstudio-devices is implemented locally with an OpenClaw pairing workspace service', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-clawstudio-devices/package.json');
  const indexSource = read('packages/sdkwork-clawstudio-devices/src/index.ts');
  const serviceSource = read('packages/sdkwork-clawstudio-devices/src/services/deviceService.ts');

  assert.ok(exists('packages/sdkwork-clawstudio-devices/src/Devices.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-devices/src/services/deviceService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/clawstudio-studio-devices']);
  assert.equal(pkg.dependencies?.['@sdkwork/clawstudio-types'], 'workspace:*');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-devices/);

  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.match(serviceSource, /openClawGatewayClient/);
  assert.match(serviceSource, /studio/);
  assert.match(serviceSource, /getWorkspaceSnapshot/);
  assert.match(serviceSource, /listDevicePairings/);
  assert.match(serviceSource, /approveDevicePairing/);
  assert.match(serviceSource, /rejectDevicePairing/);
  assert.match(serviceSource, /removeDevicePairing/);
  assert.match(serviceSource, /rotateDeviceToken/);
  assert.match(serviceSource, /revokeDeviceToken/);
  assert.match(serviceSource, /createDeviceService/);
  assert.doesNotMatch(serviceSource, /createDevice\(name\)/);
  assert.doesNotMatch(serviceSource, /listDeviceInstalledSkills/);
  assert.doesNotMatch(serviceSource, /uninstallSkill/);
  assert.doesNotMatch(serviceSource, /fetch\('/);
});

runTest('sdkwork-clawstudio-devices renders truthful pairing and token controls instead of mock hardware telemetry', () => {
  const pageSource = read('packages/sdkwork-clawstudio-devices/src/pages/devices/Devices.tsx');

  assert.match(pageSource, /getWorkspaceSnapshot/);
  assert.match(pageSource, /approvePairing/);
  assert.match(pageSource, /rejectPairing/);
  assert.match(pageSource, /removeDevice/);
  assert.match(pageSource, /rotateToken/);
  assert.match(pageSource, /revokeToken/);
  assert.match(pageSource, /pairingGuide/);
  assert.match(pageSource, /pendingRequests/);
  assert.match(pageSource, /pairedDevices/);
  assert.match(pageSource, /tokenList/);
  assert.doesNotMatch(pageSource, /registerDevice\(/);
  assert.doesNotMatch(pageSource, /getDeviceSkills\(/);
  assert.doesNotMatch(pageSource, /hardwareSpecs/);
  assert.doesNotMatch(pageSource, /battery/);
  assert.doesNotMatch(pageSource, /installedSkills/);
});

runTest('sdkwork-clawstudio-types does not export a generic hardware Device DTO', () => {
  const typesSource = read('packages/sdkwork-clawstudio-types/src/index.ts');

  assert.doesNotMatch(typesSource, /export interface Device\b/);
  assert.doesNotMatch(typesSource, /\bbattery\b/);
  assert.doesNotMatch(typesSource, /\bip_address\b/);
  assert.doesNotMatch(typesSource, /\bhardwareSpecs\b/);
});

runTest('sdkwork-clawstudio-devices is explicitly scoped to local runtime device pairing', () => {
  const spec = readJson<{ component?: { domain?: string; capability?: string } }>(
    'packages/sdkwork-clawstudio-devices/specs/component.spec.json',
  );
  const serviceSource = read('packages/sdkwork-clawstudio-devices/src/services/deviceService.ts');

  assert.equal(spec.component?.domain, 'device');
  assert.equal(spec.component?.capability, 'runtime-device-pairing');
  assert.match(serviceSource, /openClawGatewayClient/);
  assert.doesNotMatch(serviceSource, /@sdkwork\/aiot-app-sdk/);
});
