import { resolveBrowserStorage } from '@sdkwork/clawstudio-infrastructure';

const DESKTOP_STARTUP_EVIDENCE_PATH = 'diagnostics/desktop-startup-evidence.json';
const DESKTOP_STARTUP_FATAL_ERROR_STORAGE_KEY = 'claw.desktop.startupFatalError';
const TAURI_WRITE_TEXT_FILE_COMMAND = 'write_text_file';

type TauriInvoke = (
  command: string,
  payload?: Record<string, unknown>,
) => Promise<unknown>;

export interface DesktopStartupFatalEvidenceDocument {
  version: 1;
  status: 'failed';
  phase: 'bootstrap-failed';
  runId: number;
  durationMs: number;
  recordedAt: string;
  app: null;
  bundledComponents: null;
  paths: null;
  descriptor: null;
  hostPlatformStatus: null;
  hostEndpoints: [];
  openClawRuntime: null;
  openClawGateway: null;
  builtInInstance: null;
  readinessEvidence: null;
  localAiProxy: null;
  error: {
    message: string;
    cause: string | null;
  };
}

function summarizeStartupFatalError(error: unknown) {
  if (error instanceof Error) {
    const cause =
      typeof error.cause === 'string'
        ? error.cause
        : error.cause instanceof Error
          ? error.cause.message
          : error.cause == null
            ? null
            : String(error.cause);
    return {
      message: error.message || String(error),
      cause,
    };
  }

  return {
    message: String(error),
    cause: null,
  };
}

export function buildDesktopStartupFatalEvidenceDocument({
  error,
  runId = 0,
  durationMs = 0,
  recordedAt = new Date().toISOString(),
}: {
  error: unknown;
  runId?: number;
  durationMs?: number;
  recordedAt?: string;
}): DesktopStartupFatalEvidenceDocument {
  return {
    version: 1,
    status: 'failed',
    phase: 'bootstrap-failed',
    runId,
    durationMs: Math.max(0, Math.trunc(durationMs)),
    recordedAt,
    app: null,
    bundledComponents: null,
    paths: null,
    descriptor: null,
    hostPlatformStatus: null,
    hostEndpoints: [],
    openClawRuntime: null,
    openClawGateway: null,
    builtInInstance: null,
    readinessEvidence: null,
    localAiProxy: null,
    error: summarizeStartupFatalError(error),
  };
}

export function serializeDesktopStartupFatalEvidence(
  document: DesktopStartupFatalEvidenceDocument,
): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function resolveRawTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeWindow = window as Window & {
    __TAURI_INTERNALS__?: {
      invoke?: unknown;
    };
  };

  const invoke = runtimeWindow.__TAURI_INTERNALS__?.invoke;
  return typeof invoke === 'function' ? (invoke as TauriInvoke) : null;
}

async function defaultWaitForInvoke({
  timeoutMs = 5000,
  pollMs = 20,
}: {
  timeoutMs?: number;
  pollMs?: number;
} = {}): Promise<TauriInvoke | null> {
  const immediateInvoke = resolveRawTauriInvoke();
  if (immediateInvoke) {
    return immediateInvoke;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, pollMs);
    });
    const invoke = resolveRawTauriInvoke();
    if (invoke) {
      return invoke;
    }
  }

  return resolveRawTauriInvoke();
}

function defaultWriteBrowserFallback(document: DesktopStartupFatalEvidenceDocument) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    resolveBrowserStorage('localStorage')?.setItem(
      DESKTOP_STARTUP_FATAL_ERROR_STORAGE_KEY,
      serializeDesktopStartupFatalEvidence(document),
    );
  } catch {
    // Ignore browser fallback persistence failures. The primary target is the desktop evidence file.
  }
}

let lastFatalStartupSignature = '';

export async function reportDesktopStartupFatalError(
  error: unknown,
  options?: {
    runId?: number;
    durationMs?: number;
    recordedAt?: string;
    waitForInvoke?: (options?: {
      timeoutMs?: number;
      pollMs?: number;
    }) => Promise<TauriInvoke | null>;
    writeBrowserFallback?: (document: DesktopStartupFatalEvidenceDocument) => void;
  },
): Promise<boolean> {
  const document = buildDesktopStartupFatalEvidenceDocument({
    error,
    runId: options?.runId,
    durationMs: options?.durationMs,
    recordedAt: options?.recordedAt,
  });
  const signature = `${document.phase}:${document.error.message}`;
  if (lastFatalStartupSignature === signature) {
    return false;
  }

  lastFatalStartupSignature = signature;
  const writeBrowserFallback = options?.writeBrowserFallback ?? defaultWriteBrowserFallback;
  writeBrowserFallback(document);

  try {
    const waitForInvoke = options?.waitForInvoke ?? defaultWaitForInvoke;
    const invoke = await waitForInvoke();
    if (!invoke) {
      return false;
    }
    await invoke(TAURI_WRITE_TEXT_FILE_COMMAND, {
      path: DESKTOP_STARTUP_EVIDENCE_PATH,
      content: serializeDesktopStartupFatalEvidence(document),
    });
    return true;
  } catch {
    return false;
  }
}
