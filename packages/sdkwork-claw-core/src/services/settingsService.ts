import { unwrapAppSdkResponse, type AppSdkEnvelope } from '../sdk/appSdkResult.ts';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}

export interface UserPreferences {
  general: {
    launchOnStartup: boolean;
    startMinimized: boolean;
    compactModelSelector: boolean;
  };
  notifications: {
    systemUpdates: boolean;
    taskFailures: boolean;
    securityAlerts: boolean;
    taskCompletions: boolean;
    newMessages: boolean;
  };
  privacy: {
    shareUsageData: boolean;
    personalizedRecommendations: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    loginAlerts: boolean;
  };
}

export interface ISettingsService {
  getProfile(): Promise<UserProfile>;
  updateProfile(profile: UserProfile): Promise<UserProfile>;
  updatePassword(current: string, newPass: string): Promise<void>;
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences>;
}

interface SettingsSdkClient {
  user: {
    getUserProfile(): Promise<AppSdkEnvelope<RemoteUserProfilePayload> | RemoteUserProfilePayload>;
    updateUserProfile(body: {
      nickname?: string;
      email: string;
    }): Promise<AppSdkEnvelope<RemoteUserProfileUpdatePayload> | RemoteUserProfileUpdatePayload>;
    changePassword(body: {
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    }): Promise<AppSdkEnvelope<null> | null>;
  };
  notification: {
    getNotificationSettings(): Promise<AppSdkEnvelope<RemoteNotificationSettings> | RemoteNotificationSettings>;
    updateNotificationSettings(
      body: RemoteNotificationSettings,
    ): Promise<AppSdkEnvelope<RemoteNotificationSettings> | RemoteNotificationSettings>;
    updateTypeSettings(
      type: string | number,
      body: RemoteNotificationTypeSettingsUpdate,
    ): Promise<AppSdkEnvelope<null> | null>;
  };
}

export interface CreateSettingsServiceOptions {
  getClient?: () => SettingsSdkClient | Promise<SettingsSdkClient>;
}

type SettingsOverlay = Pick<
  UserPreferences,
  'general' | 'notifications' | 'privacy' | 'security'
>;

interface RemoteUserProfilePayload {
  nickname?: string;
  email?: string;
  avatar?: string;
}

interface RemoteUserProfileUpdatePayload {
  email?: string;
  avatar?: string;
}

const SETTINGS_OVERLAY_STORAGE_KEY = 'claw-studio-settings-overlay';

const DEFAULT_GENERAL_PREFERENCES: UserPreferences['general'] = {
  launchOnStartup: false,
  startMinimized: false,
  compactModelSelector: true,
};

const DEFAULT_NOTIFICATION_PREFERENCES: UserPreferences['notifications'] = {
  systemUpdates: true,
  taskFailures: true,
  securityAlerts: true,
  taskCompletions: true,
  newMessages: true,
};

const DEFAULT_PRIVACY_PREFERENCES: UserPreferences['privacy'] = {
  shareUsageData: false,
  personalizedRecommendations: false,
};

const DEFAULT_SECURITY_PREFERENCES: UserPreferences['security'] = {
  twoFactorAuth: false,
  loginAlerts: true,
};

interface RemoteNotificationTypeSettings {
  enablePush?: boolean;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
}

interface RemoteNotificationTypeSettingsUpdate {
  type: string;
  enablePush?: boolean;
  enableInApp?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
}

interface RemoteNotificationSettings {
  enablePush?: boolean;
  enableEmail?: boolean;
  enableSms?: boolean;
  enableInApp?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  notificationSound?: string;
  vibrationEnabled?: boolean;
  typeSettings?: Record<string, RemoteNotificationTypeSettings>;
}

const TASK_NOTIFICATION_TYPE = 'TASK';
const MESSAGE_NOTIFICATION_TYPE = 'MESSAGE';
const ALERT_NOTIFICATION_TYPE_CANDIDATES = ['ALERT', 'SECURITY'];
const AUTHENTICATION_ERROR_NAMES = new Set([
  'AuthenticationError',
  'TokenExpiredError',
  'TokenInvalidError',
]);
const AUTHENTICATION_ERROR_CODES = new Set([
  '401',
  '4010',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
]);
const AUTHENTICATION_ERROR_MESSAGE_PATTERN =
  /(token expired|token invalid|invalid token|unauthorized|authentication|\u8bbf\u95ee\u4ee4\u724c|\u4ee4\u724c\u5df2\u8fc7\u671f|\u4ee4\u724c\u65e0\u6548|\u672a\u6388\u6743|\u8ba4\u8bc1|\u9a8c\u8bc1)/i;

function getStorage(): Storage | null {
  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function readSettingsOverlay(): SettingsOverlay {
  const storage = getStorage();
  if (!storage) {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }

  const rawValue = storage.getItem(SETTINGS_OVERLAY_STORAGE_KEY);
  if (!rawValue) {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SettingsOverlay>;
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES, ...parsed.general },
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed.notifications },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES, ...parsed.privacy },
      security: { ...DEFAULT_SECURITY_PREFERENCES, ...parsed.security },
    };
  } catch {
    return {
      general: { ...DEFAULT_GENERAL_PREFERENCES },
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
      security: { ...DEFAULT_SECURITY_PREFERENCES },
    };
  }
}

function writeSettingsOverlay(overlay: SettingsOverlay) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SETTINGS_OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
}

function resolveNotificationTypeSetting(
  settings: RemoteNotificationSettings,
  notificationTypes: string[],
  channel: keyof RemoteNotificationTypeSettings,
  fallback: boolean,
): boolean {
  for (const notificationType of notificationTypes) {
    const value = settings.typeSettings?.[notificationType]?.[channel];
    if (value !== undefined) {
      return value;
    }
  }

  return fallback;
}

function buildPreferencesFromNotificationSettings(
  settings: RemoteNotificationSettings,
  overlay = readSettingsOverlay(),
  options: {
    preferOverlayNotifications?: boolean;
  } = {},
): UserPreferences {
  const emailEnabled = settings.enableEmail ?? true;
  const inAppEnabled = settings.enableInApp ?? true;
  const remoteNotifications: UserPreferences['notifications'] = {
    systemUpdates: emailEnabled,
    taskFailures: resolveNotificationTypeSetting(
      settings,
      [TASK_NOTIFICATION_TYPE],
      'enableEmail',
      emailEnabled,
    ),
    securityAlerts: resolveNotificationTypeSetting(
      settings,
      ALERT_NOTIFICATION_TYPE_CANDIDATES,
      'enableEmail',
      emailEnabled,
    ),
    taskCompletions: resolveNotificationTypeSetting(
      settings,
      [TASK_NOTIFICATION_TYPE],
      'enableInApp',
      inAppEnabled,
    ),
    newMessages: resolveNotificationTypeSetting(
      settings,
      [MESSAGE_NOTIFICATION_TYPE],
      'enableInApp',
      inAppEnabled,
    ),
  };

  return {
    general: overlay.general,
    notifications: options.preferOverlayNotifications
      ? overlay.notifications
      : remoteNotifications,
    privacy: overlay.privacy,
    security: {
      ...overlay.security,
    },
  };
}

function buildOverlayBackedPreferences(
  overlay = readSettingsOverlay(),
): UserPreferences {
  return buildPreferencesFromNotificationSettings({}, overlay, {
    preferOverlayNotifications: true,
  });
}

function isAuthenticationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typedError = error as Partial<AppSdkEnvelope<unknown>> &
    Partial<Error> & {
    code?: string | number;
    httpStatus?: number;
    status?: number;
  };

  if (error instanceof Error && AUTHENTICATION_ERROR_NAMES.has(error.name)) {
    return true;
  }

  const normalizedCode = String(typedError.code ?? '').trim().toUpperCase();
  if (normalizedCode && AUTHENTICATION_ERROR_CODES.has(normalizedCode)) {
    return true;
  }

  if (typedError.httpStatus === 401 || typedError.status === 401) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : String(typedError.message ?? typedError.msg ?? '').trim();

  return AUTHENTICATION_ERROR_MESSAGE_PATTERN.test(message);
}

function toUserProfile(profile: {
  nickname?: string;
  email?: string;
  avatar?: string;
}): UserProfile {
  const [firstName = '', ...rest] = (profile.nickname || '')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    firstName,
    lastName: rest.join(' '),
    email: profile.email || '',
    avatarUrl: profile.avatar,
  };
}

function buildNotificationSettingsUpdate(
  current: RemoteNotificationSettings,
  notifications: Partial<UserPreferences['notifications']>,
): RemoteNotificationSettings {
  return {
    enablePush: current.enablePush,
    enableEmail: notifications.systemUpdates ?? current.enableEmail,
    enableSms: current.enableSms,
    enableInApp: current.enableInApp,
    quietHoursStart: current.quietHoursStart,
    quietHoursEnd: current.quietHoursEnd,
    notificationSound: current.notificationSound,
    vibrationEnabled: current.vibrationEnabled,
  };
}

function resolvePreferredNotificationType(
  settings: RemoteNotificationSettings,
  candidates: string[],
  fallback: string,
): string {
  for (const candidate of candidates) {
    if (settings.typeSettings?.[candidate]) {
      return candidate;
    }
  }

  return fallback;
}

function buildNotificationTypeSettingsUpdate(
  type: string,
  current: RemoteNotificationTypeSettings | undefined,
  updates: Partial<RemoteNotificationTypeSettings>,
): RemoteNotificationTypeSettingsUpdate {
  return {
    type,
    enablePush: updates.enablePush ?? current?.enablePush,
    enableInApp: updates.enableInApp ?? current?.enableInApp,
    enableEmail: updates.enableEmail ?? current?.enableEmail,
    enableSms: updates.enableSms ?? current?.enableSms,
  };
}

function buildNotificationTypeSettingsUpdates(
  currentSettings: RemoteNotificationSettings,
  notifications: Partial<UserPreferences['notifications']>,
): RemoteNotificationTypeSettingsUpdate[] {
  const updates: RemoteNotificationTypeSettingsUpdate[] = [];

  if (
    notifications.taskFailures !== undefined
    || notifications.taskCompletions !== undefined
  ) {
    updates.push(
      buildNotificationTypeSettingsUpdate(
        TASK_NOTIFICATION_TYPE,
        currentSettings.typeSettings?.[TASK_NOTIFICATION_TYPE],
        {
          enableEmail: notifications.taskFailures,
          enableInApp: notifications.taskCompletions,
        },
      ),
    );
  }

  if (notifications.securityAlerts !== undefined) {
    const alertType = resolvePreferredNotificationType(
      currentSettings,
      ALERT_NOTIFICATION_TYPE_CANDIDATES,
      'ALERT',
    );
    updates.push(
      buildNotificationTypeSettingsUpdate(
        alertType,
        currentSettings.typeSettings?.[alertType],
        {
          enableEmail: notifications.securityAlerts,
        },
      ),
    );
  }

  if (notifications.newMessages !== undefined) {
    updates.push(
      buildNotificationTypeSettingsUpdate(
        MESSAGE_NOTIFICATION_TYPE,
        currentSettings.typeSettings?.[MESSAGE_NOTIFICATION_TYPE],
        {
          enableInApp: notifications.newMessages,
        },
      ),
    );
  }

  return updates;
}

async function getDefaultSettingsClient(): Promise<SettingsSdkClient> {
  const { getAppSdkClientWithSession } = await import('../sdk/useAppSdkClient.ts');
  return getAppSdkClientWithSession() as unknown as SettingsSdkClient;
}

class SettingsService implements ISettingsService {
  private readonly getClient: () => SettingsSdkClient | Promise<SettingsSdkClient>;

  constructor(getClient: () => SettingsSdkClient | Promise<SettingsSdkClient>) {
    this.getClient = getClient;
  }

  async getProfile(): Promise<UserProfile> {
    const client = await this.getClient();
    const profile = unwrapAppSdkResponse<RemoteUserProfilePayload>(
      await client.user.getUserProfile(),
      'Failed to load profile.',
    );

    return toUserProfile(profile);
  }

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    const client = await this.getClient();
    const updated = unwrapAppSdkResponse<RemoteUserProfileUpdatePayload>(
      await client.user.updateUserProfile({
        nickname:
          [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || undefined,
        email: profile.email,
      }),
      'Failed to update profile.',
    );

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: updated.email || profile.email,
      avatarUrl: updated.avatar || profile.avatarUrl,
    };
  }

  async updatePassword(current: string, newPass: string): Promise<void> {
    const client = await this.getClient();
    unwrapAppSdkResponse(
      await client.user.changePassword({
        oldPassword: current,
        newPassword: newPass,
        confirmPassword: newPass,
      }),
      'Failed to update password.',
    );
  }

  async getPreferences(): Promise<UserPreferences> {
    const client = await this.getClient();
    try {
      const response = await client.notification.getNotificationSettings();
      if (isAuthenticationFailure(response)) {
        return buildOverlayBackedPreferences();
      }

      const settings = unwrapAppSdkResponse<RemoteNotificationSettings>(
        response,
        'Failed to load preferences.',
      );

      return buildPreferencesFromNotificationSettings(settings);
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        return buildOverlayBackedPreferences();
      }

      throw error;
    }
  }

  async updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const currentOverlay = readSettingsOverlay();
    const nextOverlay = {
      general: { ...currentOverlay.general, ...prefs.general },
      notifications: { ...currentOverlay.notifications, ...prefs.notifications },
      privacy: { ...currentOverlay.privacy, ...prefs.privacy },
      security: { ...currentOverlay.security, ...prefs.security },
    };
    writeSettingsOverlay(nextOverlay);

    if (!prefs.notifications) {
      return buildOverlayBackedPreferences(nextOverlay);
    }

    const client = await this.getClient();
    const currentSettings = unwrapAppSdkResponse<RemoteNotificationSettings>(
      await client.notification.getNotificationSettings(),
      'Failed to load notification settings.',
    );

    const updatedSettings = unwrapAppSdkResponse<RemoteNotificationSettings>(
      await client.notification.updateNotificationSettings(
        buildNotificationSettingsUpdate(currentSettings, prefs.notifications),
      ),
      'Failed to update preferences.',
    );

    const typeSettingsUpdates = buildNotificationTypeSettingsUpdates(
      updatedSettings,
      prefs.notifications,
    );

    for (const typeSettingsUpdate of typeSettingsUpdates) {
      unwrapAppSdkResponse(
        await client.notification.updateTypeSettings(
          typeSettingsUpdate.type,
          typeSettingsUpdate,
        ),
        'Failed to update preferences.',
      );
    }

    const refreshedSettings =
      typeSettingsUpdates.length === 0
        ? updatedSettings
        : unwrapAppSdkResponse<RemoteNotificationSettings>(
            await client.notification.getNotificationSettings(),
            'Failed to load preferences.',
          );

    return buildPreferencesFromNotificationSettings(refreshedSettings, nextOverlay);
  }
}

export function createSettingsService(
  options: CreateSettingsServiceOptions = {},
): ISettingsService {
  return new SettingsService(options.getClient ?? getDefaultSettingsClient);
}

export const settingsService = createSettingsService();

