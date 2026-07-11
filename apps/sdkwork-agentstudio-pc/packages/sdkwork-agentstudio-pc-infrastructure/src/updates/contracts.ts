export type AppUpdateRuntime = 'TAURI';

export interface AppUpdateCheckRequest {
  appId: number;
  runtime: AppUpdateRuntime;
  platform: string;
  architecture: string;
  currentVersion: string;
  buildNumber?: string;
  releaseChannel?: string;
  packageName?: string;
  bundleId?: string;
  deviceId?: string;
  osVersion?: string;
  locale?: string;
  capabilities?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AppInstallPackage {
  id?: number | string;
  name?: string;
  sourceType?: string;
  packageFormat?: string;
  platform?: string;
  url?: string;
  repositoryUrl?: string;
  branch?: string;
  tag?: string;
  commitId?: string;
  checksumAlgorithm?: string;
  checksum?: string;
  architecture?: string;
  sizeBytes?: number;
  enabled?: boolean;
}

export interface AppUpdateCheckResult {
  hasUpdate: boolean;
  updateRequired: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  targetVersion: string;
  releaseChannel?: string;
  updateMode?: string;
  deliveryType?: string;
  updateUrl?: string;
  title?: string;
  summary?: string;
  content?: string;
  highlights: string[];
  sizeBytes?: number;
  publishedAt?: string;
  resolvedPackage?: AppInstallPackage | null;
  storeUrl?: string;
  storeType?: string;
  frameworkPayload?: Record<string, unknown> | null;
}

export interface AppUpdateClientOptions {
  env?: {
    api: {
      baseUrl: string;
      timeout: number;
    };
    auth?: {
      accessToken?: string;
    };
  };
}
