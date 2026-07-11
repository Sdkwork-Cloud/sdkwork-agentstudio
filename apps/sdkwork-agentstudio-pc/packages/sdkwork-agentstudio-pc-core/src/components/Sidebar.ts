import { Suspense, createElement, lazy } from 'react';

const LazySidebar = lazy(async () => {
  const module = await import('./Sidebar.tsx');
  return { default: module.Sidebar };
});

export function Sidebar() {
  // Keep the package-root export Node-compatible while preserving the browser component.
  return createElement(Suspense, { fallback: null }, createElement(LazySidebar));
}
