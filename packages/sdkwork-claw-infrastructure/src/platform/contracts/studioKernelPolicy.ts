import type { StudioInstanceDeploymentMode, StudioRuntimeKind } from '@sdkwork/claw-types';

interface StudioCreateInstanceKernelPolicyInput {
  runtimeKind: StudioRuntimeKind;
  deploymentMode: StudioInstanceDeploymentMode;
}

function normalizeRuntimeKind(runtimeKind: StudioRuntimeKind) {
  return String(runtimeKind ?? '').trim().toLowerCase();
}

export function getStudioCreateInstanceKernelPolicyError(
  input: StudioCreateInstanceKernelPolicyInput,
): string | null {
  void normalizeRuntimeKind(input.runtimeKind);
  void input.deploymentMode;

  return null;
}

export function assertValidStudioCreateInstanceKernelPolicy(
  input: StudioCreateInstanceKernelPolicyInput,
) {
  const policyError = getStudioCreateInstanceKernelPolicyError(input);
  if (policyError) {
    throw new Error(policyError);
  }
}
