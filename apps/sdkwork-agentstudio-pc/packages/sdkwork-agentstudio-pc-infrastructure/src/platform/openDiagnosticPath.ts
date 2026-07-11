import { platform } from './registry.ts';

export type DiagnosticPathOpenMode = 'open' | 'reveal';
const DIAGNOSTIC_PATH_UNAVAILABLE_MESSAGE =
  'Opening diagnostic files is not available for the active platform.';

export interface OpenDiagnosticPathDependencies {
  mode?: DiagnosticPathOpenMode;
  openPath?: (path: string) => Promise<void> | void;
  revealPath?: (path: string) => Promise<void> | void;
}

function createDiagnosticPathUnavailableError() {
  return new Error(DIAGNOSTIC_PATH_UNAVAILABLE_MESSAGE);
}

function isUnsupportedPlatformActionError(error: unknown) {
  return (
    error instanceof Error && /is not available for the active platform bridge\.$/.test(error.message)
  );
}

export async function openDiagnosticPath(
  path: string,
  dependencies: OpenDiagnosticPathDependencies = {},
): Promise<void> {
  const resolvedPath = path.trim();
  if (!resolvedPath) {
    throw new Error('Diagnostic path is required.');
  }

  const mode = dependencies.mode ?? 'open';
  const openPathAction = dependencies.openPath ?? platform.openPath;
  const revealPathAction = dependencies.revealPath ?? platform.revealPath;

  if (mode === 'reveal' && revealPathAction) {
    try {
      await revealPathAction(resolvedPath);
      return;
    } catch (error) {
      if (!openPathAction) {
        if (isUnsupportedPlatformActionError(error)) {
          throw createDiagnosticPathUnavailableError();
        }
        throw error;
      }
    }
  }

  if (openPathAction) {
    try {
      await openPathAction(resolvedPath);
      return;
    } catch (error) {
      if (isUnsupportedPlatformActionError(error)) {
        throw createDiagnosticPathUnavailableError();
      }
      throw error;
    }
  }

  throw createDiagnosticPathUnavailableError();
}
