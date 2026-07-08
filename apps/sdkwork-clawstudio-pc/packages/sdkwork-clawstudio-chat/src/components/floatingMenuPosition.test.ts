import assert from 'node:assert/strict';
import {
  resolveFloatingMenuPosition,
  type FloatingAnchorRect,
} from './floatingMenuPosition.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const anchorRect: FloatingAnchorRect = {
  top: 80,
  left: 240,
  right: 320,
  bottom: 120,
  width: 80,
  height: 40,
};

const sessionActionAnchorRect: FloatingAnchorRect = {
  top: 280,
  left: 240,
  right: 268,
  bottom: 308,
  width: 28,
  height: 28,
};

await runTest(
  'resolveFloatingMenuPosition places create menus directly below the trigger and expands toward the right by default',
  () => {
    assert.deepEqual(
      resolveFloatingMenuPosition({
        anchorRect,
        menuWidth: 320,
        menuHeight: 248,
        viewportWidth: 1440,
        viewportHeight: 900,
        horizontalStrategy: 'anchor-start',
        verticalStrategy: 'anchor-bottom',
        offsetY: 8,
      }),
      {
        left: 240,
        top: 128,
      },
    );
  },
);

await runTest(
  'resolveFloatingMenuPosition clamps overflowing create menus back into the viewport without flipping to left-biased alignment rules',
  () => {
    assert.deepEqual(
      resolveFloatingMenuPosition({
        anchorRect: {
          ...anchorRect,
          left: 1160,
          right: 1240,
        },
        menuWidth: 320,
        menuHeight: 248,
        viewportWidth: 1280,
        viewportHeight: 900,
        horizontalStrategy: 'anchor-start',
        verticalStrategy: 'anchor-bottom',
        offsetY: 8,
      }),
      {
        left: 948,
        top: 128,
      },
    );
  },
);

await runTest(
  'resolveFloatingMenuPosition places session action menus to the right of the trigger and vertically centered',
  () => {
    assert.deepEqual(
      resolveFloatingMenuPosition({
        anchorRect: sessionActionAnchorRect,
        menuWidth: 224,
        menuHeight: 160,
        viewportWidth: 1440,
        viewportHeight: 900,
        horizontalStrategy: 'anchor-end-plus-offset',
        verticalStrategy: 'anchor-center',
        offsetX: 8,
      }),
      {
        left: 276,
        top: 214,
      },
    );
  },
);

await runTest(
  'resolveFloatingMenuPosition respects pointer-opened context menus while still clamping them inside the viewport',
  () => {
    assert.deepEqual(
      resolveFloatingMenuPosition({
        anchorPoint: {
          x: 1180,
          y: 860,
        },
        menuWidth: 224,
        menuHeight: 160,
        viewportWidth: 1280,
        viewportHeight: 900,
        horizontalStrategy: 'point',
        verticalStrategy: 'point',
      }),
      {
        left: 1044,
        top: 728,
      },
    );
  },
);
