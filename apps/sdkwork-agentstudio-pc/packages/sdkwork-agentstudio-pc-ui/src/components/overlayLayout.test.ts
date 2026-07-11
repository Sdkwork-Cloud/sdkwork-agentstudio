import assert from 'node:assert/strict';
import {
  APP_HEADER_HEIGHT_PX,
  OVERLAY_FRAME_GAP_PX,
  getOverlayContainerClassName,
  getOverlayContainerStyle,
  getOverlaySurfaceStyle,
} from './overlayLayout.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('overlay layout keeps the app header visible and reserves breathing room', () => {
  assert.equal(APP_HEADER_HEIGHT_PX, 48);
  assert.equal(OVERLAY_FRAME_GAP_PX, 16);
  assert.deepEqual(getOverlayContainerStyle(), {
    paddingTop: '64px',
    paddingRight: '16px',
    paddingBottom: '16px',
    paddingLeft: '16px',
  });
});

runTest('overlay surface height matches the header-safe viewport', () => {
  assert.deepEqual(getOverlaySurfaceStyle(), {
    maxHeight: 'calc(100dvh - 80px)',
  });
  assert.deepEqual(getOverlaySurfaceStyle(24), {
    maxHeight: 'calc(100dvh - 104px)',
  });
});

runTest('overlay container alignment supports top-aligned large modals without affecting defaults', () => {
  assert.equal(getOverlayContainerClassName('drawer'), 'items-stretch justify-end');
  assert.equal(
    getOverlayContainerClassName('drawer', 'center', 'left'),
    'items-stretch justify-start',
  );
  assert.equal(
    getOverlayContainerClassName('drawer', 'center', 'right'),
    'items-stretch justify-end',
  );
  assert.equal(
    getOverlayContainerClassName('modal'),
    'items-start justify-center lg:items-center',
  );
  assert.equal(
    getOverlayContainerClassName('modal', 'top'),
    'items-start justify-center',
  );
});
