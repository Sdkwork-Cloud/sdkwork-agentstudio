import type { AuthUser } from '@sdkwork/claw-core';
import type { UserProfile } from './services/index.ts';

export type AccountProfileSource = 'remote' | 'session';
export type AccountProfileStatus = 'saving' | 'attention' | 'dirty' | 'synced' | 'session';
export type AccountProfileEmailState = 'missing' | 'invalid' | 'valid';
export type AccountProfileField = 'firstName' | 'lastName' | 'email' | 'avatar';

export interface ResolveAccountProfileBaselineOptions {
  authUser?: AuthUser | null;
  remoteProfile?: Partial<UserProfile> | null;
  hasRemoteProfile: boolean;
}

export interface BuildAccountProfileStateOptions {
  baselineProfile: UserProfile;
  draftProfile: Partial<UserProfile>;
  source: AccountProfileSource;
  isSaving: boolean;
}

export interface AccountProfileCompletionItem {
  field: AccountProfileField;
  complete: boolean;
}

export interface AccountProfileState {
  baselineProfile: UserProfile;
  profile: UserProfile;
  source: AccountProfileSource;
  displayName: string;
  initials: string;
  emailState: AccountProfileEmailState;
  completionItems: AccountProfileCompletionItem[];
  completedFields: number;
  totalFields: number;
  completionPercentage: number;
  nextRecommendedField: AccountProfileField | null;
  hasChanges: boolean;
  canSave: boolean;
  canReset: boolean;
  status: AccountProfileStatus;
}

export const EMPTY_USER_PROFILE: UserProfile = {
  firstName: '',
  lastName: '',
  email: '',
  avatarUrl: undefined,
};

function normalizeValue(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '';
}

export function normalizeUserProfile(profile?: Partial<UserProfile> | null): UserProfile {
  return {
    firstName: normalizeValue(profile?.firstName),
    lastName: normalizeValue(profile?.lastName),
    email: normalizeValue(profile?.email),
    avatarUrl: normalizeValue(profile?.avatarUrl) || undefined,
  };
}

function toUserProfileFromAuthUser(authUser?: AuthUser | null): UserProfile {
  if (!authUser) {
    return EMPTY_USER_PROFILE;
  }

  return normalizeUserProfile({
    firstName: authUser.firstName,
    lastName: authUser.lastName,
    email: authUser.email,
    avatarUrl: authUser.avatarUrl,
  });
}

function isPlaceholderAuthIdentity(authUser?: AuthUser | null) {
  if (!authUser) {
    return false;
  }

  return (
    authUser.firstName.trim() === 'Claw'
    && authUser.lastName.trim() === 'Operator'
    && authUser.displayName.trim() === 'Claw Operator'
  );
}

function mergeProfile(
  primary: UserProfile,
  fallback: UserProfile,
  options?: {
    fallbackNameFields?: boolean;
  },
): UserProfile {
  return {
    firstName:
      primary.firstName || (options?.fallbackNameFields === false ? '' : fallback.firstName),
    lastName:
      primary.lastName || (options?.fallbackNameFields === false ? '' : fallback.lastName),
    email: primary.email || fallback.email,
    avatarUrl: primary.avatarUrl || fallback.avatarUrl,
  };
}

function buildDisplayName(profile: UserProfile) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  if (name) {
    return name;
  }

  const emailLocalPart = profile.email.split('@')[0]?.trim();
  return emailLocalPart || 'Claw Operator';
}

function buildInitials(profile: UserProfile) {
  const firstName = profile.firstName.trim();
  const lastName = profile.lastName.trim();
  const nameLetters = lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.trim().toUpperCase()
    : firstName.slice(0, 2).toUpperCase();

  if (nameLetters) {
    return nameLetters;
  }

  const emailLetters = profile.email
    .split('@')[0]
    ?.replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();

  return emailLetters || 'CS';
}

function getEmailState(email: string): AccountProfileEmailState {
  if (!email) {
    return 'missing';
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'valid' : 'invalid';
}

function areProfilesEqual(left: UserProfile, right: UserProfile) {
  return (
    left.firstName === right.firstName
    && left.lastName === right.lastName
    && left.email === right.email
    && (left.avatarUrl || '') === (right.avatarUrl || '')
  );
}

export function resolveAccountProfileBaseline({
  authUser,
  remoteProfile,
  hasRemoteProfile,
}: ResolveAccountProfileBaselineOptions): {
  profile: UserProfile;
  source: AccountProfileSource;
} {
  const fallbackProfile = toUserProfileFromAuthUser(authUser);
  const remoteResolvedProfile = normalizeUserProfile(remoteProfile);
  const shouldFallbackNameFields = !isPlaceholderAuthIdentity(authUser);

  return {
    profile: hasRemoteProfile
      ? mergeProfile(remoteResolvedProfile, fallbackProfile, {
          fallbackNameFields: shouldFallbackNameFields,
        })
      : fallbackProfile,
    source: hasRemoteProfile ? 'remote' : 'session',
  };
}

export function buildAccountProfileState({
  baselineProfile,
  draftProfile,
  source,
  isSaving,
}: BuildAccountProfileStateOptions): AccountProfileState {
  const normalizedBaselineProfile = normalizeUserProfile(baselineProfile);
  const profile = normalizeUserProfile(draftProfile);
  const emailState = getEmailState(profile.email);
  const completionItems: AccountProfileCompletionItem[] = [
    { field: 'firstName', complete: Boolean(profile.firstName) },
    { field: 'lastName', complete: Boolean(profile.lastName) },
    { field: 'email', complete: emailState === 'valid' },
    { field: 'avatar', complete: Boolean(profile.avatarUrl) },
  ];
  const completedFields = completionItems.filter((item) => item.complete).length;
  const totalFields = completionItems.length;
  const hasChanges = !areProfilesEqual(profile, normalizedBaselineProfile);

  let status: AccountProfileStatus = source === 'remote' ? 'synced' : 'session';
  if (isSaving) {
    status = 'saving';
  } else if (emailState !== 'valid') {
    status = 'attention';
  } else if (hasChanges) {
    status = 'dirty';
  }

  return {
    baselineProfile: normalizedBaselineProfile,
    profile,
    source,
    displayName: buildDisplayName(profile),
    initials: buildInitials(profile),
    emailState,
    completionItems,
    completedFields,
    totalFields,
    completionPercentage: Math.round((completedFields / totalFields) * 100),
    nextRecommendedField:
      completionItems.find((item) => !item.complete)?.field ?? null,
    hasChanges,
    canSave: hasChanges && emailState === 'valid' && !isSaving,
    canReset: hasChanges && !isSaving,
    status,
  };
}
