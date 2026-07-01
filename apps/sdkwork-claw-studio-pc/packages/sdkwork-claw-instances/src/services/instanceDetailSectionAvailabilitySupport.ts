import type { InstanceWorkbenchSectionId, InstanceWorkbenchSnapshot } from '../types/index.ts';

type TranslateFunction = (key: string, options?: Record<string, unknown>) => string;

export interface InstanceDetailSectionAvailabilityRenderArgs {
  workbench: Pick<InstanceWorkbenchSnapshot, 'sectionAvailability'> | null;
  sectionId: InstanceWorkbenchSectionId;
  fallbackKey: string;
  t: TranslateFunction;
  formatWorkbenchLabel: (value: string) => string;
  getCapabilityTone: (status: string) => string;
}

export interface CreateInstanceDetailSectionAvailabilityRendererArgs<T> {
  workbench: Pick<InstanceWorkbenchSnapshot, 'sectionAvailability'> | null;
  t: TranslateFunction;
  formatWorkbenchLabel: (value: string) => string;
  getCapabilityTone: (status: string) => string;
  renderAvailability: (args: InstanceDetailSectionAvailabilityRenderArgs) => T;
}

export function createInstanceDetailSectionAvailabilityRenderer<T>(
  args: CreateInstanceDetailSectionAvailabilityRendererArgs<T>,
) {
  return (sectionId: InstanceWorkbenchSectionId, fallbackKey: string) =>
    args.renderAvailability({
      workbench: args.workbench,
      sectionId,
      fallbackKey,
      t: args.t,
      formatWorkbenchLabel: args.formatWorkbenchLabel,
      getCapabilityTone: args.getCapabilityTone,
    });
}
