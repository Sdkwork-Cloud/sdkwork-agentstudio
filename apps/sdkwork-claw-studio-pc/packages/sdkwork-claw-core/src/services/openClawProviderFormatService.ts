export {
  describeOpenClawSecretSource,
  normalizeOpenClawSecretSource as normalizeOpenClawProviderApiKeySource,
  presentOpenClawSecretSource as presentOpenClawProviderApiKeySource,
  serializeOpenClawSecretSource as serializeOpenClawProviderApiKeySource,
} from './openClawSecretFormatService.ts';

export function normalizeOpenClawProviderEndpoint(value: string | undefined | null) {
  const normalized = value?.trim() || '';
  return normalized ? normalized.replace(/\/+$/g, '') : '';
}
