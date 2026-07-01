import {
  manage,
  type ManagePlatformAPI,
  type ManageRolloutListResult,
  type ManageRolloutPreview,
  type ManageRolloutRecord,
  type ManageRolloutTargetPreviewRecord,
} from '@sdkwork/claw-infrastructure';

export interface RolloutPhaseCounts {
  active: number;
  failed: number;
  completed: number;
  paused: number;
  drafts: number;
}

export interface RolloutPreviewOptions {
  includeTargets?: boolean;
  forceRecompute?: boolean;
}

export interface CreateRolloutServiceOptions {
  getManagePlatform?: () => ManagePlatformAPI;
}

function createEmptyPhaseCounts(): RolloutPhaseCounts {
  return {
    active: 0,
    failed: 0,
    completed: 0,
    paused: 0,
    drafts: 0,
  };
}

export function summarizeRolloutPhases(
  result: ManageRolloutListResult,
): RolloutPhaseCounts {
  return result.items.reduce<RolloutPhaseCounts>((counts, item) => {
    switch (item.phase) {
      case 'draft':
        counts.drafts += 1;
        break;
      case 'paused':
        counts.paused += 1;
        break;
      case 'completed':
        counts.completed += 1;
        break;
      case 'failed':
      case 'cancelled':
        counts.failed += 1;
        break;
      case 'previewing':
      case 'awaitingApproval':
      case 'ready':
      case 'promoting':
        counts.active += 1;
        break;
      default:
        break;
    }

    return counts;
  }, createEmptyPhaseCounts());
}

export function listRolloutTargetFailures(
  preview: ManageRolloutPreview,
): ManageRolloutTargetPreviewRecord[] {
  return preview.targets.filter((target) => (
    target.preflightOutcome.startsWith('blocked') || Boolean(target.blockedReason)
  ));
}

export interface RolloutService {
  list(): Promise<ManageRolloutListResult>;
  summarizePhases(result: ManageRolloutListResult): RolloutPhaseCounts;
  preview(rolloutId: string, input?: RolloutPreviewOptions): Promise<ManageRolloutPreview>;
  listTargetFailures(preview: ManageRolloutPreview): ManageRolloutTargetPreviewRecord[];
  start(rolloutId: string): Promise<ManageRolloutRecord>;
}

export function createRolloutService(
  options: CreateRolloutServiceOptions = {},
): RolloutService {
  const resolveManagePlatform = options.getManagePlatform ?? (() => manage);

  return {
    async list(): Promise<ManageRolloutListResult> {
      return resolveManagePlatform().listRollouts();
    },

    summarizePhases(result: ManageRolloutListResult): RolloutPhaseCounts {
      return summarizeRolloutPhases(result);
    },

    async preview(
      rolloutId: string,
      input: RolloutPreviewOptions = {},
    ): Promise<ManageRolloutPreview> {
      return resolveManagePlatform().previewRollout({
        rolloutId,
        includeTargets: input.includeTargets ?? true,
        forceRecompute: input.forceRecompute ?? false,
      });
    },

    listTargetFailures(preview: ManageRolloutPreview): ManageRolloutTargetPreviewRecord[] {
      return listRolloutTargetFailures(preview);
    },

    async start(rolloutId: string): Promise<ManageRolloutRecord> {
      return resolveManagePlatform().startRollout(rolloutId);
    },
  };
}

export const rolloutService = createRolloutService();
