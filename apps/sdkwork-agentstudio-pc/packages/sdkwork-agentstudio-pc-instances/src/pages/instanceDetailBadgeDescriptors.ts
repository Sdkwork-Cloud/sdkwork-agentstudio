export interface InstanceDetailBadgeInput<TValue extends string = string> {
  slot: string;
  value: TValue;
}

export interface InstanceDetailBadgeDescriptor<TValue extends string = string> {
  key: string;
  value: TValue;
}

export function buildInstanceDetailBadgeDescriptors<TValue extends string>(
  entryId: string,
  badges: readonly InstanceDetailBadgeInput<TValue>[],
): InstanceDetailBadgeDescriptor<TValue>[] {
  return badges.map((badge) => ({
    key: `${entryId}-${badge.slot}-${badge.value}`,
    value: badge.value,
  }));
}
