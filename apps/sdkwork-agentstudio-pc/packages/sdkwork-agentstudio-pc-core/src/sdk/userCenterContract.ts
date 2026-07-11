import { createUserCenterStoragePlan } from './userCenterStorage.ts';

export const AGENT_STUDIO_USER_CENTER_NAMESPACE = 'agent-studio';
export const AGENT_STUDIO_USER_CENTER_ROUTES = Object.freeze({
  authBasePath: '/login',
  userRoutePath: '/user',
  vipRoutePath: '/vip',
});
export const AGENT_STUDIO_USER_CENTER_RUNTIME_ENV_PREFIX =
  'VITE_AGENT_STUDIO_USER_CENTER_';
export const AGENT_STUDIO_USER_CENTER_GATEWAY_ENV_PREFIX =
  'AGENT_STUDIO_USER_CENTER_';
export const AGENT_STUDIO_USER_CENTER_STORAGE_PLAN = createUserCenterStoragePlan(
  AGENT_STUDIO_USER_CENTER_NAMESPACE,
);
