import type { RuntimeStorageInfo } from './runtime.ts';

export type StoragePlatformInfo = RuntimeStorageInfo;

export interface StorageGetTextRequest {
  profileId?: string | null;
  namespace?: string | null;
  key: string;
}

export interface StorageGetTextResult {
  profileId: string;
  namespace: string;
  key: string;
  value: string | null;
}

export interface StoragePutTextRequest {
  profileId?: string | null;
  namespace?: string | null;
  key: string;
  value: string;
}

export interface StoragePutTextResult {
  profileId: string;
  namespace: string;
  key: string;
}

export interface StorageDeleteRequest {
  profileId?: string | null;
  namespace?: string | null;
  key: string;
}

export interface StorageDeleteResult {
  profileId: string;
  namespace: string;
  key: string;
  existed: boolean;
}

export interface StorageListKeysRequest {
  profileId?: string | null;
  namespace?: string | null;
}

export interface StorageListKeysResult {
  profileId: string;
  namespace: string;
  keys: string[];
}

export interface StoragePlatformAPI {
  getStorageInfo(): Promise<StoragePlatformInfo | null>;
  getText(request: StorageGetTextRequest): Promise<StorageGetTextResult>;
  putText(request: StoragePutTextRequest): Promise<StoragePutTextResult>;
  delete(request: StorageDeleteRequest): Promise<StorageDeleteResult>;
  listKeys(request?: StorageListKeysRequest): Promise<StorageListKeysResult>;
}
