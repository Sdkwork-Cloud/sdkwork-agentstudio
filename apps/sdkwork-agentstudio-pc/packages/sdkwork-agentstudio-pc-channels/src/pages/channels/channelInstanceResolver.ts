interface ChannelDirectoryInstance {
  id: string;
}

interface ResolveChannelsPageInstanceIdParams {
  activeInstanceId: string | null;
  listInstances: () => Promise<ChannelDirectoryInstance[]>;
  setActiveInstanceId: (id: string | null) => void;
}

export async function resolveChannelsPageInstanceId({
  activeInstanceId,
  listInstances,
  setActiveInstanceId,
}: ResolveChannelsPageInstanceIdParams): Promise<string | null> {
  if (activeInstanceId) {
    return activeInstanceId;
  }

  const instances = await listInstances();
  const nextInstanceId = instances[0]?.id ?? null;
  if (nextInstanceId) {
    setActiveInstanceId(nextInstanceId);
  }

  return nextInstanceId;
}
