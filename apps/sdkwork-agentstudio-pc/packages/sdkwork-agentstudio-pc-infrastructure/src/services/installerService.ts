import type {
  InstallCatalogEntry,
  InstallCatalogQuery,
  InstallDependencyRequest,
  InstallDependencyResult,
  InstallAssessmentResult,
  InstallProgressEvent,
  InstallRequest,
  InstallResult,
  UninstallRequest,
  UninstallResult,
} from '../platform/contracts/installer.ts';
import type { RuntimeEventUnsubscribe } from '../platform/contracts/runtime.ts';
import { installer } from '../platform/registry.ts';

export const installerService = {
  listInstallCatalog: async (
    query?: InstallCatalogQuery,
  ): Promise<InstallCatalogEntry[]> => {
    return installer.listInstallCatalog(query);
  },
  inspectInstall: async (
    request: InstallRequest,
  ): Promise<InstallAssessmentResult> => {
    return installer.inspectInstall(request);
  },
  runInstallDependencies: async (
    request: InstallDependencyRequest,
  ): Promise<InstallDependencyResult> => {
    return installer.runInstallDependencies(request);
  },
  runInstall: async (request: InstallRequest): Promise<InstallResult> => {
    return installer.runInstall(request);
  },
  runUninstall: async (request: UninstallRequest): Promise<UninstallResult> => {
    return installer.runUninstall(request);
  },
  subscribeInstallProgress: async (
    listener: (event: InstallProgressEvent) => void,
  ): Promise<RuntimeEventUnsubscribe> => {
    return installer.subscribeInstallProgress(listener);
  },
};
