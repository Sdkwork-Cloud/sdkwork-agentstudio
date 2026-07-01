import { useSyncExternalStore } from 'react';
import {
  type AuthStoreState,
  createAuthStore,
  synchronizeAuthStoreSession,
} from './authStore.ts';

export {
  createAuthStore,
  type AuthStoreState,
  type AuthUser,
  type EmailCodeSignInInput,
  type OAuthSignInInput,
  type PasswordResetInput,
  type PasswordResetRequestInput,
  type PhoneCodeSignInInput,
  type RegisterInput,
  type SignInInput,
} from './authStore.ts';

const authStore = createAuthStore();

synchronizeAuthStoreSession(authStore);

function useBoundAuthStore(): AuthStoreState;
function useBoundAuthStore<T>(selector: (state: AuthStoreState) => T): T;
function useBoundAuthStore<T>(selector?: (state: AuthStoreState) => T) {
  return useSyncExternalStore(
    authStore.subscribe,
    () => {
      const state = authStore.getState();
      return selector ? selector(state) : state;
    },
    () => {
      const state = authStore.getState();
      return selector ? selector(state) : state;
    },
  );
}

export const useAuthStore = Object.assign(useBoundAuthStore, {
  getState: authStore.getState,
  setState: authStore.setState,
  subscribe: authStore.subscribe,
  persist: authStore.persist,
});
