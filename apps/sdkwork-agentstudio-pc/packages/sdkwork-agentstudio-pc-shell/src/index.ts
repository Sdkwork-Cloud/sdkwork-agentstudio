import './styles/index.css';

export { default as AppRoot } from './application/app/AppRoot';
export { bootstrapShellRuntime } from './application/bootstrap/bootstrapShellRuntime';
export { AppProviders } from './application/providers/AppProviders';
export {
  AuthStateBridge,
  type AuthStateSnapshot,
} from './application/providers/AuthStateBridge';
export { ThemeManager } from './application/providers/ThemeManager';
export { MainLayout } from './application/layouts/MainLayout';
export { AppRoutes } from './application/router/AppRoutes';
export { ROUTE_PATHS } from './application/router/routePaths';
export {
  listSidebarRoutePrefetchPaths,
  prefetchSidebarRoute,
  prefetchSidebarRoutes,
  resolveSidebarStartupRoute,
} from './application/router/routePrefetch';
export { AppHeader } from './components/AppHeader';
export { Sidebar } from './components/Sidebar';
export { CommandPalette } from './components/CommandPalette';
export { GlobalTaskManager } from './components/GlobalTaskManager';
