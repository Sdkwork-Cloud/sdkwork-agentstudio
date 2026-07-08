import { createUserCenterStoragePlan } from './userCenterStorage.ts';

export const CLAW_STUDIO_USER_CENTER_NAMESPACE = 'claw-studio';
export const CLAW_STUDIO_USER_CENTER_ROUTES = Object.freeze({
  authBasePath: '/login',
  userRoutePath: '/user',
  vipRoutePath: '/vip',
});
export const CLAW_STUDIO_USER_CENTER_RUNTIME_ENV_PREFIX =
  'VITE_CLAW_STUDIO_USER_CENTER_';
export const CLAW_STUDIO_USER_CENTER_GATEWAY_ENV_PREFIX =
  'CLAW_STUDIO_USER_CENTER_';
export const CLAW_STUDIO_USER_CENTER_STORAGE_PLAN = createUserCenterStoragePlan(
  CLAW_STUDIO_USER_CENTER_NAMESPACE,
);
