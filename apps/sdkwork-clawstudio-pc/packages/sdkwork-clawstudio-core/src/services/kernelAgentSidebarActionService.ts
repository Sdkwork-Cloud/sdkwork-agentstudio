import {
  getStudioPlatform,
  invalidateStudioPlatformCaches,
  openClawGatewayClient,
} from '@sdkwork/clawstudio-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/clawstudio-types';
import {
  deleteOpenClawAgentFromConfigDocument,
  openClawConfigService,
  serializeOpenClawConfigDocument,
} from './openClawConfigService.ts';

export interface RemoveKernelSidebarAgentRequest {
  instanceId: string;
  agentId: string;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeRequiredString(value: string | null | undefined, fieldName: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`Kernel agent field "${fieldName}" must not be empty.`);
  }

  return normalized;
}

function resolveErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    && (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message.trim();
  }

  return fallbackMessage;
}

function exposesOpenClawGatewayTransport(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  const transports = [
    detail?.connectivity?.primaryTransport,
    detail?.instance.transportKind,
  ];

  return transports.some(
    (transport) => normalizeOptionalString(transport)?.toLowerCase() === 'openclawgatewayws',
  );
}

function resolveWritableOpenClawConfigFile(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!detail) {
    return null;
  }

  return openClawConfigService.resolveInstanceConfigPath(detail, {
    requireWritable: true,
  });
}

async function tryDeleteOpenClawAgentWithGateway(instanceId: string, agentId: string) {
  try {
    const snapshot = await openClawGatewayClient.getConfig(instanceId);
    const nextRaw = deleteOpenClawAgentFromConfigDocument(
      serializeOpenClawConfigDocument(snapshot?.config ?? {}),
      agentId,
    );
    const result = await openClawGatewayClient.setConfig(instanceId, {
      raw: nextRaw,
      baseHash: snapshot?.baseHash,
    });

    if (result?.ok === false) {
      throw new Error(
        resolveErrorMessage(result.error, 'Failed to update the OpenClaw config document.'),
      );
    }

    return {
      ok: true,
      errorMessage: null,
    } as const;
  } catch (error) {
    return {
      ok: false,
      errorMessage: resolveErrorMessage(
        error,
        'Failed to update the OpenClaw config document.',
      ),
    } as const;
  }
}

class DefaultKernelAgentSidebarActionService {
  private async resolveInstanceDetail(instanceId: string) {
    return getStudioPlatform().getInstanceDetail(instanceId);
  }

  async removeAgent(request: RemoveKernelSidebarAgentRequest): Promise<void> {
    const instanceId = normalizeRequiredString(request.instanceId, 'instanceId');
    const agentId = normalizeRequiredString(request.agentId, 'agentId');
    const detail = await this.resolveInstanceDetail(instanceId);

    if (!detail) {
      throw new Error('Instance detail is not available for the selected instance.');
    }

    const writableConfigFile = resolveWritableOpenClawConfigFile(detail);
    const canUseGateway = exposesOpenClawGatewayTransport(detail);
    if (!writableConfigFile && !canUseGateway) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    if (canUseGateway) {
      const deletedWithGateway = await tryDeleteOpenClawAgentWithGateway(instanceId, agentId);
      if (deletedWithGateway.ok) {
        invalidateStudioPlatformCaches(instanceId);
        return;
      }

      if (!writableConfigFile) {
        throw new Error(
          deletedWithGateway.errorMessage
          || 'Writable OpenClaw config file is not available for this instance.',
        );
      }
    }

    if (!writableConfigFile) {
      throw new Error('Writable OpenClaw config file is not available for this instance.');
    }

    await openClawConfigService.deleteAgent({
      configFile: writableConfigFile,
      agentId,
    });
    invalidateStudioPlatformCaches(instanceId);
  }
}

export function createKernelAgentSidebarActionService() {
  return new DefaultKernelAgentSidebarActionService();
}

export const kernelAgentSidebarActionService = createKernelAgentSidebarActionService();
