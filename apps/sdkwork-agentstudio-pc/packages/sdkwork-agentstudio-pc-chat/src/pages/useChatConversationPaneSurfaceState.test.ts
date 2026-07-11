import assert from 'node:assert/strict';

import { useChatConversationPaneSurfaceState } from './useChatConversationPaneSurfaceState.ts';

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

const t = (key: string, options?: Record<string, unknown>) =>
  `${key}${options ? `:${JSON.stringify(options)}` : ''}`;

await runTest(
  'useChatConversationPaneSurfaceState surfaces runtime errors as inline conversation notices for message mode',
  () => {
    assert.deepEqual(
      useChatConversationPaneSurfaceState({
        t,
        activeInstanceId: 'instance-a',
        hasResolvedInstances: true,
        hasAvailableInstances: true,
        selectedAgentName: 'Agent A',
        isUnsupportedRoute: false,
        isChatSupportedRoute: true,
        effectiveLastError: 'Failed to load history',
        conversationBodyMode: 'messages',
      }),
      {
        surfaceState: {
          mode: 'messages',
        },
        inlineNoticeMessage: 'Failed to load history',
        showComposer: true,
      },
    );
  },
);

await runTest(
  'useChatConversationPaneSurfaceState keeps unsupported route errors on the dedicated unsupported surface instead of the inline notice rail',
  () => {
    assert.deepEqual(
      useChatConversationPaneSurfaceState({
        t,
        activeInstanceId: 'instance-a',
        hasResolvedInstances: true,
        hasAvailableInstances: true,
        selectedAgentName: 'Agent A',
        isUnsupportedRoute: true,
        isChatSupportedRoute: false,
        effectiveLastError: 'Unsupported route',
        conversationBodyMode: 'empty',
      }),
      {
        surfaceState: {
          mode: 'unsupported',
          title: 'chat.page.unsupportedRouteTitle',
          description: 'Unsupported route',
          actionLabel: 'chat.page.manageInstances',
        },
        inlineNoticeMessage: null,
        showComposer: false,
      },
    );
  },
);
