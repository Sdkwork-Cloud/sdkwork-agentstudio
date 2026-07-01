import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import { useAppStore, type LanguagePreference } from '@sdkwork/claw-core';
import { ensureI18n, i18n } from '@sdkwork/claw-i18n';
import { LanguageManager } from './LanguageManager';
import { ThemeManager } from './ThemeManager';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export interface AppProvidersProps {
  children: ReactNode;
  onLanguagePreferenceChange?: (languagePreference: LanguagePreference) => void;
}

export function AppProviders({
  children,
  onLanguagePreferenceChange,
}: AppProvidersProps) {
  const themeMode = useAppStore((state) => state.themeMode);
  const startupCheckStartedRef = useRef(false);

  useEffect(() => {
    void ensureI18n();
  }, []);

  useEffect(() => {
    if (!startupCheckStartedRef.current) {
      startupCheckStartedRef.current = true;
    }

    let cancelled = false;
    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    const runDeferredStartupCheck = async () => {
      try {
        const { useUpdateStore } = await import('@sdkwork/claw-core');
        if (cancelled) {
          return;
        }

        const [updateCheckResult] = await Promise.allSettled([
          useUpdateStore.getState().runStartupCheck(),
        ]);

        if (updateCheckResult.status === 'rejected') {
          throw updateCheckResult.reason;
        }
      } catch (error) {
        console.error('Failed to run deferred startup update check:', error);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(
        () => {
          void runDeferredStartupCheck();
        },
        { timeout: 1500 },
      );
    } else {
      timeoutId = globalThis.setTimeout(() => {
        void runDeferredStartupCheck();
      }, 250);
    }

    return () => {
      cancelled = true;

      if (idleCallbackId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeManager />
        <LanguageManager onLanguagePreferenceChange={onLanguagePreferenceChange} />
        <Router>
          {children}
          <Toaster
            position="bottom-right"
            richColors
            theme={themeMode === 'system' ? 'system' : themeMode === 'dark' ? 'dark' : 'light'}
          />
        </Router>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
