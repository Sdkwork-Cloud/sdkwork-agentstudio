import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDesktopHostRuntimeResolver,
  retryDesktopHostRuntimeOperation,
  type DesktopHostRuntimeDescriptorLike,
} from './desktopHostRuntimeResolver.ts';

function createRuntime(
  browserSessionToken: string,
): DesktopHostRuntimeDescriptorLike {
  return {
    mode: 'desktopCombined',
    lifecycle: 'ready',
    apiBasePath: '/claw/api/v1',
    manageBasePath: '/claw/manage/v1',
    internalBasePath: '/claw/internal/v1',
    browserBaseUrl: 'http://127.0.0.1:21289',
    browserSessionToken,
    lastError: null,
  };
}

test('desktop host runtime resolver refreshes the descriptor after each completed lookup', async () => {
  const invocations: string[] = [];
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    loadRuntime: async () => {
      const token = invocations.length === 0 ? 'desktop-session-token-1' : 'desktop-session-token-2';
      invocations.push(token);
      return createRuntime(token);
    },
  });

  const first = await resolver.resolve();
  const second = await resolver.resolve();

  assert.equal(first?.browserSessionToken, 'desktop-session-token-1');
  assert.equal(second?.browserSessionToken, 'desktop-session-token-2');
  assert.deepEqual(invocations, ['desktop-session-token-1', 'desktop-session-token-2']);
});

test('desktop host runtime resolver deduplicates concurrent lookups while a runtime load is in flight', async () => {
  let releaseLoad: (() => void) | undefined;
  let loadCount = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    loadRuntime: async () => {
      loadCount += 1;
      await new Promise<void>((resolve) => {
        releaseLoad = resolve;
      });
      return createRuntime('desktop-session-token-shared');
    },
  });

  const firstPromise = resolver.resolve();
  const secondPromise = resolver.resolve();

  await Promise.resolve();
  assert.equal(loadCount, 1);
  assert.ok(releaseLoad, 'expected in-flight load release hook');
  releaseLoad();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(first?.browserSessionToken, 'desktop-session-token-shared');
  assert.equal(second?.browserSessionToken, 'desktop-session-token-shared');
  assert.equal(loadCount, 1);
});

test('desktop host runtime resolver retries failed lookups within the same resolution before falling back to a later call', async () => {
  let attempt = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    retryTimeoutMs: 50,
    retryPollMs: 1,
    loadRuntime: async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('transient host runtime lookup failure');
      }

      return createRuntime('desktop-session-token-retried');
    },
  });

  const first = await resolver.resolve();
  const second = await resolver.resolve();

  assert.equal(first?.browserSessionToken, 'desktop-session-token-retried');
  assert.equal(second?.browserSessionToken, 'desktop-session-token-retried');
  assert.equal(attempt, 3);
});

test('desktop host runtime resolver retries transient null descriptors until the hosted browser runtime becomes available', async () => {
  let attempt = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    retryTimeoutMs: 50,
    retryPollMs: 1,
    loadRuntime: async () => {
      attempt += 1;
      if (attempt < 3) {
        return null;
      }

      return createRuntime('desktop-session-token-eventual');
    },
  });

  const resolved = await resolver.resolve();

  assert.equal(resolved?.browserSessionToken, 'desktop-session-token-eventual');
  assert.equal(attempt, 3);
});

test('desktop host runtime resolver invalidates the last resolved descriptor when a refresh returns null', async () => {
  let attempt = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    retryTimeoutMs: 0,
    retryPollMs: 1,
    loadRuntime: async () => {
      attempt += 1;
      if (attempt === 1) {
        return createRuntime('desktop-session-token-1');
      }

      return null;
    },
  });

  const first = await resolver.resolve();
  const second = await resolver.resolve();

  assert.equal(first?.browserSessionToken, 'desktop-session-token-1');
  assert.equal(second, null);
  assert.equal(attempt, 2);
});

test('desktop host runtime resolver invalidates the last resolved descriptor when a refresh throws', async () => {
  let attempt = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    retryTimeoutMs: 0,
    retryPollMs: 1,
    loadRuntime: async () => {
      attempt += 1;
      if (attempt === 1) {
        return createRuntime('desktop-session-token-1');
      }

      throw new Error('desktop embedded host descriptor refresh failed');
    },
  });

  const first = await resolver.resolve();
  const second = await resolver.resolve();

  assert.equal(first?.browserSessionToken, 'desktop-session-token-1');
  assert.equal(second, null);
  assert.equal(attempt, 2);
});

test('desktop host runtime resolver tolerates slower embedded host warmup before treating the descriptor as unavailable', async () => {
  let attempt = 0;
  const resolver = createDesktopHostRuntimeResolver({
    waitForRuntime: async () => true,
    retryPollMs: 50,
    loadRuntime: async () => {
      attempt += 1;
      if (attempt < 27) {
        return null;
      }

      return createRuntime('desktop-session-token-slow-start');
    },
  });

  const resolved = await resolver.resolve();

  assert.equal(resolved?.browserSessionToken, 'desktop-session-token-slow-start');
  assert.equal(attempt, 27);
});

test('desktop host runtime retry helper retries transient readiness failures until the managed runtime converges', async () => {
  let attempt = 0;
  const retryMessages: string[] = [];

  const result = await retryDesktopHostRuntimeOperation({
    retryTimeoutMs: 50,
    retryPollMs: 1,
    operation: async () => {
      attempt += 1;
      if (attempt < 3) {
        throw new Error(`managed runtime not ready yet: attempt ${attempt}`);
      }

      return 'ready';
    },
    onRetry({ attempt: retryAttempt, error }) {
      retryMessages.push(
        `attempt:${retryAttempt}:${error instanceof Error ? error.message : String(error)}`,
      );
    },
  });

  assert.equal(result, 'ready');
  assert.equal(attempt, 3);
  assert.deepEqual(retryMessages, [
    'attempt:1:managed runtime not ready yet: attempt 1',
    'attempt:2:managed runtime not ready yet: attempt 2',
  ]);
});

test('desktop host runtime retry helper rethrows the last startup failure once the retry window expires', async () => {
  let attempt = 0;

  await assert.rejects(
    () =>
      retryDesktopHostRuntimeOperation({
        retryTimeoutMs: 0,
        retryPollMs: 1,
        operation: async () => {
          attempt += 1;
          throw new Error(`managed runtime permanently unavailable: attempt ${attempt}`);
        },
      }),
    /managed runtime permanently unavailable: attempt 1/,
  );

  assert.equal(attempt, 1);
});

test('desktop host runtime retry helper times out an operation that never settles', async () => {
  let attempt = 0;

  const result = await Promise.race([
    retryDesktopHostRuntimeOperation({
      retryTimeoutMs: 10,
      retryPollMs: 1,
      operation: async () => {
        attempt += 1;
        await new Promise(() => {});
        return 'ready';
      },
    }).then(
      () => 'resolved',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    ),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('hung'), 50);
    }),
  ]);

  assert.match(result, /timed out/i);
  assert.equal(attempt, 1);
});

test('desktop host runtime retry helper aborts the in-flight operation when the retry window expires', async () => {
  let attempt = 0;
  let signalWasProvided = false;
  let signalWasAborted = false;

  const result = await Promise.race([
    retryDesktopHostRuntimeOperation({
      retryTimeoutMs: 10,
      retryPollMs: 1,
      operation: async (context) => {
        attempt += 1;
        signalWasProvided = Boolean(context?.signal);
        context?.signal.addEventListener('abort', () => {
          signalWasAborted = true;
        });
        await new Promise(() => {});
        return 'ready';
      },
    }).then(
      () => 'resolved',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    ),
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('hung'), 50);
    }),
  ]);

  assert.match(result, /timed out/i);
  assert.equal(attempt, 1);
  assert.equal(signalWasProvided, true);
  assert.equal(signalWasAborted, true);
});

test('desktop host runtime retry helper retries abortable operations after a per-attempt timeout', async () => {
  let attempt = 0;
  let aborts = 0;

  await assert.rejects(
    () =>
      retryDesktopHostRuntimeOperation({
        retryTimeoutMs: 30,
        retryPollMs: 1,
        attemptTimeoutMs: 5,
        operation: async ({ signal }) => {
          attempt += 1;
          await new Promise((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                aborts += 1;
                reject(new Error('attempt aborted'));
              },
              { once: true },
            );
          });
          return 'ready';
        },
      }),
    /timed out/i,
  );

  assert.ok(attempt > 1, 'expected retry to continue after a per-attempt timeout');
  assert.equal(aborts, attempt);
});
