import {
  type PlatformSaveFileOptions,
  type PlatformSelectFileOptions,
} from '../platform/types.ts';
import { platform } from '../platform/registry.ts';

export type FileDialogSelectOptions = PlatformSelectFileOptions;
export type FileDialogSaveOptions = PlatformSaveFileOptions;

function firstOrNull(paths: string[]): string | null {
  return paths[0] ?? null;
}

export const fileDialogService = {
  async selectFiles(options?: FileDialogSelectOptions): Promise<string[]> {
    return platform.selectFile(options);
  },

  async selectFile(options?: Omit<FileDialogSelectOptions, 'multiple'>): Promise<string | null> {
    const paths = await platform.selectFile({
      ...options,
      multiple: false,
    });

    return firstOrNull(paths);
  },

  async selectDirectory(
    options?: Omit<FileDialogSelectOptions, 'multiple' | 'directory'>,
  ): Promise<string | null> {
    const paths = await platform.selectFile({
      ...options,
      directory: true,
      multiple: false,
    });

    return firstOrNull(paths);
  },

  async selectDirectories(
    options?: Omit<FileDialogSelectOptions, 'directory'>,
  ): Promise<string[]> {
    return platform.selectFile({
      ...options,
      directory: true,
      multiple: options?.multiple ?? true,
    });
  },

  async saveFile(data: Blob, filename: string, options?: FileDialogSaveOptions): Promise<void> {
    await platform.saveFile(data, filename, options);
  },
};
