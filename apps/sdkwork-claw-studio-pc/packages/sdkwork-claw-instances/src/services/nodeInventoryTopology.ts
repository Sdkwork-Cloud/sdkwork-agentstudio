import type { HostPlatformSnapshot } from '@sdkwork/claw-core';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';

export type NodeInventoryKind =
  | 'localPrimary'
  | 'managedRemote'
  | 'attachedRemote'
  | 'localExternal';

export type NodeInventoryManagement = 'managed' | 'attached';

export interface NodeInventoryInstanceTopologyRecord {
  id: string;
  name: string;
  kind: NodeInventoryKind;
  management: NodeInventoryManagement;
  topologyKind: string;
  runtimeState: string;
  endpoint: string | null;
  host: string | null;
  version: string | null;
  source: 'instance';
  instanceId: string;
  hostPlatformMode: HostPlatformSnapshot['mode'] | null;
  detailPath: string;
}

export function isLoopbackHost(host?: string | null) {
  return ['127.0.0.1', 'localhost', '::1'].includes((host || '').toLowerCase());
}

export function isBuiltInLocalInstance(instance: StudioInstanceRecord) {
  return (
    instance.isBuiltIn &&
    instance.isDefault &&
    instance.deploymentMode === 'local-managed'
  );
}

export function mapInstanceNode(
  instance: StudioInstanceRecord,
  hostStatus: HostPlatformSnapshot | null,
): NodeInventoryInstanceTopologyRecord {
  const builtInLocal = isBuiltInLocalInstance(instance);
  const explicitRemote = instance.deploymentMode === 'remote';
  const localHost = isLoopbackHost(instance.host);
  const attachedRemote = explicitRemote || (!localHost && !builtInLocal);
  const kind: NodeInventoryKind = builtInLocal
    ? 'localPrimary'
    : attachedRemote
      ? 'attachedRemote'
      : 'localExternal';
  const management: NodeInventoryManagement = builtInLocal ? 'managed' : 'attached';
  const topologyKind = builtInLocal
    ? 'localManagedNative'
    : attachedRemote
      ? 'remoteAttachedNode'
      : 'localExternal';

  return {
    id: instance.id,
    name: instance.name,
    kind,
    management,
    topologyKind,
    runtimeState: instance.status,
    endpoint: instance.baseUrl ?? null,
    host: instance.host,
    version: instance.version || null,
    source: 'instance',
    instanceId: instance.id,
    hostPlatformMode: hostStatus?.mode ?? null,
    detailPath: `/instances/${instance.id}`,
  };
}
