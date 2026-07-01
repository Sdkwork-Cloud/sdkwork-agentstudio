import { useEffect } from 'react';
import {
  detectChatCronActivityNotification,
  type ChatCronActivityNotification,
  useChatStore,
} from '@sdkwork/claw-chat';
import { platform, settingsService } from '@sdkwork/claw-core';
import { toast } from 'sonner';
import { createChatCronActivityNotificationRuntime } from './chatCronActivityNotificationRuntime';

function shouldShowSystemNotification() {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState !== 'visible' || !document.hasFocus();
}

async function showSystemNotification(notification: ChatCronActivityNotification) {
  await platform.showNotification({
    title: notification.title,
    body: notification.body,
    tag: `chat-cron:${notification.sessionId}:${notification.kind}`,
  });
}

export function ChatCronActivityNotifications() {
  useEffect(() => {
    return createChatCronActivityNotificationRuntime({
      detectNotification: detectChatCronActivityNotification,
      subscribe: useChatStore.subscribe,
      loadPreferences: () => settingsService.getPreferences(),
      showToast: (notification) => {
        const toastOptions = {
          description: notification.body,
          duration: notification.kind === 'completed' ? 6000 : 5000,
        };
        if (notification.kind === 'completed') {
          toast.success(notification.title, toastOptions);
          return;
        }

        toast(notification.title, toastOptions);
      },
      shouldShowSystemNotification,
      showSystemNotification,
    });
  }, []);

  return null;
}
