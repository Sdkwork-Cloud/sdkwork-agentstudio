import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  ensureTauriDevBinaryUnlocked,
  isMissingWindowsServiceQueryError,
  resolveTauriDevBinaryPath,
  WINDOWS_TAURI_DEV_SESSION_MARKERS,
} from './ensure-tauri-dev-binary-unlocked.mjs';

const modulePath = path.resolve(import.meta.dirname, 'ensure-tauri-dev-binary-unlocked.mjs');

assert.match(
  readFileSync(modulePath, 'utf8'),
  /if \(invokedScriptPath && invokedScriptPath === currentModulePath\) \{\s*try \{\s*runCli\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  'ensure-tauri-dev-binary-unlocked must wrap the CLI entrypoint with a top-level error handler',
);

function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function removeDirectoryWithRetries(tempDir, retryCount = 5, retryDelayMs = 100) {
  let lastError = null;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const errorCode = error && typeof error === 'object' ? error.code : undefined;
      const canRetry =
        attempt < retryCount &&
        (errorCode === 'EBUSY' || errorCode === 'EPERM' || errorCode === 'ENOTEMPTY');

      if (!canRetry) {
        throw error;
      }

      sleepSync(retryDelayMs * attempt);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

function withTempDir(callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tauri-dev-binary-unlocked-'));

  try {
    callback(tempDir);
  } finally {
    removeDirectoryWithRetries(tempDir);
  }
}

async function withTempDirAsync(callback) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'tauri-dev-binary-unlocked-'));

  try {
    await callback(tempDir);
  } finally {
    removeDirectoryWithRetries(tempDir);
  }
}

async function waitFor(condition, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for condition`);
}

function inspectNoTargetProcesses() {
  return [];
}

if (process.platform !== 'win32') {
  console.log('ok - tauri dev binary unlock guard is only required on Windows');
  process.exit(0);
}

assert.equal(
  WINDOWS_TAURI_DEV_SESSION_MARKERS.includes('tauri.js'),
  true,
  'dev-session marker list should include tauri.js so stale Tauri CLI roots get terminated with their cargo descendants',
);

assert.equal(
  isMissingWindowsServiceQueryError('[SC] OpenService FAILED 1060: The specified service does not exist as an installed service.'),
  true,
  'missing Windows service detection should recognize English sc.exe 1060 output',
);
assert.equal(
  isMissingWindowsServiceQueryError('[SC] EnumQueryServicesStatus:OpenService localized-error 1060: localized service missing.'),
  true,
  'missing Windows service detection should recognize localized sc.exe 1060 output',
);
assert.equal(
  isMissingWindowsServiceQueryError('[SC] ControlService FAILED 1052: control not valid'),
  false,
  'missing Windows service detection should not classify other service-control errors as missing services',
);

await (async () => {
  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [];
        },
        inspectProcessesByName() {
          return [];
        },
        inspectDevSessionProcesses() {
          return [];
        },
        inspectTargetProcesses: inspectNoTargetProcesses,
        stopProcess() {
          throw new Error('stopProcess should not be called when no process is running');
        },
      },
    );

    assert.equal(result.terminatedProcesses.length, 0, 'missing running process should not trigger termination');
    assert.equal(existsSync(executablePath), true, 'test executable should remain present');
  });

  await withTempDirAsync(async (tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const child = spawn(executablePath, ['-e', 'setInterval(() => {}, 1000);'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    const cleanup = () => {
      try {
        process.kill(child.pid);
      } catch {}
    };

    try {
      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return true;
        } catch {
          return false;
        }
      });

      const result = ensureTauriDevBinaryUnlocked(
        srcTauriDir,
        binaryName,
        process.platform,
        {
          inspectProcessesForBinary(requestedExecutablePath) {
            assert.equal(
              requestedExecutablePath,
              executablePath,
              'exact-path inspector should receive the resolved dev binary path',
            );
            return [{ Id: child.pid, ProcessName: binaryName, Path: executablePath }];
          },
          inspectProcessesByName() {
            throw new Error('fallback inspector should not be needed when exact-path inspection succeeds');
          },
          inspectDevSessionProcesses() {
            return [];
          },
          inspectTargetProcesses: inspectNoTargetProcesses,
          stopManagedKernelService() {},
          stopProcess(pid) {
            process.kill(pid);
          },
        },
      );
      assert.equal(result.terminatedProcesses.length, 1, 'running debug binary should be terminated');

      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return false;
        } catch {
          return true;
        }
      });
    } finally {
      cleanup();
    }
  });

  await withTempDirAsync(async (tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const child = spawn(executablePath, ['-e', 'setInterval(() => {}, 1000);'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    const cleanup = () => {
      try {
        process.kill(child.pid);
      } catch {}
    };

    try {
      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return true;
        } catch {
          return false;
        }
      });

      let fallbackInspectorUsed = false;
      const result = ensureTauriDevBinaryUnlocked(
        srcTauriDir,
        binaryName,
        process.platform,
        {
          inspectProcessesForBinary() {
            return [];
          },
          inspectProcessesByName(requestedBinaryName) {
            fallbackInspectorUsed = true;
            assert.equal(
              requestedBinaryName,
              binaryName,
              'fallback inspector should receive the requested dev binary name',
            );
            return [{ Id: child.pid, ProcessName: binaryName, Path: null }];
          },
          inspectDevSessionProcesses() {
            return [];
          },
          inspectTargetProcesses: inspectNoTargetProcesses,
          stopManagedKernelService() {},
          stopProcess(pid) {
            process.kill(pid);
          },
        },
      );

      assert.equal(
        fallbackInspectorUsed,
        true,
        'guard should fall back to image-name inspection when exact-path inspection finds no process',
      );
      assert.equal(
        result.terminatedProcesses.length,
        1,
        'fallback image-name inspection should still terminate the locked debug executable',
      );

      await waitFor(() => {
        try {
          process.kill(child.pid, 0);
          return false;
        } catch {
          return true;
        }
      });
    } finally {
      cleanup();
    }
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    let waitedForUnlock = false;
    const callOrder = [];
    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [{ Id: 1234, ProcessName: binaryName, Path: executablePath }];
        },
        inspectProcessesByName() {
          throw new Error('fallback inspector should not run when exact-path inspection succeeds');
        },
        inspectDevSessionProcesses() {
          return [];
        },
        inspectTargetProcesses: inspectNoTargetProcesses,
        stopManagedKernelService() {
          callOrder.push('service');
        },
        stopProcess(pid) {
          assert.equal(pid, 1234, 'unlock wait path should stop the detected process first');
          callOrder.push('process');
        },
        waitForExecutableUnlock(requestedExecutablePath) {
          waitedForUnlock = true;
          callOrder.push('wait');
          assert.equal(
            requestedExecutablePath,
            executablePath,
            'unlock wait path should receive the resolved dev binary path',
          );
        },
      },
    );

    assert.equal(
      result.terminatedProcesses.length,
      1,
      'unlock wait path should still report the terminated matching process',
    );
    assert.equal(
      waitedForUnlock,
      true,
      'guard should wait for the debug executable to unlock after terminating a matching process',
    );
    assert.deepEqual(
      callOrder,
      ['service', 'process', 'wait'],
      'guard should stop the managed kernel service before killing the process and waiting for unlock',
    );
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const stoppedPids = [];
    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [];
        },
        inspectProcessesByName() {
          return [];
        },
        inspectDevSessionProcesses(requestedPackageDir) {
          assert.equal(
            requestedPackageDir,
            path.dirname(path.resolve(srcTauriDir)),
            'dev-session inspector should receive the package root that owns src-tauri',
          );
          return [
            {
              Id: 4321,
              ProcessName: 'node',
              Path: null,
              CommandLine: 'node ../../scripts/run-tauri-cli.mjs dev',
            },
            ];
        },
        inspectTargetProcesses: inspectNoTargetProcesses,
        stopManagedKernelService() {},
        stopProcess(pid) {
          stoppedPids.push(pid);
        },
        waitForExecutableUnlock(requestedExecutablePath) {
          assert.equal(
            requestedExecutablePath,
            executablePath,
            'unlock wait should still use the debug executable when stale dev-session processes are terminated',
          );
        },
      },
    );

    assert.deepEqual(
      stoppedPids,
      [4321],
      'guard should terminate stale tauri dev session processes even when no debug binary match is returned',
    );
    assert.equal(
      result.terminatedProcesses.length,
      1,
      'guard should report stale dev session processes as terminated work',
    );
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const callOrder = [];
    let serviceStopAttempts = 0;
    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [{ Id: 1234, ProcessName: binaryName, Path: executablePath }];
        },
        inspectProcessesByName() {
          return [];
        },
        inspectDevSessionProcesses() {
          return [];
        },
        inspectTargetProcesses: inspectNoTargetProcesses,
        stopManagedKernelService() {
          serviceStopAttempts += 1;
          callOrder.push(`service-${serviceStopAttempts}`);
          if (serviceStopAttempts === 1) {
            throw new Error('Failed to stop Windows service agentstudioOpenClawKernel: [SC] ControlService failed 1052: control not valid');
          }
          return {
            serviceName: 'agentstudioOpenClawKernel',
            state: 'STOPPED',
            stopped: true,
          };
        },
        stopProcess(pid) {
          assert.equal(pid, 1234, 'recoverable service stop path should still terminate the locked process');
          callOrder.push('process');
        },
        waitForExecutableUnlock(requestedExecutablePath) {
          callOrder.push('wait');
          assert.equal(
            requestedExecutablePath,
            executablePath,
            'recoverable service stop path should still wait for the debug executable to unlock',
          );
        },
      },
    );

    assert.equal(
      result.terminatedProcesses.length,
      1,
      'recoverable service control errors should not block process termination',
    );
    assert.equal(
      result.kernelServiceStopError,
      null,
      'guard should clear recoverable service stop errors after a successful retry',
    );
    assert.equal(
      serviceStopAttempts,
      2,
      'guard should retry stopping the managed kernel service after unlocking the executable',
    );
    assert.deepEqual(
      callOrder,
      ['service-1', 'process', 'wait', 'service-2'],
      'recoverable service stop errors should defer the second service stop attempt until after unlock work',
    );
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const stopCalls = [];
    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [{ Id: 1234, ProcessName: binaryName, Path: executablePath }];
        },
        inspectProcessesByName() {
          return [];
        },
        inspectDevSessionProcesses() {
          return [{ Id: 5678, ProcessName: 'node', Path: null, CommandLine: 'node ../../scripts/run-tauri-cli.mjs dev' }];
        },
        inspectTargetProcesses: inspectNoTargetProcesses,
        stopManagedKernelService() {},
        stopProcess(pid) {
          stopCalls.push(pid);
          if (pid === 5678) {
            throw new Error('process not found');
          }
        },
        waitForExecutableUnlock() {},
      },
    );

    assert.deepEqual(
      stopCalls,
      [1234, 5678],
      'guard should still attempt to stop all matched stale tauri dev session processes',
    );
    assert.equal(
      result.terminatedProcesses.length,
      2,
      'guard should tolerate already-exited child processes that disappear while the dev session tree is being torn down',
    );
  });

  withTempDir((tempDir) => {
    const srcTauriDir = path.join(tempDir, 'src-tauri');
    const binaryName = 'tauri-dev-lock-test';
    const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName);
    const targetDir = path.join(srcTauriDir, 'target');

    mkdirSync(path.dirname(executablePath), { recursive: true });
    copyFileSync(process.execPath, executablePath);

    const stopCalls = [];
    const result = ensureTauriDevBinaryUnlocked(
      srcTauriDir,
      binaryName,
      process.platform,
      {
        inspectProcessesForBinary() {
          return [];
        },
        inspectProcessesByName() {
          return [];
        },
        inspectDevSessionProcesses() {
          return [];
        },
        inspectTargetProcesses(requestedTargetDir) {
          assert.equal(
            requestedTargetDir,
            path.resolve(targetDir),
            'target-process inspector should receive the resolved src-tauri target directory',
          );
          return [
            {
              Id: 8765,
              ProcessName: 'build-script-build',
              Path: path.join(
                targetDir,
                'debug',
                'build',
                'sdkwork-agentstudio-pc-desktop-test',
                'build-script-build.exe',
              ),
            },
          ];
        },
        stopManagedKernelService() {},
        stopProcess(pid) {
          stopCalls.push(pid);
        },
        waitForExecutableUnlock(requestedExecutablePath) {
          assert.equal(
            requestedExecutablePath,
            executablePath,
            'target-process cleanup should still wait on the resolved desktop binary path',
          );
        },
      },
    );

    assert.deepEqual(
      stopCalls,
      [8765],
      'guard should terminate orphaned target-directory processes that keep the src-tauri target locked',
    );
    assert.equal(
      result.terminatedProcesses.length,
      1,
      'guard should report target-directory cleanup work even when no matching binary or dev-session process is found',
    );
  });
})();

console.log('ok - tauri dev binary unlock guard terminates only the matching debug executable');
