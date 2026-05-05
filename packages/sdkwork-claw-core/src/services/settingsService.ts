import { storage, type StoragePlatformAPI } from '@sdkwork/claw-infrastructure';
import { unwrapAppSdkResponse, type AppSdkEnvelope } from '../sdk/appSdkResult.ts';
import { resolveBrowserStorage } from '../utils/safeBrowserStorage.ts';

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
}

export interface CreateSettingsServiceOptions {
  getClient?: () => SettingsSdkClient | Promise<SettingsSdkClient>;
  storageApi?: StoragePlatformAPI;
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

const SETTINGS_STORAGE_NAMESPACE = 'claw-studio-settings';
const SETTINGS_OVERLAY_STORAGE_KEY = 'preferences-overlay';
const LEGACY_SETTINGS_OVERLAY_STORAGE_KEY = 'claw-studio-settings-overlay';

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

function createDefaultSettingsOverlay(): SettingsOverlay {
  return {
    general: { ...DEFAULT_GENERAL_PREFERENCES },
    notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    privacy: { ...DEFAULT_PRIVACY_PREFERENCES },
    security: { ...DEFAULT_SECURITY_PREFERENCES },
  };
}

function getLegacyStorage(): Storage | null {
  return resolveBrowserStorage('localStorage');
}

function parseSettingsOverlay(rawValue: string | null | undefined): SettingsOverlay | null {
  if (!rawValue) {
    return null;
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
    return null;
  }
}

function readLegacySettingsOverlay(): SettingsOverlay | null {
  try {
    return parseSettingsOverlay(getLegacyStorage()?.getItem(LEGACY_SETTINGS_OVERLAY_STORAGE_KEY));
  } catch {
    return null;
  }
}

function clearLegacySettingsOverlay() {
  try {
    getLegacyStorage()?.removeItem(LEGACY_SETTINGS_OVERLAY_STORAGE_KEY);
  } catch {
    // Ignore blocked browser storage after the platform overlay has been persisted.
  }
}

async function readSettingsOverlay(storageApi: StoragePlatformAPI): Promise<SettingsOverlay> {
  try {
    const result = await storageApi.getText({
      namespace: SETTINGS_STORAGE_NAMESPACE,
      key: SETTINGS_OVERLAY_STORAGE_KEY,
    });
    const persisted = parseSettingsOverlay(result.value);
    if (persisted) {
      return persisted;
    }
  } catch {
    // Fall back to the legacy browser overlay below.
  }

  const legacyOverlay = readLegacySettingsOverlay();
  if (legacyOverlay) {
    try {
      await storageApi.putText({
        namespace: SETTINGS_STORAGE_NAMESPACE,
        key: SETTINGS_OVERLAY_STORAGE_KEY,
        value: JSON.stringify(legacyOverlay),
      });
      clearLegacySettingsOverlay();
    } catch {
      // Keep the legacy copy as the last-resort fallback if platform storage is unavailable.
    }

    return legacyOverlay;
  }

  return createDefaultSettingsOverlay();
}

async function writeSettingsOverlay(
  storageApi: StoragePlatformAPI,
  overlay: SettingsOverlay,
): Promise<void> {
  const serialized = JSON.stringify(overlay);

  try {
    await storageApi.putText({
      namespace: SETTINGS_STORAGE_NAMESPACE,
      key: SETTINGS_OVERLAY_STORAGE_KEY,
      value: serialized,
    });
    clearLegacySettingsOverlay();
    return;
  } catch (error) {
    const legacyStorage = getLegacyStorage();
    if (!legacyStorage) {
      throw error;
    }

    try {
      legacyStorage.setItem(LEGACY_SETTINGS_OVERLAY_STORAGE_KEY, serialized);
    } catch {
      throw error;
    }
  }
}

function buildOverlayBackedPreferences(overlay: SettingsOverlay): UserPreferences {
  return {
    general: { ...overlay.general },
    notifications: { ...overlay.notifications },
    privacy: { ...overlay.privacy },
    security: { ...overlay.security },
  };
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

async function getDefaultSettingsClient(): Promise<SettingsSdkClient> {
  const { getAppSdkClientWithSession } = await import('../sdk/useAppSdkClient.ts');
  return getAppSdkClientWithSession() as unknown as SettingsSdkClient;
}

class SettingsService implements ISettingsService {
  private readonly getClient: () => SettingsSdkClient | Promise<SettingsSdkClient>;
  private readonly storageApi: StoragePlatformAPI;

  constructor(
    getClient: () => SettingsSdkClient | Promise<SettingsSdkClient>,
    storageApi: StoragePlatformAPI,
  ) {
    this.getClient = getClient;
    this.storageApi = storageApi;
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
    return buildOverlayBackedPreferences(await readSettingsOverlay(this.storageApi));
  }

  async updatePreferences(prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const currentOverlay = await readSettingsOverlay(this.storageApi);
    const nextOverlay = {
      general: { ...currentOverlay.general, ...prefs.general },
      notifications: { ...currentOverlay.notifications, ...prefs.notifications },
      privacy: { ...currentOverlay.privacy, ...prefs.privacy },
      security: { ...currentOverlay.security, ...prefs.security },
    };

    await writeSettingsOverlay(this.storageApi, nextOverlay);
    return buildOverlayBackedPreferences(nextOverlay);
  }
}

export function createSettingsService(
  options: CreateSettingsServiceOptions = {},
): ISettingsService {
  return new SettingsService(
    options.getClient ?? getDefaultSettingsClient,
    options.storageApi ?? storage,
  );
}

export const settingsService = createSettingsService();
