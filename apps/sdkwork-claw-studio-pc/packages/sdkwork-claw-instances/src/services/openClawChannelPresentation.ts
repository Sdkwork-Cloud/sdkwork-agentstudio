import type { ChannelWorkspaceItem } from '@sdkwork/claw-ui';
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
