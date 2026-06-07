import {
  createSdkworkAuthService,
  type SdkworkAuthClient,
  type SdkworkAuthLoginQrCodeStatus,
  type SdkworkAuthSession,
  type SdkworkAuthSessionCommitOptions,
  type SdkworkAuthStoredSession,
  type SdkworkAuthUser,
} from '@sdkwork/auth-pc-react/auth-service';
import {
  clearAppSdkSessionTokens,
  getAppSdkClientWithSession,
  getMessagingAppSdkClientWithSession,
  persistAppSdkSessionTokens,
  readAppSdkSessionTokens,
  resolveAppSdkAccessToken,
} from '../sdk/useAppSdkClient.ts';

export type AppAuthVerifyType = 'EMAIL' | 'PHONE';
export type AppAuthScene = 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
export type AppAuthPasswordResetChannel = 'EMAIL' | 'SMS';
export type AppAuthSocialProvider = string;
export type AppAuthOAuthDeviceType = 'web' | 'desktop' | 'android' | 'ios';
export type AppAuthLoginQrCodeStatus = 'pending' | 'scanned' | 'confirmed' | 'expired';

export interface AppAuthLoginInput {
  username: string;
  password: string;
  remember?: boolean;
}

export interface AppAuthRegisterInput {
  username: string;
  password: string;
  confirmPassword?: string;
  email?: string;
  phone?: string;
  type?: 'DEFAULT' | 'EMAIL' | 'PHONE';
  name?: string;
  verificationCode?: string;
}

export interface AppAuthPhoneLoginInput {
  phone: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
  deviceName?: string;
  appVersion?: string;
}

export interface AppAuthEmailLoginInput {
  email: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
  deviceName?: string;
  appVersion?: string;
}

export interface AppAuthSendVerifyCodeInput {
  target: string;
  verifyType: AppAuthVerifyType;
  scene: AppAuthScene;
}

export interface AppAuthVerifyCodeInput extends AppAuthSendVerifyCodeInput {
  code: string;
}

export interface AppAuthPasswordResetRequestInput {
  account: string;
  channel: AppAuthPasswordResetChannel;
}

export interface AppAuthPasswordResetInput {
  account: string;
  code: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface AppAuthOAuthAuthorizationInput {
  provider: AppAuthSocialProvider;
  redirectUri: string;
  scope?: string;
  state?: string;
}

export interface AppAuthOAuthLoginInput {
  provider: AppAuthSocialProvider;
  code: string;
  state?: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
}

export interface AppAuthUserInfo {
  avatar?: string;
  email?: string;
  id?: string;
  nickname?: string;
  phone?: string;
  username?: string;
}

export interface AppAuthSession {
  authToken: string;
  accessToken: string;
  refreshToken?: string;
  userInfo?: AppAuthUserInfo;
}

export interface AppAuthLoginQrCode {
  type?: string;
  title?: string;
  description?: string;
  qrKey: string;
  qrUrl?: string;
  qrContent?: string;
  expireTime?: number;
}

export interface AppAuthLoginQrCodeStatusResult {
  status: AppAuthLoginQrCodeStatus;
  session?: AppAuthSession;
  userInfo?: AppAuthUserInfo;
}

export interface IAppAuthService {
  login(input: AppAuthLoginInput): Promise<AppAuthSession>;
  loginWithPhone(input: AppAuthPhoneLoginInput): Promise<AppAuthSession>;
  loginWithEmail(input: AppAuthEmailLoginInput): Promise<AppAuthSession>;
  register(input: AppAuthRegisterInput): Promise<AppAuthSession>;
  logout(): Promise<void>;
  refreshToken(refreshToken?: string): Promise<AppAuthSession>;
  sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void>;
  verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean>;
  requestPasswordReset(input: AppAuthPasswordResetRequestInput): Promise<void>;
  resetPassword(input: AppAuthPasswordResetInput): Promise<void>;
  getOAuthAuthorizationUrl(input: AppAuthOAuthAuthorizationInput): Promise<string>;
  loginWithOAuth(input: AppAuthOAuthLoginInput): Promise<AppAuthSession>;
  generateLoginQrCode(): Promise<AppAuthLoginQrCode>;
  checkLoginQrCodeStatus(qrKey: string): Promise<AppAuthLoginQrCodeStatusResult>;
  getCurrentSession(): Promise<AppAuthSession | null>;
}

function readOptionalString(value?: string | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function readOptionalDeviceType(
  value?: AppAuthOAuthDeviceType | null,
): AppAuthOAuthDeviceType | undefined {
  return value ? value : undefined;
}

function readObjectString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const entry = (value as Record<string, unknown>)[key];
  return typeof entry === 'string' ? readOptionalString(entry) : undefined;
}

function readAvatarUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return readOptionalString(value);
  }

  return readObjectString(value, 'url')
    ?? readObjectString(value, 'uri')
    ?? readObjectString(value, 'href')
    ?? readObjectString(value, 'src');
}

function createIdempotencyKey(scope: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `${scope}-${randomUuid}`;
  }

  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resolveRegisterChannel(
  input: AppAuthRegisterInput,
): 'EMAIL' | 'PHONE' | undefined {
  if (input.type === 'EMAIL' || input.type === 'PHONE') {
    return input.type;
  }
  if (input.email && !input.phone) {
    return 'EMAIL';
  }
  if (!input.email && input.phone) {
    return 'PHONE';
  }
  return undefined;
}

function mapQrStatus(status: SdkworkAuthLoginQrCodeStatus): AppAuthLoginQrCodeStatus {
  if (status === 'scanned' || status === 'confirmed' || status === 'expired') {
    return status;
  }
  return 'pending';
}

function toAppAuthUserInfo(user?: SdkworkAuthUser | null): AppAuthUserInfo | undefined {
  if (!user) {
    return undefined;
  }

  const userInfo: AppAuthUserInfo = {
    avatar: readAvatarUrl(user.avatar),
    email: readOptionalString(user.email),
    id: readOptionalString(user.id),
    nickname: readOptionalString(user.displayName),
    username: readOptionalString(user.username) ?? readOptionalString(user.id),
  };

  return Object.values(userInfo).some(Boolean) ? userInfo : undefined;
}

function toAppAuthSession(session: SdkworkAuthSession): AppAuthSession {
  return {
    authToken: session.authToken,
    accessToken: session.accessToken,
    ...(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
    ...(toAppAuthUserInfo(session.user)
      ? { userInfo: toAppAuthUserInfo(session.user) }
      : {}),
  };
}

function commitAppAuthSession(
  session: SdkworkAuthStoredSession,
  options?: SdkworkAuthSessionCommitOptions,
): SdkworkAuthStoredSession {
  const storedSession = readAppSdkSessionTokens();
  const committedSession = {
    accessToken: readOptionalString(session.accessToken) ?? readOptionalString(storedSession.accessToken),
    authToken: readOptionalString(session.authToken) ?? readOptionalString(storedSession.authToken),
    refreshToken: readOptionalString(session.refreshToken)
      ?? (options?.preserveRefreshToken ? readOptionalString(storedSession.refreshToken) : undefined),
  };

  persistAppSdkSessionTokens(committedSession);
  return committedSession;
}

function createAuthClient(): SdkworkAuthClient {
  const appbaseClient = getAppSdkClientWithSession() as unknown as SdkworkAuthClient;
  const messagingClient = getMessagingAppSdkClientWithSession();

  return {
    ...appbaseClient,
    messaging: {
      ...messagingClient.messaging,
      verificationCodes: {
        create: (payload: Record<string, unknown>) =>
          messagingClient.messaging.verificationCodes.create(
            payload as Parameters<typeof messagingClient.messaging.verificationCodes.create>[0],
            {
              idempotencyKey: createIdempotencyKey('verification-code-create'),
            },
          ),
        verify: (payload: Record<string, unknown>) =>
          messagingClient.messaging.verificationCodes.verify(
            payload as Parameters<typeof messagingClient.messaging.verificationCodes.verify>[0],
            {
              idempotencyKey: createIdempotencyKey('verification-code-verify'),
            },
          ),
      },
    },
  };
}

const sdkworkAuthService = createSdkworkAuthService({
  clearSession: clearAppSdkSessionTokens,
  commitSession: commitAppAuthSession,
  getClient: createAuthClient,
  readSession: readAppSdkSessionTokens,
  resolveAccessToken: resolveAppSdkAccessToken,
});

export const appAuthService: IAppAuthService = {
  async login(input: AppAuthLoginInput): Promise<AppAuthSession> {
    return toAppAuthSession(await sdkworkAuthService.signIn({
      password: input.password,
      username: input.username.trim(),
    }));
  },

  async loginWithPhone(input: AppAuthPhoneLoginInput): Promise<AppAuthSession> {
    return toAppAuthSession(await sdkworkAuthService.signInWithPhoneCode({
      appVersion: readOptionalString(input.appVersion),
      code: input.code.trim(),
      deviceId: readOptionalString(input.deviceId),
      deviceName: readOptionalString(input.deviceName),
      deviceType: readOptionalDeviceType(input.deviceType),
      phone: input.phone.trim(),
    }));
  },

  async loginWithEmail(input: AppAuthEmailLoginInput): Promise<AppAuthSession> {
    return toAppAuthSession(await sdkworkAuthService.signInWithEmailCode({
      appVersion: readOptionalString(input.appVersion),
      code: input.code.trim(),
      deviceId: readOptionalString(input.deviceId),
      deviceName: readOptionalString(input.deviceName),
      deviceType: readOptionalDeviceType(input.deviceType),
      email: input.email.trim(),
    }));
  },

  async register(input: AppAuthRegisterInput): Promise<AppAuthSession> {
    return toAppAuthSession(await sdkworkAuthService.register({
      channel: resolveRegisterChannel(input),
      confirmPassword: input.confirmPassword || input.password,
      email: readOptionalString(input.email),
      password: input.password,
      phone: readOptionalString(input.phone),
      username: input.username.trim(),
      verificationCode: readOptionalString(input.verificationCode),
    }));
  },

  async logout(): Promise<void> {
    await sdkworkAuthService.signOut();
  },

  async refreshToken(refreshToken?: string): Promise<AppAuthSession> {
    const storedTokens = readAppSdkSessionTokens();
    const nextRefreshToken = readOptionalString(refreshToken)
      ?? readOptionalString(storedTokens.refreshToken);
    if (!nextRefreshToken) {
      throw new Error('Refresh token is required.');
    }

    return toAppAuthSession(await sdkworkAuthService.refreshSession({
      refreshToken: nextRefreshToken,
    }));
  },

  async sendVerifyCode(input: AppAuthSendVerifyCodeInput): Promise<void> {
    await sdkworkAuthService.sendVerifyCode({
      scene: input.scene,
      target: input.target.trim(),
      verifyType: input.verifyType,
    });
  },

  async verifyCode(input: AppAuthVerifyCodeInput): Promise<boolean> {
    return sdkworkAuthService.verifyCode({
      code: input.code.trim(),
      scene: input.scene,
      target: input.target.trim(),
      verifyType: input.verifyType,
    });
  },

  async requestPasswordReset(input: AppAuthPasswordResetRequestInput): Promise<void> {
    await sdkworkAuthService.requestPasswordReset({
      account: input.account.trim(),
      channel: input.channel,
    });
  },

  async resetPassword(input: AppAuthPasswordResetInput): Promise<void> {
    await sdkworkAuthService.resetPassword({
      account: input.account.trim(),
      code: input.code.trim(),
      confirmPassword: input.confirmPassword || input.newPassword,
      newPassword: input.newPassword,
    });
  },

  async getOAuthAuthorizationUrl(input: AppAuthOAuthAuthorizationInput): Promise<string> {
    return sdkworkAuthService.getOAuthAuthorizationUrl({
      provider: input.provider,
      redirectUri: input.redirectUri,
      scope: readOptionalString(input.scope),
      state: readOptionalString(input.state),
    });
  },

  async loginWithOAuth(input: AppAuthOAuthLoginInput): Promise<AppAuthSession> {
    return toAppAuthSession(await sdkworkAuthService.signInWithOAuth({
      code: input.code.trim(),
      deviceId: readOptionalString(input.deviceId),
      deviceType: readOptionalDeviceType(input.deviceType),
      provider: input.provider,
      state: readOptionalString(input.state),
    }));
  },

  async generateLoginQrCode(): Promise<AppAuthLoginQrCode> {
    const qrCode = await sdkworkAuthService.generateLoginQrCode();

    return {
      description: readOptionalString(qrCode.description),
      expireTime: typeof qrCode.expireTime === 'number' ? qrCode.expireTime : undefined,
      qrContent: readOptionalString(qrCode.qrContent),
      qrKey: qrCode.sessionKey,
      qrUrl: readAvatarUrl(qrCode.qrCode),
      title: readOptionalString(qrCode.title),
      type: readOptionalString(qrCode.type),
    };
  },

  async checkLoginQrCodeStatus(qrKey: string): Promise<AppAuthLoginQrCodeStatusResult> {
    const result = await sdkworkAuthService.checkLoginQrCodeStatus(qrKey);

    return {
      status: mapQrStatus(result.status),
      ...(result.session ? { session: toAppAuthSession(result.session) } : {}),
      ...(toAppAuthUserInfo(result.user)
        ? { userInfo: toAppAuthUserInfo(result.user) }
        : {}),
    };
  },

  async getCurrentSession(): Promise<AppAuthSession | null> {
    const session = await sdkworkAuthService.getCurrentSession();
    return session ? toAppAuthSession(session) : null;
  },
};
