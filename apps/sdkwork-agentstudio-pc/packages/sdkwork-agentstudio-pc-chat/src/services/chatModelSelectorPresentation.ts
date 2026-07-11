interface ModelSelectorRailVisibilityInput {
  channelCount: number;
  compactModelSelector: boolean;
}

export function shouldShowModelChannelRail(input: ModelSelectorRailVisibilityInput) {
  if (!input.compactModelSelector) {
    return true;
  }

  return input.channelCount > 1;
}
