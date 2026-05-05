export {
  configurePlatformBridge,
  getInternalPlatform,
  getKernelPlatform,
  getInstallerPlatform,
  getManagePlatform,
  getPlatformBridge,
  getRuntimePlatform,
  getStoragePlatform,
  getStudioPlatform,
  invalidateStudioPlatformCaches,
  internal,
  installer,
  kernel,
  manage,
  platform,
  runtime,
  storage,
  studio,
} from './platform/registry.ts';
export { openExternalUrl } from './platform/openExternalUrl.ts';
export { openDiagnosticPath } from './platform/openDiagnosticPath.ts';
export { WebComponentPlatform } from './platform/webComponents.ts';
export {
  bootstrapServerBrowserPlatformBridge,
  configureServerBrowserPlatformBridge,
  createServerBrowserPlatformBridge,
  readServerBrowserPlatformBridgeConfig,
  SERVER_API_BASE_PATH_META_NAME,
  SERVER_BROWSER_BOOTSTRAP_DESCRIPTOR_PATH,
  SERVER_BROWSER_SESSION_TOKEN_META_NAME,
  SERVER_HOST_MODE_META_NAME,
  SERVER_INTERNAL_BASE_PATH_META_NAME,
  SERVER_MANAGE_BASE_PATH_META_NAME,
} from './platform/serverBrowserBridge.ts';
export {
  createBrowserSessionAwareFetch,
  SERVER_BROWSER_SESSION_HEADER_NAME,
} from './platform/browserSessionFetch.ts';
export { resolveBrowserStorage } from './platform/safeBrowserStorage.ts';
export type { BrowserStorageName } from './platform/safeBrowserStorage.ts';
export { WebInternalPlatform, DEFAULT_INTERNAL_BASE_PATH } from './platform/webInternal.ts';
export { WebKernelPlatform } from './platform/webKernel.ts';
export { WebManagePlatform, DEFAULT_MANAGE_BASE_PATH } from './platform/webManage.ts';
export { WebPlatform } from './platform/web.ts';
export { WebHostedStudioPlatform, DEFAULT_STUDIO_API_BASE_PATH } from './platform/webHostedStudio.ts';
export { WebStoragePlatform } from './platform/webStorage.ts';
export {
  assertValidStudioCreateInstanceKernelPolicy,
  getStudioCreateInstanceKernelPolicyError,
} from './platform/contracts/studioKernelPolicy.ts';
export * from './config/env.ts';
export * from './auth/authSession.ts';
export * from './services/fileDialogService.ts';
export * from './services/installerService.ts';
export * from './services/openClawGatewayClient.ts';
export * from './updates/contracts.ts';
export * from './updates/updateClient.ts';
export type * from './platform/index.ts';
export {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  canonicalizeBuiltInOpenClawInstanceId,
  isBuiltInOpenClawInstanceId,
  matchesBuiltInOpenClawInstanceId,
} from './platform/index.ts';
