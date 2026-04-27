export interface DesktopHostRuntimeDescriptorLike {
  mode: 'desktopCombined';
  lifecycle: string;
  apiBasePath: string;
  manageBasePath: string;
  internalBasePath: string;
  browserBaseUrl: string;
  browserSessionToken: string;
  lastError?: string | null;
  endpointId?: string | null;
  requestedPort?: number | null;
  activePort?: number | null;
  loopbackOnly?: boolean | null;
  dynamicPort?: boolean | null;
  stateStoreDriver?: string | null;
  stateStoreProfileId?: string | null;
  runtimeDataDir?: string | null;
  webDistDir?: string | null;
}

export interface CreateDesktopHostRuntimeResolverOptions<
  TRuntime extends DesktopHostRuntimeDescriptorLike | null,
> {
  waitForRuntime: () => Promise<boolean>;
  loadRuntime: (
    context: DesktopHostRuntimeOperationAttemptContext,
  ) => Promise<TRuntime>;
  retryTimeoutMs?: number;
  retryPollMs?: number;
  attemptTimeoutMs?: number;
}

export interface DesktopHostRuntimeResolver<TRuntime> {
  resolve(): Promise<TRuntime | null>;
}

export interface RetryDesktopHostRuntimeOperationRetryContext {
  attempt: number;
  elapsedMs: number;
  error: unknown;
}

export interface DesktopHostRuntimeOperationAttemptContext {
  attempt: number;
  elapsedMs: number;
  signal: AbortSignal;
}

export interface RetryDesktopHostRuntimeOperationOptions<TResult> {
  operation: (
    context: DesktopHostRuntimeOperationAttemptContext,
  ) => Promise<TResult>;
  retryTimeoutMs?: number;
  retryPollMs?: number;
  attemptTimeoutMs?: number;
  shouldRetry?: (
    context: RetryDesktopHostRuntimeOperationRetryContext,
  ) => boolean;
  onRetry?: (context: RetryDesktopHostRuntimeOperationRetryContext) => void;
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

class DesktopHostRuntimeOperationTimeoutError extends Error {
  readonly retryable: boolean;

  constructor(timeoutMs: number, options?: { retryable?: boolean }) {
    super(`Desktop hosted runtime operation timed out after ${timeoutMs}ms.`);
    this.name = 'DesktopHostRuntimeOperationTimeoutError';
    this.retryable = Boolean(options?.retryable);
  }
}

function isDesktopHostRuntimeOperationTimeoutError(
  error: unknown,
): error is DesktopHostRuntimeOperationTimeoutError {
  return error instanceof DesktopHostRuntimeOperationTimeoutError;
}

async function runWithTimeout<TResult>(
  operation: (
    context: DesktopHostRuntimeOperationAttemptContext,
  ) => Promise<TResult>,
  timeoutMs: number,
  context: Omit<DesktopHostRuntimeOperationAttemptContext, 'signal'>,
  options?: {
    retryableTimeout?: boolean;
  },
): Promise<TResult> {
  const abortController = new AbortController();
  const attemptContext: DesktopHostRuntimeOperationAttemptContext = {
    ...context,
    signal: abortController.signal,
  };

  if (timeoutMs <= 0) {
    return operation(attemptContext);
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation(attemptContext),
      new Promise<TResult>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new DesktopHostRuntimeOperationTimeoutError(timeoutMs, {
            retryable: options?.retryableTimeout,
          }));
          abortController.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function resolveAttemptTimeout(
  retryRemainingMs: number,
  attemptTimeoutMs: number,
) {
  if (retryRemainingMs <= 0) {
    return {
      timeoutMs: 0,
      retryableTimeout: false,
    };
  }

  if (attemptTimeoutMs <= 0) {
    return {
      timeoutMs: retryRemainingMs,
      retryableTimeout: false,
    };
  }

  const timeoutMs = Math.min(retryRemainingMs, attemptTimeoutMs);
  return {
    timeoutMs,
    retryableTimeout: timeoutMs < retryRemainingMs,
  };
}

export async function retryDesktopHostRuntimeOperation<TResult>(
  options: RetryDesktopHostRuntimeOperationOptions<TResult>,
): Promise<TResult> {
  const retryTimeoutMs = Math.max(0, options.retryTimeoutMs ?? 5000);
  const retryPollMs = Math.max(1, options.retryPollMs ?? 60);
  const attemptTimeoutMs = Math.max(0, options.attemptTimeoutMs ?? 0);
  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    attempt += 1;

    try {
      const remainingMs =
        retryTimeoutMs > 0
          ? Math.max(1, retryTimeoutMs - (Date.now() - startedAt))
          : 0;
      const attemptTimeout = resolveAttemptTimeout(
        remainingMs,
        attemptTimeoutMs,
      );
      return await runWithTimeout(
        options.operation,
        attemptTimeout.timeoutMs,
        {
          attempt,
          elapsedMs: Date.now() - startedAt,
        },
        {
          retryableTimeout: attemptTimeout.retryableTimeout,
        },
      );
    } catch (error) {
      const context: RetryDesktopHostRuntimeOperationRetryContext = {
        attempt,
        elapsedMs: Date.now() - startedAt,
        error,
      };
      const timeoutAllowsRetry = isDesktopHostRuntimeOperationTimeoutError(error)
        ? error.retryable
        : true;
      const canRetry =
        timeoutAllowsRetry
        && context.elapsedMs < retryTimeoutMs
        && (options.shouldRetry ? options.shouldRetry(context) : true);

      if (!canRetry) {
        throw error;
      }

      options.onRetry?.(context);
      await sleep(retryPollMs);
    }
  }
}

export function createDesktopHostRuntimeResolver<
  TRuntime extends DesktopHostRuntimeDescriptorLike | null,
>(
  options: CreateDesktopHostRuntimeResolverOptions<TRuntime>,
): DesktopHostRuntimeResolver<TRuntime> {
  let inFlightRuntime: Promise<TRuntime | null> | null = null;

  async function loadRuntimeWithRetry(): Promise<TRuntime | null> {
    const retryTimeoutMs = Math.max(0, options.retryTimeoutMs ?? 5000);
    const retryPollMs = Math.max(1, options.retryPollMs ?? 60);
    const attemptTimeoutMs = Math.max(0, options.attemptTimeoutMs ?? 0);
    const startedAt = Date.now();
    let attempt = 0;

    while (true) {
      attempt += 1;
      try {
        const remainingMs =
          retryTimeoutMs > 0
            ? Math.max(1, retryTimeoutMs - (Date.now() - startedAt))
            : 0;
        const attemptTimeout = resolveAttemptTimeout(
          remainingMs,
          attemptTimeoutMs,
        );
        const runtime = await runWithTimeout(
          options.loadRuntime,
          attemptTimeout.timeoutMs,
          {
            attempt,
            elapsedMs: Date.now() - startedAt,
          },
          {
            retryableTimeout: attemptTimeout.retryableTimeout,
          },
        );
        if (runtime) {
          return runtime;
        }
      } catch {
        // Retry within the current resolution window, but never resurrect a stale runtime descriptor.
      }

      if (Date.now() - startedAt >= retryTimeoutMs) {
        return null;
      }

      await sleep(retryPollMs);
    }
  }

  return {
    async resolve() {
      if (!(await options.waitForRuntime())) {
        return null;
      }

      if (!inFlightRuntime) {
        inFlightRuntime = (async () => {
          try {
            return await loadRuntimeWithRetry();
          } finally {
            inFlightRuntime = null;
          }
        })();
      }

      return inFlightRuntime;
    },
  };
}
