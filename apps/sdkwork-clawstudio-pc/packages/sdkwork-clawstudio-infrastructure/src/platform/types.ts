export interface PlatformFileEntry {
  path: string;
  name: string;
  kind: 'file' | 'directory';
  size: number | null;
  extension: string | null;
}

export interface PlatformPathInfo {
  path: string;
  name: string;
  kind: 'file' | 'directory' | 'missing';
  size: number | null;
  extension: string | null;
  exists: boolean;
  lastModifiedMs: number | null;
}

export interface PlatformDialogFilter {
  name: string;
  extensions: string[];
}

export interface PlatformSelectFileOptions {
  multiple?: boolean;
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: PlatformDialogFilter[];
}

export interface PlatformSaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: PlatformDialogFilter[];
}

export interface PlatformCapturedScreenshot {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  width?: number;
  height?: number;
  displayName?: string;
}

export interface PlatformFetchedRemoteUrl {
  url: string;
  bytes: Uint8Array;
  contentType?: string;
  fileName?: string;
}

export interface PlatformNotificationRequest {
  title: string;
  body?: string;
  tag?: string;
}

export type PlatformWindowStateUnsubscribe = () => void | Promise<void>;

export interface PlatformAPI {
  getPlatform(): 'web' | 'desktop';

  getDeviceId(): Promise<string>;

  setStorage(key: string, value: string): Promise<void>;
  getStorage(key: string): Promise<string | null>;

  copy(text: string): Promise<void>;
  showNotification(notification: PlatformNotificationRequest): Promise<void>;
  openExternal(url: string): Promise<void>;
  openPath?(path: string): Promise<void>;
  revealPath?(path: string): Promise<void>;
  supportsNativeScreenshot(): boolean;
  captureScreenshot(): Promise<PlatformCapturedScreenshot | null>;
  fetchRemoteUrl(url: string): Promise<PlatformFetchedRemoteUrl>;

  selectFile(options?: PlatformSelectFileOptions): Promise<string[]>;
  saveFile(data: Blob, filename: string, options?: PlatformSaveFileOptions): Promise<void>;

  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  restoreWindow(): Promise<void>;
  isWindowMaximized(): Promise<boolean>;
  subscribeWindowMaximized(
    listener: (isMaximized: boolean) => void,
  ): Promise<PlatformWindowStateUnsubscribe>;
  closeWindow(): Promise<void>;

  listDirectory(path?: string): Promise<PlatformFileEntry[]>;
  pathExists(path: string): Promise<boolean>;
  pathExistsForUserTooling(path: string): Promise<boolean>;
  getPathInfo(path: string): Promise<PlatformPathInfo>;
  createDirectory(path: string): Promise<void>;
  removePath(path: string): Promise<void>;
  copyPath(sourcePath: string, destinationPath: string): Promise<void>;
  movePath(sourcePath: string, destinationPath: string): Promise<void>;

  readBinaryFile(path: string): Promise<Uint8Array>;
  writeBinaryFile(path: string, content: Uint8Array | number[]): Promise<void>;
  readFile(path: string): Promise<string>;
  readFileForUserTooling(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}
