import type {
  InstallCatalogEntry,
  InstallCatalogQuery,
  InstallDependencyRequest,
  InstallDependencyResult,
  InstallAssessmentResult,
  InstallRequest,
  InstallResult,
  UninstallRequest,
  UninstallResult,
  InstallerPlatformAPI,
} from './contracts/installer.ts';
import type { RuntimeEventUnsubscribe } from './contracts/runtime.ts';

export class WebInstallerPlatform implements InstallerPlatformAPI {
  async listInstallCatalog(
    _query?: InstallCatalogQuery,
  ): Promise<InstallCatalogEntry[]> {
    return [];
  }

  async inspectInstall(_request: InstallRequest): Promise<InstallAssessmentResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would inspect the installation environment through the desktop runtime.',
    );
  }

  async runInstallDependencies(
    _request: InstallDependencyRequest,
  ): Promise<InstallDependencyResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would install missing dependencies through the desktop runtime.',
    );
  }

  async runInstall(_request: InstallRequest): Promise<InstallResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would start the desktop-managed install flow.',
    );
  }

  async runUninstall(_request: UninstallRequest): Promise<UninstallResult> {
    throw new Error(
      'Tauri API is not available in this web preview environment. In a real Tauri app, this would run uninstall through the desktop runtime.',
    );
  }

  async subscribeInstallProgress(): Promise<RuntimeEventUnsubscribe> {
    return () => {};
  }
}
