import type { ChannelWorkspaceItem } from '@sdkwork/clawstudio-ui';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

export function buildReadonlyChannelWorkspaceItems(
  channels: InstanceWorkbenchSnapshot['channels'] | null | undefined,
): ChannelWorkspaceItem[] {
  return (channels || []).map((channel) => ({
    ...channel,
    fields: [],
    setupSteps: [...(channel.setupSteps || [])],
    values: {},
  }));
}
