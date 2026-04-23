import { closeSync, existsSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WINDOWS_KERNEL_HOST_SERVICE_NAME = 'ClawStudioOpenClawKernel';
const WINDOWS_SERVICE_POLL_INTERVAL_MS = 250;
const WINDOWS_SERVICE_STOP_TIMEOUT_MS = 15_000;
export const WINDOWS_TAURI_DEV_SESSION_MARKERS = [
  'run-tauri-cli.mjs',
  'run-vite-host.mjs',
  'tauri.js',
];

function escapePowerShellSingleQuoted(value) {
  return value.replace(/'/g, "''");
}

function parseProcessListJson(stdout) {
  const normalizedStdout = stdout.trim();
  if (normalizedStdout.length === 0) {
    return [];
  }

  const parsed = JSON.parse(normalizedStdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function runWindowsProcessQuery(command, description) {
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to inspect ${description}: ${result.stderr || result.stdout || 'unknown powershell failure'}`.trim(),
    );
  }

  return parseProcessListJson(result.stdout);
}

export function resolveTauriDevBinaryPath(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
) {
  return path.resolve(
    srcTauriDir,
    'target',
    'debug',
    platform === 'win32' ? `${binaryName}.exe` : binaryName,
  );
}

function listWindowsProcessesForBinary(executablePath) {
  const normalizedExecutablePath = path.resolve(executablePath);
  const escapedExecutablePath = escapePowerShellSingleQuoted(normalizedExecutablePath);
  const processName = escapePowerShellSingleQuoted(path.parse(normalizedExecutablePath).name);
  const command = [
    `$target = '${escapedExecutablePath}'`,
    `$items = Get-Process -Name '${processName}' -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ([System.IO.Path]::GetFullPath($_.Path) -ieq $target) } | Select-Object Id,ProcessName,Path`,
    `if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }`,
  ].join('; ');
  return runWindowsProcessQuery(
    command,
    `Tauri dev binary locks for ${normalizedExecutablePath}`,
  );
}

function listWindowsProcessesByName(binaryName) {
  const normalizedBinaryName = path.parse(binaryName).name;
  const escapedProcessName = escapePowerShellSingleQuoted(normalizedBinaryName);
  const command = [
    `$items = Get-Process -Name '${escapedProcessName}' -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path`,
    `if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }`,
  ].join('; ');

  return runWindowsProcessQuery(command, `Tauri dev processes named ${normalizedBinaryName}`);
}

function listWindowsTauriDevSessionProcesses(packageDir) {
  const normalizedPackageDir = path.resolve(packageDir);
  const escapedPackageDir = escapePowerShellSingleQuoted(normalizedPackageDir);
  const markerChecks = WINDOWS_TAURI_DEV_SESSION_MARKERS
    .map((marker) => {
      const escapedMarker = escapePowerShellSingleQuoted(marker);
      return `($_.CommandLine.IndexOf('${escapedMarker}', [System.StringComparison]::OrdinalIgnoreCase) -ge 0)`;
    })
    .join(' -or ');

  const command = [
    `$packageDir = '${escapedPackageDir}'`,
    `$items = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($packageDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and (${markerChecks}) } | Select-Object @{Name="Id";Expression={$_.ProcessId}}, @{Name="ProcessName";Expression={$_.Name}}, @{Name="Path";Expression={$_.ExecutablePath}}, ParentProcessId, CommandLine`,
    `if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }`,
  ].join('; ');

  return runWindowsProcessQuery(
    command,
    `Tauri dev session processes for ${normalizedPackageDir}`,
  );
}

function listWindowsProcessesForTargetDir(targetDir) {
  const normalizedTargetDir = path.resolve(targetDir);
  const escapedTargetDir = escapePowerShellSingleQuoted(normalizedTargetDir);
  const command = [
    `$targetDir = '${escapedTargetDir}'`,
    `$items = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -and ([System.IO.Path]::GetFullPath($_.ExecutablePath)).StartsWith($targetDir, [System.StringComparison]::OrdinalIgnoreCase) } | Select-Object @{Name="Id";Expression={$_.ProcessId}}, @{Name="ProcessName";Expression={$_.Name}}, @{Name="Path";Expression={$_.ExecutablePath}}, ParentProcessId, CommandLine`,
    `if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }`,
  ].join('; ');

  return runWindowsProcessQuery(
    command,
    `Tauri target processes for ${normalizedTargetDir}`,
  );
}

function stopWindowsProcess(pid) {
  const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    const errorOutput = `${result.stderr || ''}\n${result.stdout || ''}`.trim();
    if (isMissingWindowsProcessError(errorOutput) || !doesWindowsProcessExist(pid)) {
      return;
    }

    throw new Error(
      `Failed to stop locked Tauri dev process ${pid}: ${errorOutput}`.trim(),
    );
  }
}

function doesWindowsProcessExist(pid) {
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$process = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue; if ($null -eq $process) { 'false' } else { 'true' }`,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  return result.status === 0 && result.stdout.trim().toLowerCase() === 'true';
}

function readWindowsServiceState(serviceName) {
  const result = spawnSync('sc.exe', ['query', serviceName], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  if (result.status !== 0) {
    if (/FAILED\s+1060/i.test(output)) {
      return 'MISSING';
    }

    throw new Error(
      `Failed to query Windows service ${serviceName}: ${output.trim() || 'unknown service query failure'}`,
    );
  }

  const match = output.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/i);
  return match?.[1]?.toUpperCase() ?? 'UNKNOWN';
}

function sleepSync(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopWindowsKernelHostService(
  serviceName = WINDOWS_KERNEL_HOST_SERVICE_NAME,
  {
    pollIntervalMs = WINDOWS_SERVICE_POLL_INTERVAL_MS,
    timeoutMs = WINDOWS_SERVICE_STOP_TIMEOUT_MS,
    sleepImpl = sleepSync,
  } = {},
) {
  const currentState = readWindowsServiceState(serviceName);
  if (currentState === 'MISSING' || currentState === 'STOPPED') {
    return {
      serviceName,
      state: currentState,
      stopped: currentState === 'STOPPED',
    };
  }

  const stopResult = spawnSync('sc.exe', ['stop', serviceName], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const stopOutput = `${stopResult.stdout || ''}\n${stopResult.stderr || ''}`;
  if (stopResult.status !== 0 && !/FAILED\s+1062/i.test(stopOutput)) {
    throw new Error(
      `Failed to stop Windows service ${serviceName}: ${stopOutput.trim() || 'unknown service stop failure'}`,
    );
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const state = readWindowsServiceState(serviceName);
    if (state === 'MISSING' || state === 'STOPPED') {
      return {
        serviceName,
        state,
        stopped: true,
      };
    }

    sleepImpl(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Windows service ${serviceName} to stop.`);
}

function isWindowsLockError(error) {
  const errorCode = error && typeof error === 'object' ? error.code : undefined;
  return errorCode === 'EBUSY' || errorCode === 'EPERM' || errorCode === 'EACCES';
}

function isMissingWindowsProcessError(message) {
  const normalizedMessage = String(message || '').toLowerCase();
  return (
    normalizedMessage.includes('not found') ||
    normalizedMessage.includes('no running instance') ||
    normalizedMessage.includes('没有找到进程')
  );
}

function isRecoverableWindowsServiceControlError(message) {
  return /\b(1052|1061)\b/.test(String(message || ''));
}

function isExecutableUnlocked(executablePath) {
  if (!existsSync(executablePath)) {
    return true;
  }

  let fileDescriptor;
  try {
    fileDescriptor = openSync(executablePath, 'r+');
    return true;
  } catch (error) {
    if (isWindowsLockError(error)) {
      return false;
    }
    throw error;
  } finally {
    if (typeof fileDescriptor === 'number') {
      closeSync(fileDescriptor);
    }
  }
}

function dedupeProcessesById(processes) {
  const seen = new Set();

  return processes.filter((processInfo) => {
    const id = processInfo?.Id;
    if (typeof id !== 'number' || !Number.isFinite(id) || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

export function waitForExecutableUnlockSync(
  executablePath,
  {
    retryCount = 40,
    retryDelayMs = 100,
    isUnlocked = isExecutableUnlocked,
    sleepImpl = sleepSync,
  } = {},
) {
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    if (isUnlocked(executablePath)) {
      return {
        executablePath,
        unlocked: true,
        attempts: attempt,
      };
    }

    if (attempt < retryCount) {
      sleepImpl(retryDelayMs * attempt);
    }
  }

  throw new Error(`Timed out waiting for Tauri dev binary to unlock: ${executablePath}`);
}

export function ensureTauriDevBinaryUnlocked(
  srcTauriDir = 'src-tauri',
  binaryName = 'sdkwork-claw-desktop',
  platform = process.platform,
  {
    inspectProcessesForBinary = listWindowsProcessesForBinary,
    inspectProcessesByName = listWindowsProcessesByName,
    inspectDevSessionProcesses = listWindowsTauriDevSessionProcesses,
    inspectTargetProcesses = listWindowsProcessesForTargetDir,
    stopProcess = stopWindowsProcess,
    stopManagedKernelService = stopWindowsKernelHostService,
    waitForExecutableUnlock = waitForExecutableUnlockSync,
  } = {},
) {
  const executablePath = resolveTauriDevBinaryPath(srcTauriDir, binaryName, platform);
  const packageDir = path.resolve(srcTauriDir, '..');
  const targetDir = path.resolve(srcTauriDir, 'target');

  if (platform !== 'win32') {
    return {
      executablePath,
      runningProcesses: [],
      devSessionProcesses: [],
      terminatedProcesses: [],
      skipped: 'unsupported-platform',
    };
  }

  if (!existsSync(executablePath)) {
    return {
      executablePath,
      runningProcesses: [],
      devSessionProcesses: [],
      terminatedProcesses: [],
      skipped: 'binary-missing',
    };
  }

  let runningProcesses = [];
  let inspectionMode = 'exact-path';
  let exactPathInspectionError = null;

  try {
    runningProcesses = inspectProcessesForBinary(executablePath);
  } catch (error) {
    exactPathInspectionError = error;
  }

  if (runningProcesses.length === 0) {
    runningProcesses = inspectProcessesByName(binaryName);
    inspectionMode = 'image-name';
  }

  const devSessionProcesses = dedupeProcessesById(inspectDevSessionProcesses(packageDir));
  const targetProcesses = dedupeProcessesById(inspectTargetProcesses(targetDir));
  const processesToStop = dedupeProcessesById([
    ...runningProcesses,
    ...devSessionProcesses,
    ...targetProcesses,
  ]);
  const terminatedProcesses = [];
  let kernelServiceStopResult = null;
  let kernelServiceStopError = null;

  if (platform === 'win32' && processesToStop.length > 0) {
    try {
      kernelServiceStopResult = stopManagedKernelService();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isRecoverableWindowsServiceControlError(message)) {
        throw error;
      }
      kernelServiceStopError = message;
    }
  }

  for (const processInfo of processesToStop) {
    try {
      stopProcess(processInfo.Id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isMissingWindowsProcessError(message)) {
        throw error;
      }
    }
    terminatedProcesses.push(processInfo);
  }

  if (terminatedProcesses.length > 0) {
    waitForExecutableUnlock(executablePath);
  }

  if (platform === 'win32' && processesToStop.length > 0 && kernelServiceStopError) {
    try {
      kernelServiceStopResult = stopManagedKernelService();
      kernelServiceStopError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isRecoverableWindowsServiceControlError(message)) {
        throw error;
      }
      kernelServiceStopError = message;
    }
  }

  return {
    executablePath,
    runningProcesses,
    devSessionProcesses,
    targetProcesses,
    terminatedProcesses,
    inspectionMode,
    kernelServiceStopResult,
    kernelServiceStopError,
    exactPathInspectionError:
      exactPathInspectionError instanceof Error
        ? exactPathInspectionError.message
        : exactPathInspectionError
          ? String(exactPathInspectionError)
          : null,
    skipped: false,
  };
}

function runCli() {
  const srcTauriDir = process.argv[2] ?? 'src-tauri';
  const binaryName = process.argv[3] ?? 'sdkwork-claw-desktop';
  const result = ensureTauriDevBinaryUnlocked(srcTauriDir, binaryName);

  if (result.skipped === 'unsupported-platform') {
    console.log(`Skipping Tauri dev binary unlock on unsupported platform ${process.platform}.`);
    return;
  }

  if (result.skipped === 'binary-missing') {
    console.log(`No built Tauri dev binary found at ${result.executablePath}; continuing.`);
    return;
  }

  if (result.terminatedProcesses.length > 0) {
    if (result.kernelServiceStopError) {
      console.warn(
        `Managed kernel service stop remained non-fatal during dev unlock: ${result.kernelServiceStopError}`,
      );
    }
    if (result.exactPathInspectionError) {
      console.warn(
        `Exact-path Tauri dev binary inspection failed; fell back to image-name matching: ${result.exactPathInspectionError}`,
      );
    }
    console.log(
      `Stopped ${result.terminatedProcesses.length} locked Tauri dev process(es) for ${result.executablePath}.`,
    );
    return;
  }

  if (result.exactPathInspectionError) {
    console.warn(
      `Exact-path Tauri dev binary inspection failed; image-name fallback found no remaining process: ${result.exactPathInspectionError}`,
    );
  }

  console.log(`No running Tauri dev binary lock detected for ${result.executablePath}.`);
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);

if (invokedScriptPath && invokedScriptPath === currentModulePath) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
