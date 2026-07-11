import { platform } from './registry.ts';

export interface OpenExternalUrlDependencies {
  openExternal?: (url: string) => Promise<void> | void;
  openWindow?: (
    url: string,
    target?: string,
    features?: string,
  ) => Window | null | void;
}

export async function openExternalUrl(
  url: string,
  dependencies: OpenExternalUrlDependencies = {},
): Promise<void> {
  const openExternal = dependencies.openExternal ?? ((nextUrl: string) => platform.openExternal(nextUrl));
  const openWindow =
    dependencies.openWindow ?? (typeof window !== 'undefined' ? window.open.bind(window) : undefined);

  try {
    await openExternal(url);
  } catch (error) {
    if (!openWindow) {
      throw error;
    }

    openWindow(url, '_blank', 'noopener,noreferrer');
  }
}
