import { Suspense, createElement, lazy } from 'react';

export interface DesktopWindowControlsProps {
  variant?: 'header' | 'floating';
  className?: string;
  labels?: DesktopWindowControlLabels;
}

export interface DesktopWindowControlLabels {
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
}

const LazyDesktopWindowControls = lazy(async () => {
  const module = await import('./DesktopWindowControls.tsx');
  return { default: module.DesktopWindowControls };
});

export function DesktopWindowControls(props: DesktopWindowControlsProps) {
  // Keep the package-root export Node-compatible while preserving the browser component.
  return createElement(
    Suspense,
    { fallback: null },
    createElement(LazyDesktopWindowControls, props),
  );
}
