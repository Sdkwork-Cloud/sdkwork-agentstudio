import {
  createPersistedSimpleStore,
  type PersistedSimpleStoreApi,
  type StateStorage,
  type StoreStateSetter,
} from './simpleStore.ts';
import { appAuthService } from '../services/index.ts';
import type {
  AppAuthOAuthDeviceType,
  AppAuthPasswordResetChannel,
  AppAuthSession,
  AppAuthSocialProvider,
} from '../services/index.ts';
import { readAppSdkSessionTokens } from '../sdk/useAppSdkClient.ts';

const STORAGE_KEY = 'claw-studio-auth-storage';

export interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  displayName: string;
  initials: string;
}

export interface SignInInput {
  account?: string;
  email?: string;
  password: string;
}

export interface RegisterInput {
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword?: string;
  verificationCode?: string;
  channel?: 'EMAIL' | 'PHONE';
}

export interface OAuthSignInInput {
  provider: AppAuthSocialProvider;
  code: string;
  state?: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
}

export interface PhoneCodeSignInInput {
  phone: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
}

export interface EmailCodeSignInInput {
  email: string;
  code: string;
  deviceId?: string;
  deviceType?: AppAuthOAuthDeviceType;
}

export interface PasswordResetRequestInput {
  account: string;
  channel: AppAuthPasswordResetChannel;
}

export interface PasswordResetInput {
  account: string;
  code: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface AuthStoreState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  signIn: (credentials: SignInInput) => Promise<AuthUser>;
  signInWithPhoneCode: (payload: PhoneCodeSignInInput) => Promise<AuthUser>;
  signInWithEmailCode: (payload: EmailCodeSignInInput) => Promise<AuthUser>;
  register: (payload: RegisterInput) => Promise<AuthUser>;
  signInWithOAuth: (payload: OAuthSignInInput) => Promise<AuthUser>;
  applySession: (session: AppAuthSession) => AuthUser;
  requestPasswordReset: (payload: PasswordResetRequestInput) => Promise<void>;
  resetPassword: (payload: PasswordResetInput) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncUserProfile: (profile: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  }) => void;
  reset: () => void;
}

function splitDisplayName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return { firstName: 'Claw', lastName: 'Operator' };
  }

  const [firstName, ...rest] = normalized.split(' ');
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function buildInitials(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CS';
}

function toAuthUser(profile: {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}): AuthUser {
  const firstName = profile.firstName.trim() || 'Claw';
  const lastName = profile.lastName.trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    firstName,
    lastName,
    email: profile.email.trim(),
    avatarUrl: profile.avatarUrl,
    displayName: displayName || 'Claw Operator',
    initials: buildInitials(firstName, lastName),
  };
}

function toAuthUserFromIdentity(profile: {
  nickname?: string;
  username?: string;
  email?: string;
  avatar?: string;
}): AuthUser {
  const fallbackName = profile.nickname?.trim() || profile.username?.trim() || 'Claw Operator';
  const nameParts = splitDisplayName(fallbackName);

  return toAuthUser({
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: profile.email?.trim() || profile.username?.trim() || '',
    avatarUrl: profile.avatar,
  });
}

function buildAuthUserFromSession(
  session: AppAuthSession,
  fallback?: {
    nickname?: string;
    username?: string;
    email?: string;
    avatar?: string;
  },
): AuthUser {
  const profile = session.userInfo ?? fallback ?? {};
  return toAuthUserFromIdentity({
    nickname: profile.nickname,
    username: profile.username,
    email: profile.email,
    avatar: profile.avatar,
  });
}

function resolveSignInAccount(credentials: SignInInput) {
  const account = (credentials.account || credentials.email || '').trim();
  if (!account) {
    throw new Error('Sign-in account is required.');
  }
  return account;
}

export const createAuthStoreState = (
  set: StoreStateSetter<AuthStoreState>,
): AuthStoreState => ({
  isAuthenticated: false,
  user: null,
  async signIn(credentials: SignInInput) {
    const account = resolveSignInAccount(credentials);
    const result = await appAuthService.login({
      username: account,
      password: credentials.password,
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        email: account,
        username: account,
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async signInWithPhoneCode(payload: PhoneCodeSignInInput) {
    const result = await appAuthService.loginWithPhone({
      phone: payload.phone,
      code: payload.code,
      deviceId: payload.deviceId,
      deviceType: payload.deviceType,
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        username: payload.phone.trim(),
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async signInWithEmailCode(payload: EmailCodeSignInInput) {
    const result = await appAuthService.loginWithEmail({
      email: payload.email,
      code: payload.code,
      deviceId: payload.deviceId,
      deviceType: payload.deviceType,
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        email: payload.email.trim(),
        username: payload.email.trim(),
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async register(payload: RegisterInput) {
    const username = (
      payload.username
      || payload.email
      || payload.phone
      || payload.name
      || ''
    ).trim();
    const result = await appAuthService.register({
      username,
      password: payload.password,
      confirmPassword: payload.confirmPassword || payload.password,
      email: payload.email?.trim(),
      phone: payload.phone?.trim(),
      type: payload.channel,
      verificationCode: payload.verificationCode?.trim(),
    });
    const user = toAuthUserFromIdentity(
      result.userInfo ?? {
        nickname: payload.name,
        email: payload.email?.trim(),
        username: username || payload.phone?.trim(),
      },
    );
    set({ isAuthenticated: true, user });
    return user;
  },
  async signInWithOAuth(payload: OAuthSignInInput) {
    const result = await appAuthService.loginWithOAuth({
      provider: payload.provider,
      code: payload.code,
      state: payload.state,
      deviceId: payload.deviceId,
      deviceType: payload.deviceType,
    });
    const user = buildAuthUserFromSession(result);
    set({ isAuthenticated: true, user });
    return user;
  },
  applySession(session: AppAuthSession) {
    const user = buildAuthUserFromSession(session);
    set({ isAuthenticated: true, user });
    return user;
  },
  async requestPasswordReset(payload: PasswordResetRequestInput) {
    await appAuthService.requestPasswordReset({
      account: payload.account.trim(),
      channel: payload.channel,
    });
  },
  async resetPassword(payload: PasswordResetInput) {
    await appAuthService.resetPassword({
      account: payload.account.trim(),
      code: payload.code.trim(),
      newPassword: payload.newPassword,
      confirmPassword: payload.confirmPassword,
    });
  },
  async sendPasswordReset(email: string) {
    await appAuthService.requestPasswordReset({
      account: email,
      channel: 'EMAIL',
    });
  },
  async signOut() {
    try {
      await appAuthService.logout();
    } finally {
      set({ isAuthenticated: false, user: null });
    }
  },
  syncUserProfile(profile: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  }) {
    set((state) => ({
      user: state.isAuthenticated ? toAuthUser(profile) : state.user,
    }));
  },
  reset() {
    set({ isAuthenticated: false, user: null });
  },
});

export function createAuthStorePersistOptions(storage?: StateStorage) {
  return storage
    ? {
        name: STORAGE_KEY,
        storage,
        partialize: (state: AuthStoreState) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
        }),
      }
    : {
        name: STORAGE_KEY,
        partialize: (state: AuthStoreState) => ({
          isAuthenticated: state.isAuthenticated,
          user: state.user,
        }),
      };
}

type AuthStoreApi = Pick<PersistedSimpleStoreApi<AuthStoreState>, 'getState' | 'setState'>;

export function synchronizeAuthStoreSession(store: AuthStoreApi) {
  const { isAuthenticated } = store.getState();
  const authToken = (readAppSdkSessionTokens().authToken || '').trim();

  if (isAuthenticated && !authToken) {
    store.setState({ isAuthenticated: false, user: null });
  }
}

export function createAuthStore(storage?: StateStorage) {
  const store = createPersistedSimpleStore<AuthStoreState>(
    createAuthStoreState,
    createAuthStorePersistOptions(storage),
  );
  synchronizeAuthStoreSession(store);
  return store;
}
