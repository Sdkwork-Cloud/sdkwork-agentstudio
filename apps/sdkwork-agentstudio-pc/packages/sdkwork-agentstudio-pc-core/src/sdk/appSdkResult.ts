export interface AppSdkEnvelope<T> {
  code?: string | number;
  data?: T;
  msg?: string;
  message?: string;
}

function isSuccessCode(code: string | number | undefined): boolean {
  if (code === undefined || code === null) {
    return true;
  }

  const normalized = String(code).trim();
  return normalized === '2000' || normalized === '200' || normalized === '0';
}

function getEnvelopeMessage(envelope: AppSdkEnvelope<unknown>): string {
  return String(envelope.message || envelope.msg || 'Request failed.').trim();
}

export function unwrapAppSdkResponse<T>(
  payload: T | AppSdkEnvelope<T> | null | undefined,
  fallbackMessage = 'Request failed.',
): T {
  if (!payload || typeof payload !== 'object') {
    return payload as T;
  }

  if (!('code' in payload) && !('data' in payload)) {
    return payload as T;
  }

  const envelope = payload as AppSdkEnvelope<T>;
  if (!isSuccessCode(envelope.code)) {
    throw new Error(getEnvelopeMessage(envelope) || fallbackMessage);
  }

  return (envelope.data ?? null) as T;
}
