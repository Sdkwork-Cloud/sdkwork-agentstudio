import React from 'react';
import { Loader2 } from 'lucide-react';
import type { OpenClawDreamingFormState } from '../services/index.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import {
  InstanceDetailMemorySection,
  type InstanceDetailMemorySectionProps,
} from './InstanceDetailMemorySection.tsx';

interface MemoryWorkbenchState {
  isEmpty: boolean;
  hasMemoryEntries: boolean;
  dreamDiaryEntries: Array<{
    updatedAt?: string | null;
  }>;
}

export interface InstanceDetailMemoryWorkbenchSectionProps {
  isLoading: boolean;
  emptyState: React.ReactNode;
  loadingLabel: string;
  workbench: Pick<InstanceWorkbenchSnapshot, 'memories'> | null;
  memoryWorkbenchState: MemoryWorkbenchState;
  configDreaming: InstanceWorkbenchSnapshot['configDreaming'] | null | undefined;
  dreamingDraft: OpenClawDreamingFormState | null;
  dreamingError: string | null;
  isSavingDreaming: boolean;
  canEditDreamingConfig: boolean;
  formatWorkbenchLabel: (value: string) => string;
  getDangerBadge: (status: string) => string;
  getStatusBadge: (status: string) => string;
  t: (key: string) => string;
  onDreamingDraftChange: (
    field: keyof OpenClawDreamingFormState,
    value: string | boolean,
  ) => void;
  onSaveDreamingConfig: () => Promise<void> | void;
}

export function InstanceDetailMemoryWorkbenchSection({
  isLoading,
  emptyState,
  loadingLabel,
  workbench,
  memoryWorkbenchState,
  configDreaming,
  dreamingDraft,
  dreamingError,
  isSavingDreaming,
  canEditDreamingConfig,
  formatWorkbenchLabel,
  getDangerBadge,
  getStatusBadge,
  t,
  onDreamingDraftChange,
  onSaveDreamingConfig,
}: InstanceDetailMemoryWorkbenchSectionProps) {
  const isEmpty = memoryWorkbenchState.isEmpty || !workbench;
  const sectionProps: InstanceDetailMemorySectionProps | null = workbench
    ? {
        memories: workbench.memories,
        hasMemoryEntries: memoryWorkbenchState.hasMemoryEntries,
        dreamingDraft: configDreaming ? dreamingDraft : null,
        dreamingError,
        isSavingDreaming,
        canEditDreamingConfig,
        latestDreamDiaryUpdatedAt: memoryWorkbenchState.dreamDiaryEntries[0]?.updatedAt || null,
        formatWorkbenchLabel,
        getDangerBadge,
        getStatusBadge,
        t,
        onDreamingDraftChange,
        onSaveDreamingConfig,
      }
    : null;

  if (isLoading) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </div>
      </div>
    );
  }

  if (isEmpty || !sectionProps) {
    return <>{emptyState}</>;
  }

  return <InstanceDetailMemorySection {...sectionProps} />;
}
