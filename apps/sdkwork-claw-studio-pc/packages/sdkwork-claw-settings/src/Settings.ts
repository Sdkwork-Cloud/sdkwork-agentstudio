import { Suspense, createElement, lazy } from 'react';

const LazySettings = lazy(async () => {
  const module = await import('./Settings.tsx');
  return { default: module.Settings };
});

export function Settings() {
  // Keep the package-root export Node-compatible while preserving the browser settings page.
  return createElement(Suspense, { fallback: null }, createElement(LazySettings));
}
