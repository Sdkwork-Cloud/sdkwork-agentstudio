import {
  createLazyInstanceDetailModulePage,
  type SupportedInstanceDetailModuleRegistration,
} from './types.ts';
import { createOpenClawInstanceDetailModulePayload } from '../instanceDetailModulePayload.ts';
import { instanceWorkbenchService } from '../instanceWorkbenchService.ts';

export const openClawInstanceDetailModuleRegistration: SupportedInstanceDetailModuleRegistration = {
  kernelId: 'openclaw',
  module: {
    chrome: 'sharedWorkbench',
    loadModulePayload: async (instanceId: string) =>
      createOpenClawInstanceDetailModulePayload(
        await instanceWorkbenchService.getInstanceWorkbench(instanceId),
      ),
    DetailPage: createLazyInstanceDetailModulePage(async () => {
      const openClawInstanceDetailPageModule = await import(
        '../../pages/OpenClawInstanceDetailPage.tsx'
      );
      return {
        default: openClawInstanceDetailPageModule.OpenClawInstanceDetailPage,
      };
    }),
  },
};
