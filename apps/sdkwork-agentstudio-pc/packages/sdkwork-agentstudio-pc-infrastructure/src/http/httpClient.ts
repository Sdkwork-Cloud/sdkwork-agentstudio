interface RequestOptions extends RequestInit {
  jsonBody?: unknown;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { jsonBody, headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(url, { ...options, method: 'GET' });
}

export function postJson<T>(url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(url, { ...options, method: 'POST', jsonBody: body });
}
