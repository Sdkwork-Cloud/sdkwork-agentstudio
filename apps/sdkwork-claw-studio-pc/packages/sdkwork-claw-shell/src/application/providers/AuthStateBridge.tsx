import { useEffect } from 'react';
import { useAuthStore } from '@sdkwork/claw-core';

export interface AuthStateSnapshot {
  isAuthenticated: boolean;
  user: {
    email: string;
    displayName: string;
  } | null;
}

interface AuthStateBridgeProps {
  onChange?: (state: AuthStateSnapshot) => void;
}

export function AuthStateBridge({ onChange }: AuthStateBridgeProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userEmail = useAuthStore((state) => state.user?.email ?? '');
  const userDisplayName = useAuthStore((state) => state.user?.displayName ?? '');

  useEffect(() => {
    onChange?.({
      isAuthenticated,
      user: userEmail
        ? {
            email: userEmail,
            displayName: userDisplayName,
          }
        : null,
    });
  }, [isAuthenticated, onChange, userDisplayName, userEmail]);

  return null;
}
