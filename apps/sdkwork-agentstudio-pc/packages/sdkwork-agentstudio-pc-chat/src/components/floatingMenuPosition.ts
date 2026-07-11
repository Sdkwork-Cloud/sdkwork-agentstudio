export type FloatingAnchorRect = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type FloatingAnchorPoint = {
  x: number;
  y: number;
};

export type FloatingMenuHorizontalStrategy =
  | 'anchor-start'
  | 'anchor-end-plus-offset'
  | 'point';

export type FloatingMenuVerticalStrategy = 'anchor-bottom' | 'anchor-center' | 'point';

export interface ResolveFloatingMenuPositionOptions {
  anchorRect?: FloatingAnchorRect | null;
  anchorPoint?: FloatingAnchorPoint | null;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportPadding?: number;
  horizontalStrategy: FloatingMenuHorizontalStrategy;
  verticalStrategy: FloatingMenuVerticalStrategy;
  offsetX?: number;
  offsetY?: number;
}

function clampCoordinate(value: number, size: number, viewportSize: number, viewportPadding: number) {
  return Math.min(
    Math.max(viewportPadding, value),
    Math.max(viewportPadding, viewportSize - size - viewportPadding),
  );
}

function resolvePreferredLeft({
  anchorRect,
  anchorPoint,
  horizontalStrategy,
}: Pick<
  ResolveFloatingMenuPositionOptions,
  'anchorRect' | 'anchorPoint' | 'horizontalStrategy'
>) {
  if (horizontalStrategy === 'point') {
    return anchorPoint?.x ?? anchorRect?.left ?? 0;
  }

  if (horizontalStrategy === 'anchor-end-plus-offset') {
    return anchorRect?.right ?? anchorPoint?.x ?? 0;
  }

  return anchorRect?.left ?? anchorPoint?.x ?? 0;
}

function resolvePreferredTop({
  anchorRect,
  anchorPoint,
  menuHeight,
  verticalStrategy,
}: Pick<
  ResolveFloatingMenuPositionOptions,
  'anchorRect' | 'anchorPoint' | 'menuHeight' | 'verticalStrategy'
>) {
  if (verticalStrategy === 'point') {
    return anchorPoint?.y ?? anchorRect?.top ?? 0;
  }

  if (verticalStrategy === 'anchor-center') {
    if (!anchorRect) {
      return anchorPoint?.y ?? 0;
    }

    return anchorRect.top + anchorRect.height / 2 - menuHeight / 2;
  }

  return anchorRect?.bottom ?? anchorPoint?.y ?? 0;
}

export function resolveFloatingMenuPosition({
  anchorRect = null,
  anchorPoint = null,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  viewportPadding = 12,
  horizontalStrategy,
  verticalStrategy,
  offsetX = 0,
  offsetY = 0,
}: ResolveFloatingMenuPositionOptions) {
  const preferredLeft =
    resolvePreferredLeft({
      anchorRect,
      anchorPoint,
      horizontalStrategy,
    }) + offsetX;
  const preferredTop =
    resolvePreferredTop({
      anchorRect,
      anchorPoint,
      menuHeight,
      verticalStrategy,
    }) + offsetY;

  return {
    left: clampCoordinate(preferredLeft, menuWidth, viewportWidth, viewportPadding),
    top: clampCoordinate(preferredTop, menuHeight, viewportHeight, viewportPadding),
  };
}
