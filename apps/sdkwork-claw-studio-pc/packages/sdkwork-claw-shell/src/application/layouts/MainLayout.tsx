import { Suspense, lazy, startTransition, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore, useKeyboardShortcuts } from '@sdkwork/claw-core';
import { AppHeader } from '../../components/AppHeader';
import { CommandPalette } from '../../components/CommandPalette';
import { GlobalTaskManager } from '../../components/GlobalTaskManager';
import { Sidebar } from '../../components/Sidebar';
import { AppRoutes } from '../router/AppRoutes';
import { ROUTE_PATHS } from '../router/routePaths';
import { shouldRenderChatRuntimeWarmersForPath } from './chatRuntimeWarmersPolicy';

const MobileAppDownloadDialog = lazy(() =>
  import('../../components/MobileAppDownloadDialog').then((module) => ({
    default: module.MobileAppDownloadDialog,
  })),
);
const ChatRuntimeWarmers = lazy(() =>
  import('../../components/ChatRuntimeWarmers').then((module) => ({
    default: module.ChatRuntimeWarmers,
  })),
);

export function MainLayout() {
  useKeyboardShortcuts();

  const location = useLocation();
  const [shouldRenderChatRuntimeWarmers, setShouldRenderChatRuntimeWarmers] = useState(false);
  const isMobileAppDialogOpen = useAppStore((state) => state.isMobileAppDialogOpen);
  const hasSeenMobileAppPrompt = useAppStore((state) => state.hasSeenMobileAppPrompt);
  const openMobileAppDialog = useAppStore((state) => state.openMobileAppDialog);
  const closeMobileAppDialog = useAppStore((state) => state.closeMobileAppDialog);
  const markMobileAppPromptSeen = useAppStore((state) => state.markMobileAppPromptSeen);
  const isAuthRoute =
    location.pathname === ROUTE_PATHS.AUTH ||
    location.pathname === ROUTE_PATHS.LOGIN ||
    location.pathname === ROUTE_PATHS.REGISTER ||
    location.pathname === ROUTE_PATHS.FORGOT_PASSWORD ||
    location.pathname.startsWith(ROUTE_PATHS.OAUTH_CALLBACK_PREFIX);
  const shouldRenderChatWarmersForPath = shouldRenderChatRuntimeWarmersForPath(
    location.pathname,
  );
  const isPromptEligibleRoute = location.pathname === ROUTE_PATHS.DASHBOARD;

  useEffect(() => {
    if (isAuthRoute || !isPromptEligibleRoute || hasSeenMobileAppPrompt) {
      return;
    }

    const timeout = window.setTimeout(() => {
      markMobileAppPromptSeen();
      openMobileAppDialog();
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [
    hasSeenMobileAppPrompt,
    isAuthRoute,
    isPromptEligibleRoute,
    markMobileAppPromptSeen,
    openMobileAppDialog,
  ]);

  useEffect(() => {
    if (!shouldRenderChatWarmersForPath) {
      setShouldRenderChatRuntimeWarmers(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setShouldRenderChatRuntimeWarmers(true);
      });
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [shouldRenderChatWarmersForPath]);

  if (isAuthRoute) {
    return (
      <div className="relative flex h-screen flex-col overflow-hidden bg-zinc-100 font-sans text-zinc-900 transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_68%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_68%)]" />
        </div>
        <AppHeader mode="auth" />
        <main className="relative z-10 min-h-0 flex-1 overflow-auto scrollbar-hide">
          <AppRoutes />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-900 font-sans transition-colors duration-300 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_68%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_68%)]" />
        <div className="absolute inset-y-0 left-0 w-80 bg-[radial-gradient(circle_at_left,_rgba(15,23,42,0.08),_transparent_72%)] dark:bg-[radial-gradient(circle_at_left,_rgba(255,255,255,0.04),_transparent_72%)]" />
      </div>
      <AppHeader />
      {shouldRenderChatRuntimeWarmers ? (
        <Suspense fallback={null}>
          <ChatRuntimeWarmers />
        </Suspense>
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative z-10 min-w-0 flex-1 overflow-auto scrollbar-hide bg-white/35 dark:bg-zinc-950/18">
          <AppRoutes />
        </main>
      </div>
      <CommandPalette />
      <GlobalTaskManager />
      {isMobileAppDialogOpen ? (
        <Suspense fallback={null}>
          <MobileAppDownloadDialog
            isOpen={isMobileAppDialogOpen}
            onClose={closeMobileAppDialog}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
