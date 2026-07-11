type Setter<T> = (value: T) => void;

type ProviderDeleteStateSetter = Setter<string | null>;

export interface InstanceDetailProviderDeleteStateBindings {
  setProviderDeleteId: ProviderDeleteStateSetter;
  setProviderModelDeleteId: ProviderDeleteStateSetter;
  clearProviderDeleteId: () => void;
  clearProviderModelDeleteId: () => void;
}

export function createInstanceDetailProviderDeleteStateBindings(args: {
  setProviderDeleteId: ProviderDeleteStateSetter;
  setProviderModelDeleteId: ProviderDeleteStateSetter;
}): InstanceDetailProviderDeleteStateBindings {
  return {
    setProviderDeleteId: args.setProviderDeleteId,
    setProviderModelDeleteId: args.setProviderModelDeleteId,
    clearProviderDeleteId: () => args.setProviderDeleteId(null),
    clearProviderModelDeleteId: () => args.setProviderModelDeleteId(null),
  };
}
