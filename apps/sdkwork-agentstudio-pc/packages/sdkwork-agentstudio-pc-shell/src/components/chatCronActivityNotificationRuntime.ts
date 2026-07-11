export type ChatCronActivityNotificationSession = {
  id: string;
  title?: string;
  titleSource?: 'default' | 'preview' | 'explicit' | 'firstUser';
  lastMessagePreview?: string;
  runId?: string | null;
  messages?: Array<{
    role?: string;
    content?: string;
  }>;
};

export interface ChatCronActivityNotification {
  kind: 'started' | 'completed';
  title: string;
  body: string;
  sessionId: string;
}

export interface ChatCronActivityNotificationPreferences {
  notifications: {
    newMessages: boolean;
  };
}

export interface ChatCronActivityNotificationStoreSnapshot
{
  sessions: ChatCronActivityNotificationSession[];
}

export interface DeliverChatCronActivityNotificationsOptions {
  notifications: ChatCronActivityNotification[];
  loadPreferences: () => Promise<ChatCronActivityNotificationPreferences>;
  showToast: (notification: ChatCronActivityNotification) => void;
  shouldShowSystemNotification: () => boolean;
  showSystemNotification: (notification: ChatCronActivityNotification) => Promise<void>;
}

export interface CreateChatCronActivityNotificationRuntimeOptions
  extends Omit<DeliverChatCronActivityNotificationsOptions, 'notifications'> {
  detectNotification: (params: {
    previousSession?: ChatCronActivityNotificationSession | null;
    nextSession?: ChatCronActivityNotificationSession | null;
  }) => ChatCronActivityNotification | null;
  subscribe: (
    listener: (
      state: ChatCronActivityNotificationStoreSnapshot,
      previousState?: ChatCronActivityNotificationStoreSnapshot,
    ) => void,
  ) => () => void;
}

function buildSessionMap(sessions: ChatCronActivityNotificationSession[]) {
  return new Map(sessions.map((session) => [session.id, session] as const));
}

export function collectChatCronActivityNotifications(params: {
  previousSessions?: ChatCronActivityNotificationSession[] | null;
  nextSessions?: ChatCronActivityNotificationSession[] | null;
  detectNotification: CreateChatCronActivityNotificationRuntimeOptions['detectNotification'];
}) {
  const previousSessions = params.previousSessions ?? [];
  const nextSessions = params.nextSessions ?? [];
  const notifications: ChatCronActivityNotification[] = [];
  const previousSessionMap = buildSessionMap(previousSessions);

  for (const nextSession of nextSessions) {
    const previousSession = previousSessionMap.get(nextSession.id);
    const notification = params.detectNotification({
      previousSession,
      nextSession,
    });
    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
}

async function areChatCronNotificationsEnabled(
  loadPreferences: DeliverChatCronActivityNotificationsOptions['loadPreferences'],
) {
  try {
    const preferences = await loadPreferences();
    return preferences.notifications.newMessages;
  } catch {
    return true;
  }
}

export async function deliverChatCronActivityNotifications(
  options: DeliverChatCronActivityNotificationsOptions,
) {
  if (options.notifications.length === 0) {
    return;
  }

  if (!(await areChatCronNotificationsEnabled(options.loadPreferences))) {
    return;
  }

  const showSystemNotification = options.shouldShowSystemNotification();

  for (const notification of options.notifications) {
    options.showToast(notification);
    if (!showSystemNotification) {
      continue;
    }

    await options.showSystemNotification(notification).catch(() => {
      // Notifications are best-effort and should never break chat state updates.
    });
  }
}

export function createChatCronActivityNotificationRuntime(
  options: CreateChatCronActivityNotificationRuntimeOptions,
) {
  return options.subscribe((state, previousState) => {
    const previousSessions = previousState?.sessions ?? [];
    const nextSessions = state.sessions;
    if (previousSessions === nextSessions) {
      return;
    }

    const notifications = collectChatCronActivityNotifications({
      previousSessions,
      nextSessions,
      detectNotification: options.detectNotification,
    });
    if (notifications.length === 0) {
      return;
    }

    void deliverChatCronActivityNotifications({
      notifications,
      loadPreferences: options.loadPreferences,
      showToast: options.showToast,
      shouldShowSystemNotification: options.shouldShowSystemNotification,
      showSystemNotification: options.showSystemNotification,
    });
  });
}
