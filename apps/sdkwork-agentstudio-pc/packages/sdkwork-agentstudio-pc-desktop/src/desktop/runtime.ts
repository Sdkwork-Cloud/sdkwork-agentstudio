import type { RuntimeEventUnsubscribe } from '@sdkwork/agentstudio-pc-infrastructure';
import type { DesktopCommandName, DesktopEventName } from './catalog';

type DesktopBridgeRuntime = 'desktop' | 'web';

type DesktopWindowEventUnsubscribe = () => void;

interface DesktopWindowLike {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  isFullscreen(): Promise<boolean>;
  setFullscreen(next: boolean): Promise<void>;
  isMaximized(): Promise<boolean>;
  isMinimized(): Promise<boolean>;
  unminimize(): Promise<void>;
  isVisible(): Promise<boolean>;
  show(): Promise<void>;
  hide(): Promise<void>;
  setFocus(): Promise<void>;
  onResized(listener: () => void): Promise<DesktopWindowEventUnsubscribe>;
  onMoved(listener: () => void): Promise<DesktopWindowEventUnsubscribe>;
}

interface TauriCoreModuleLike {
  invoke<T>(command: string, payload?: Record<string, unknown>): Promise<T>;
}

interface TauriEventModuleLike {
  listen<T>(
    event: string,
    listener: (nextEvent: { payload: T }) => void,
  ): Promise<RuntimeEventUnsubscribe>;
}

interface TauriWindowModuleLike {
  getCurrentWindow(): DesktopWindowLike;
}

interface DesktopBridgeErrorOptions {
  operation: string;
  runtime: DesktopBridgeRuntime;
  command?: DesktopCommandName;
  event?: DesktopEventName;
  cause?: unknown;
}

function formatCause(cause: unknown) {
  if (!cause) {
    return 'Unknown bridge failure';
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === 'string') {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

function buildBridgeMessage(options: DesktopBridgeErrorOptions) {
  const scope = options.command ?? options.event ?? options.operation;
  return `${options.operation} failed for ${scope}: ${formatCause(options.cause)}`;
}

export class DesktopBridgeError extends Error {
  readonly operation: string;
  readonly runtime: DesktopBridgeRuntime;
  readonly command?: DesktopCommandName;
  readonly event?: DesktopEventName;
  readonly causeMessage: string;

  constructor(options: DesktopBridgeErrorOptions) {
    super(buildBridgeMessage(options));
    this.name = 'DesktopBridgeError';
    this.operation = options.operation;
    this.runtime = options.runtime;
    this.command = options.command;
    this.event = options.event;
    this.causeMessage = formatCause(options.cause);
  }
}

export function createDesktopUnavailableError(
  operation: string,
  command?: DesktopCommandName,
): DesktopBridgeError {
  return new DesktopBridgeError({
    operation,
    runtime: 'web',
    command,
    cause: 'Tauri runtime is unavailable.',
  });
}

interface TauriInternalsLike {
  invoke?: unknown;
}

let tauriCoreModulePromise: Promise<TauriCoreModuleLike | null> | null = null;
let tauriCoreModule: TauriCoreModuleLike | null = null;
let tauriEventModulePromise: Promise<TauriEventModuleLike | null> | null = null;
let tauriEventModule: TauriEventModuleLike | null = null;
let tauriWindowModulePromise: Promise<TauriWindowModuleLike | null> | null = null;
let tauriWindowModule: TauriWindowModuleLike | null = null;

const TAURI_RUNTIME_WAIT_TIMEOUT_MS = 600;
const TAURI_RUNTIME_WAIT_POLL_MS = 20;

async function loadTauriCoreModule(): Promise<TauriCoreModuleLike | null> {
  tauriCoreModulePromise ??= import('@tauri-apps/api/core')
    .then((module) => {
      tauriCoreModule = {
        invoke: module.invoke,
      };
      return tauriCoreModule;
    })
    .catch(() => {
      tauriCoreModule = null;
      return null;
    });

  return tauriCoreModulePromise;
}

async function loadTauriEventModule(): Promise<TauriEventModuleLike | null> {
  tauriEventModulePromise ??= import('@tauri-apps/api/event')
    .then((module) => {
      tauriEventModule = {
        listen: module.listen,
      };
      return tauriEventModule;
    })
    .catch(() => {
      tauriEventModule = null;
      return null;
    });

  return tauriEventModulePromise;
}

async function loadTauriWindowModule(): Promise<TauriWindowModuleLike | null> {
  tauriWindowModulePromise ??= import('@tauri-apps/api/window')
    .then((module) => {
      tauriWindowModule = {
        getCurrentWindow: module.getCurrentWindow,
      };
      return tauriWindowModule;
    })
    .catch(() => {
      tauriWindowModule = null;
      return null;
    });

  return tauriWindowModulePromise;
}

function primeTauriModules() {
  void loadTauriCoreModule();
  void loadTauriEventModule();
  void loadTauriWindowModule();
}

function resolveTauriInternals() {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeWindow = window as Window & {
    __TAURI_INTERNALS__?: TauriInternalsLike;
  };

  return runtimeWindow.__TAURI_INTERNALS__ ?? null;
}

export function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const tauriInternals = resolveTauriInternals();
  const detected = Boolean(tauriInternals && typeof tauriInternals.invoke === 'function');
  if (detected) {
    primeTauriModules();
  }

  return detected;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForTauriRuntime(options?: {
  timeoutMs?: number;
  pollMs?: number;
}): Promise<boolean> {
  if (isTauriRuntime()) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const timeoutMs = Math.max(0, options?.timeoutMs ?? TAURI_RUNTIME_WAIT_TIMEOUT_MS);
  const pollMs = Math.max(1, options?.pollMs ?? TAURI_RUNTIME_WAIT_POLL_MS);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    if (isTauriRuntime()) {
      return true;
    }
  }

  return isTauriRuntime();
}

export function getDesktopWindow(): DesktopWindowLike | null {
  if (!isTauriRuntime()) {
    return null;
  }

  void loadTauriWindowModule();
  return tauriWindowModule?.getCurrentWindow() ?? null;
}

async function invokeTauriCommand<T>(
  command: DesktopCommandName,
  payload?: Record<string, unknown>,
): Promise<T> {
  const tauriCore = await loadTauriCoreModule();
  if (tauriCore) {
    return tauriCore.invoke<T>(command, payload);
  }

  const tauriInternals = resolveTauriInternals();
  if (tauriInternals && typeof tauriInternals.invoke === 'function') {
    return (tauriInternals.invoke as (
      command: string,
      payload?: Record<string, unknown>,
    ) => Promise<T>)(command, payload);
  }

  throw createDesktopUnavailableError(command, command);
}

export async function invokeTauriRuntimeCommand<T>(
  command: string,
  payload?: Record<string, unknown>,
  options?: {
    operation?: string;
    desktopCommand?: DesktopCommandName;
  },
): Promise<T> {
  const operation = options?.operation ?? command;
  if (!(await waitForTauriRuntime())) {
    throw createDesktopUnavailableError(operation, options?.desktopCommand);
  }

  try {
    return await invokeTauriCommand<T>(
      options?.desktopCommand ?? (command as DesktopCommandName),
      payload,
    );
  } catch (cause) {
    throw new DesktopBridgeError({
      operation,
      runtime: 'desktop',
      command: options?.desktopCommand,
      cause,
    });
  }
}

export async function invokeDesktopCommand<T>(
  command: DesktopCommandName,
  payload?: Record<string, unknown>,
  options?: { operation?: string },
): Promise<T> {
  return invokeTauriRuntimeCommand(command, payload, {
    operation: options?.operation ?? command,
    desktopCommand: command,
  });
}

export async function listenDesktopEvent<T>(
  event: DesktopEventName,
  listener: (payload: T) => void,
  options?: { operation?: string },
): Promise<RuntimeEventUnsubscribe> {
  if (!(await waitForTauriRuntime())) {
    return () => {};
  }

  try {
    const tauriEvent = await loadTauriEventModule();
    if (!tauriEvent) {
      return () => {};
    }

    return await tauriEvent.listen<T>(event, (nextEvent) => {
      listener(nextEvent.payload);
    });
  } catch (cause) {
    throw new DesktopBridgeError({
      operation: options?.operation ?? event,
      runtime: 'desktop',
      event,
      cause,
    });
  }
}

export async function runDesktopOrFallback<T>(
  operation: string,
  desktopCall: () => Promise<T>,
  webFallback: () => Promise<T>,
): Promise<T> {
  if (!(await waitForTauriRuntime())) {
    return webFallback();
  }

  try {
    return await desktopCall();
  } catch (cause) {
    if (cause instanceof DesktopBridgeError) {
      throw cause;
    }

    throw new DesktopBridgeError({
      operation,
      runtime: 'desktop',
      cause,
    });
  }
}

export async function runDesktopOnly<T>(
  operation: string,
  desktopCall: () => Promise<T>,
): Promise<T> {
  return runDesktopOrFallback(operation, desktopCall, async () => {
    throw createDesktopUnavailableError(operation);
  });
}
