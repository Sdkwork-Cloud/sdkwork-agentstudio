import { platform } from '@sdkwork/claw-infrastructure';
import {
  listKernelInstallConfigPathCandidates,
  resolveKernelInstallConfigPath,
  type ListKernelInstallConfigPathCandidatesInput,
  type KernelInstallConfigPathResolutionInput,
} from '@sdkwork/local-api-proxy';

export type {
  ListKernelInstallConfigPathCandidatesInput,
  KernelInstallConfigPathResolutionInput,
} from '@sdkwork/local-api-proxy';

class KernelConfigDiscoveryService {
  listInstallConfigPathCandidates(input: ListKernelInstallConfigPathCandidatesInput) {
    return listKernelInstallConfigPathCandidates(input);
  }

  async resolveInstallConfigPath(input: ListKernelInstallConfigPathCandidatesInput) {
    return resolveKernelInstallConfigPath({
      ...input,
      pathExists: (candidate) => platform.pathExists(candidate),
    });
  }
}

export const kernelConfigDiscoveryService = new KernelConfigDiscoveryService();

export {
  listKernelInstallConfigPathCandidates,
  resolveKernelInstallConfigPath,
};
