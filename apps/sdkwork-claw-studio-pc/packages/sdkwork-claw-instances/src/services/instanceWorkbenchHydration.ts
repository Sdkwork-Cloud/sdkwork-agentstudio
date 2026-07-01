import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type {
  InstanceWorkbenchFile,
  InstanceWorkbenchMemoryEntry,
  InstanceWorkbenchSectionId,
  InstanceWorkbenchSnapshot,
} from '../types/index.ts';

type LazyLoadDecisionInput = {
  activeSection: InstanceWorkbenchSectionId;
  detail: StudioInstanceDetailRecord | null | undefined;
  workbench: InstanceWorkbenchSnapshot | null | undefined;
};

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

export interface InstanceWorkbenchHydrationResetState {
  isFilesLoading: boolean;
  isMemoryLoading: boolean;
}

export interface StartLazyLoadInstanceWorkbenchFilesInput extends LazyLoadDecisionInput {
  instanceId: string | null | undefined;
  setIsLoading: StateSetter<boolean>;
  setWorkbench: StateSetter<InstanceWorkbenchSnapshot | null>;
  loadFiles: (
    instanceId: string,
    agents: InstanceWorkbenchSnapshot['agents'],
  ) => Promise<InstanceWorkbenchFile[]>;
  reportError: (error: unknown) => void;
}

export interface StartLazyLoadInstanceWorkbenchMemoryInput extends LazyLoadDecisionInput {
  instanceId: string | null | undefined;
  setIsLoading: StateSetter<boolean>;
  setWorkbench: StateSetter<InstanceWorkbenchSnapshot | null>;
  loadMemories: (
    instanceId: string,
    agents: InstanceWorkbenchSnapshot['agents'],
  ) => Promise<InstanceWorkbenchMemoryEntry[]>;
  reportError: (error: unknown) => void;
}

function isOpenClawLazyLoadContext(
  input: LazyLoadDecisionInput,
  targetSection: InstanceWorkbenchSectionId,
) {
  return Boolean(
    input.detail?.instance.runtimeKind === 'openclaw' &&
      input.workbench &&
      input.activeSection === targetSection,
  );
}

export function createInstanceWorkbenchHydrationResetState(): InstanceWorkbenchHydrationResetState {
  return {
    isFilesLoading: false,
    isMemoryLoading: false,
  };
}

function startLazyLoadInstanceWorkbenchSlice<T>({
  instanceId,
  workbench,
  setIsLoading,
  setWorkbench,
  load,
  merge,
  reportError,
}: {
  instanceId: string;
  workbench: InstanceWorkbenchSnapshot;
  setIsLoading: StateSetter<boolean>;
  setWorkbench: StateSetter<InstanceWorkbenchSnapshot | null>;
  load: (
    instanceId: string,
    agents: InstanceWorkbenchSnapshot['agents'],
  ) => Promise<T>;
  merge: (current: InstanceWorkbenchSnapshot, value: T) => InstanceWorkbenchSnapshot;
  reportError: (error: unknown) => void;
}) {
  let cancelled = false;
  setIsLoading(true);

  void load(instanceId, workbench.agents)
    .then((value) => {
      if (cancelled) {
        return;
      }

      setWorkbench((current) => {
        if (!current || current.instance.id !== instanceId) {
          return current;
        }

        return merge(current, value);
      });
    })
    .catch((error) => {
      reportError(error);
    })
    .finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}

export function shouldLazyLoadInstanceWorkbenchFiles(
  input: LazyLoadDecisionInput,
) {
  if (
    !input.workbench ||
    !input.detail ||
    !['files', 'agents'].includes(input.activeSection)
  ) {
    return false;
  }

  return (
    input.detail.instance.runtimeKind === 'openclaw' &&
    input.workbench.files.length === 0
  );
}

export function shouldLazyLoadInstanceWorkbenchMemory(
  input: LazyLoadDecisionInput,
) {
  return (
    isOpenClawLazyLoadContext(input, 'memory') &&
    input.workbench!.memories.length === 0
  );
}

export function startLazyLoadInstanceWorkbenchFiles({
  activeSection,
  detail,
  instanceId,
  workbench,
  setIsLoading,
  setWorkbench,
  loadFiles,
  reportError,
}: StartLazyLoadInstanceWorkbenchFilesInput) {
  if (
    !instanceId ||
    !workbench ||
    !shouldLazyLoadInstanceWorkbenchFiles({ activeSection, detail, workbench })
  ) {
    return undefined;
  }

  return startLazyLoadInstanceWorkbenchSlice({
    instanceId,
    workbench,
    setIsLoading,
    setWorkbench,
    load: loadFiles,
    merge: (current, files) => mergeLazyLoadedWorkbenchFiles(current, files),
    reportError,
  });
}

export function startLazyLoadInstanceWorkbenchMemory({
  activeSection,
  detail,
  instanceId,
  workbench,
  setIsLoading,
  setWorkbench,
  loadMemories,
  reportError,
}: StartLazyLoadInstanceWorkbenchMemoryInput) {
  if (
    !instanceId ||
    !workbench ||
    !shouldLazyLoadInstanceWorkbenchMemory({ activeSection, detail, workbench })
  ) {
    return undefined;
  }

  return startLazyLoadInstanceWorkbenchSlice({
    instanceId,
    workbench,
    setIsLoading,
    setWorkbench,
    load: loadMemories,
    merge: (current, memories) => mergeLazyLoadedWorkbenchMemories(current, memories),
    reportError,
  });
}

export function mergeLazyLoadedWorkbenchFiles(
  current: InstanceWorkbenchSnapshot,
  files: InstanceWorkbenchFile[],
): InstanceWorkbenchSnapshot {
  if (files.length === 0) {
    return current;
  }

  return {
    ...current,
    files,
    sectionCounts: {
      ...current.sectionCounts,
      files: files.length,
    },
    sectionAvailability: {
      ...current.sectionAvailability,
      files: {
        status: 'ready',
        detail: 'Runtime file data is available for this instance workbench.',
      },
    },
  };
}

export function mergeLazyLoadedWorkbenchMemories(
  current: InstanceWorkbenchSnapshot,
  memories: InstanceWorkbenchMemoryEntry[],
): InstanceWorkbenchSnapshot {
  if (memories.length === 0) {
    return current;
  }

  return {
    ...current,
    memories,
    sectionCounts: {
      ...current.sectionCounts,
      memory: memories.length,
    },
    sectionAvailability: {
      ...current.sectionAvailability,
      memory: {
        status: 'ready',
        detail: 'Runtime memory data is available for this instance workbench.',
      },
    },
  };
}
