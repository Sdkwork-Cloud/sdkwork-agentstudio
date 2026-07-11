import { hermesInstanceDetailModuleRegistration } from './hermesInstanceDetailModule.ts';
import { openClawInstanceDetailModuleRegistration } from './openClawInstanceDetailModule.ts';

export * from './types.ts';
export * from './openClawInstanceDetailModule.ts';
export * from './hermesInstanceDetailModule.ts';

export const instanceDetailModuleRegistrations = [
  openClawInstanceDetailModuleRegistration,
  hermesInstanceDetailModuleRegistration,
] as const;
