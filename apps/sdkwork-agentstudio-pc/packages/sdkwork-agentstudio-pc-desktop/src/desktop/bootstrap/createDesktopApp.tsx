import { createRoot } from 'react-dom/client';
import { configureDesktopPlatformBridge } from '../tauriBridge';
import {
  applyStartupAppearanceHints,
  DesktopBootstrapApp,
  resolveDesktopBootstrapContext,
} from './DesktopBootstrapApp';

export async function createDesktopApp() {
  const bootstrapContext = resolveDesktopBootstrapContext();
  applyStartupAppearanceHints(bootstrapContext.initialAppearance);
  configureDesktopPlatformBridge();

  createRoot(document.getElementById('root')!).render(
    <DesktopBootstrapApp
      appName={bootstrapContext.appName}
      initialAppearance={bootstrapContext.initialAppearance}
    />,
  );
}
