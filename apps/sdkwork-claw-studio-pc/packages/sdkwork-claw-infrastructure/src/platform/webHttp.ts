export interface WebPlatformResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type WebPlatformFetch = (
  input: string,
  init?: RequestInit,
) => Promise<WebPlatformResponse>;

export function resolveWebPlatformFetch(
  fetchImpl?: WebPlatformFetch,
): WebPlatformFetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Browser HTTP bridge requires a global fetch implementation.');
  }

  return globalThis.fetch.bind(globalThis) as WebPlatformFetch;
}

export function joinBasePath(basePath: string, path: string): string {
  const normalizedBasePath = basePath.endsWith('/') && basePath.length > 1
    ? basePath.slice(0, -1)
    : basePath;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBasePath}${normalizedPath}`;
}

export async function requestJson<T>(
  fetchImpl: WebPlatformFetch,
  input: string,
  init: RequestInit | undefined,
  context: string,
): Promise<T> {
  const response = await fetchImpl(input, init);
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    throw new Error(
      `${context} failed with ${response.status} ${response.statusText}: ${await readResponseDetail(response, contentType)}`,
    );
  }

  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(
      `${context} expected application/json but received ${contentType || 'unknown content type'}`,
    );
  }

  return response.json() as Promise<T>;
}

async function readResponseDetail(
  response: WebPlatformResponse,
  contentType: string,
): Promise<string> {
  if (contentType.toLowerCase().includes('json')) {
    try {
      return JSON.stringify(await response.json());
    } catch {
      return 'unable to parse JSON error payload';
    }
  }

  try {
    return await response.text();
  } catch {
    return 'unable to read error payload';
  }
}
