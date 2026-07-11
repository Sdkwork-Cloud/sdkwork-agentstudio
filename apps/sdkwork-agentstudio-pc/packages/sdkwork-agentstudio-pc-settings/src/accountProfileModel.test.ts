import assert from 'node:assert/strict';
import {
  buildAccountProfileState,
  resolveAccountProfileBaseline,
} from './accountProfileModel.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('resolveAccountProfileBaseline prefers remote data and backfills missing fields from session identity', () => {
  const resolved = resolveAccountProfileBaseline({
    authUser: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'session@example.com',
      avatarUrl: 'https://cdn.example.com/session.png',
      displayName: 'Ada Lovelace',
      initials: 'AL',
    },
    remoteProfile: {
      firstName: 'Ada',
      lastName: '',
      email: 'ada@example.com',
    },
    hasRemoteProfile: true,
  });

  assert.equal(resolved.source, 'remote');
  assert.deepEqual(resolved.profile, {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    avatarUrl: 'https://cdn.example.com/session.png',
  });
});

runTest('resolveAccountProfileBaseline does not reuse placeholder session names when the remote profile is intentionally blank', () => {
  const resolved = resolveAccountProfileBaseline({
    authUser: {
      firstName: 'Claw',
      lastName: 'Operator',
      email: 'session@example.com',
      avatarUrl: 'https://cdn.example.com/session.png',
      displayName: 'Claw Operator',
      initials: 'CO',
    },
    remoteProfile: {
      firstName: '',
      lastName: '',
      email: 'profile@example.com',
      avatarUrl: '',
    },
    hasRemoteProfile: true,
  });

  assert.equal(resolved.source, 'remote');
  assert.deepEqual(resolved.profile, {
    firstName: '',
    lastName: '',
    email: 'profile@example.com',
    avatarUrl: 'https://cdn.example.com/session.png',
  });
});

runTest('resolveAccountProfileBaseline falls back to current session identity when remote profile is unavailable', () => {
  const resolved = resolveAccountProfileBaseline({
    authUser: {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      avatarUrl: undefined,
      displayName: 'Grace Hopper',
      initials: 'GH',
    },
    remoteProfile: null,
    hasRemoteProfile: false,
  });

  assert.equal(resolved.source, 'session');
  assert.deepEqual(resolved.profile, {
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    avatarUrl: undefined,
  });
});

runTest('buildAccountProfileState computes completeness, trims whitespace changes, and enables saving only for valid drafts', () => {
  const state = buildAccountProfileState({
    baselineProfile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      avatarUrl: undefined,
    },
    draftProfile: {
      firstName: ' Ada ',
      lastName: '  Lovelace  ',
      email: 'ada@example.com',
      avatarUrl: '',
    },
    source: 'remote',
    isSaving: false,
  });

  assert.equal(state.displayName, 'Ada Lovelace');
  assert.equal(state.initials, 'AL');
  assert.equal(state.completionPercentage, 75);
  assert.equal(state.completedFields, 3);
  assert.equal(state.totalFields, 4);
  assert.equal(state.nextRecommendedField, 'avatar');
  assert.equal(state.hasChanges, false);
  assert.equal(state.canSave, false);
  assert.equal(state.canReset, false);
  assert.equal(state.emailState, 'valid');
  assert.equal(state.status, 'synced');
});

runTest('buildAccountProfileState exposes invalid email and fallback-source status', () => {
  const state = buildAccountProfileState({
    baselineProfile: {
      firstName: '',
      lastName: '',
      email: '',
      avatarUrl: undefined,
    },
    draftProfile: {
      firstName: 'Mina',
      lastName: '',
      email: 'not-an-email',
      avatarUrl: undefined,
    },
    source: 'session',
    isSaving: false,
  });

  assert.equal(state.displayName, 'Mina');
  assert.equal(state.initials, 'MI');
  assert.equal(state.completionPercentage, 25);
  assert.equal(state.hasChanges, true);
  assert.equal(state.canSave, false);
  assert.equal(state.canReset, true);
  assert.equal(state.emailState, 'invalid');
  assert.equal(state.status, 'attention');
});
