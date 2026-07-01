import {
  formatLocalApiProxyProviderRequestOverridesDraft,
  parseLocalApiProxyProviderRequestOverridesDraft,
} from '@sdkwork/local-api-proxy';
import type { StudioWorkbenchLLMProviderRequestOverridesRecord } from '@sdkwork/claw-types';

export function formatOpenClawProviderRequestOverridesDraft(
  request: StudioWorkbenchLLMProviderRequestOverridesRecord | undefined,
) {
  return formatLocalApiProxyProviderRequestOverridesDraft(request);
}

export function parseOpenClawProviderRequestOverridesDraft(
  input: string,
): StudioWorkbenchLLMProviderRequestOverridesRecord | undefined {
  return parseLocalApiProxyProviderRequestOverridesDraft(input) as
    | StudioWorkbenchLLMProviderRequestOverridesRecord
    | undefined;
}
