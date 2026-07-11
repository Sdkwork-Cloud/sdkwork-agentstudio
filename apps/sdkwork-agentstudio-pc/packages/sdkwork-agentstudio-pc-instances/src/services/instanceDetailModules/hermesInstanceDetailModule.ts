import {
  createLazyInstanceDetailModulePage,
  type SupportedInstanceDetailModuleRegistration,
} from './types.ts';
import { createHermesInstanceDetailModulePayload } from '../instanceDetailModulePayload.ts';

export const hermesInstanceDetailModuleRegistration: SupportedInstanceDetailModuleRegistration = {
  kernelId: 'hermes',
  module: {
    chrome: 'kernelOwned',
    loadModulePayload: async (_instanceId, context) =>
      createHermesInstanceDetailModulePayload(await context.loadBaseDetail()),
    DetailPage: createLazyInstanceDetailModulePage(async () => {
      const hermesInstanceDetailPageModule = await import('../../pages/HermesInstanceDetailPage.tsx');
      return {
        default: hermesInstanceDetailPageModule.HermesInstanceDetailPage,
      };
    }),
  },
};
