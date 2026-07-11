import { Suspense, createElement, lazy } from 'react';

const LazyCommandPalette = lazy(async () => {
  const module = await import('./CommandPalette.tsx');
  return { default: module.CommandPalette };
});

export function CommandPalette() {
  // Keep the package-root export Node-compatible while preserving the browser component.
  return createElement(Suspense, { fallback: null }, createElement(LazyCommandPalette));
}
