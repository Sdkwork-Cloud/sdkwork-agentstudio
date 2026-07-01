import { startTransition, useEffect, useEffectEvent } from 'react';
import { ROUTE_PATHS } from '@sdkwork/claw-shell';
import { DESKTOP_EVENTS } from '../catalog';
import { listenDesktopEvent } from '../runtime';

const ALLOWED_TRAY_ROUTES = new Set<string>([
  ROUTE_PATHS.DASHBOARD,
  ROUTE_PATHS.INSTANCES,
  ROUTE_PATHS.TASKS,
  ROUTE_PATHS.SETTINGS,
]);

interface TrayNavigatePayload {
  route: string;
}

declare global {
  interface Window {
    __CLAW_PENDING_TRAY_ROUTE__?: string;
  }
}

export function DesktopTrayRouteBridge() {
  const applyRoute = useEffectEvent((nextRoute: string) => {
    const route = nextRoute.trim();
    if (!ALLOWED_TRAY_ROUTES.has(route)) {
      return;
    }

    window.__CLAW_PENDING_TRAY_ROUTE__ = undefined;
    if (window.location.pathname === route) {
      return;
    }

    startTransition(() => {
      window.history.pushState({}, '', route);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  });

  useEffect(() => {
    const pendingRoute = window.__CLAW_PENDING_TRAY_ROUTE__;
    if (pendingRoute) {
      applyRoute(pendingRoute);
    }
  }, [applyRoute]);

  useEffect(() => {
    const handleWindowEvent = (event: Event) => {
      const route = (event as CustomEvent<TrayNavigatePayload>).detail?.route;
      if (typeof route === 'string') {
        applyRoute(route);
      }
    };

    window.addEventListener('claw:tray-navigate', handleWindowEvent as EventListener);

    let disposed = false;
    let unlisten = () => {};

    void listenDesktopEvent<TrayNavigatePayload>(
      DESKTOP_EVENTS.trayNavigate,
      (payload) => {
        applyRoute(payload.route);
      },
      { operation: 'tray.navigate' },
    ).then((nextUnlisten) => {
      if (disposed) {
        void nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    });

    return () => {
      disposed = true;
      window.removeEventListener('claw:tray-navigate', handleWindowEvent as EventListener);
      void unlisten();
    };
  }, [applyRoute]);

  return null;
}
