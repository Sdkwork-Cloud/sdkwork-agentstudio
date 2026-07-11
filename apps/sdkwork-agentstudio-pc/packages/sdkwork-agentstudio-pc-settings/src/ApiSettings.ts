import { Suspense, createElement, lazy } from 'react';

const LazyApiSettings = lazy(async () => {
  const module = await import('./ApiSettings.tsx');
  return { default: module.ApiSettings };
});

export function ApiSettings() {
  return createElement(Suspense, { fallback: null }, createElement(LazyApiSettings));
}
