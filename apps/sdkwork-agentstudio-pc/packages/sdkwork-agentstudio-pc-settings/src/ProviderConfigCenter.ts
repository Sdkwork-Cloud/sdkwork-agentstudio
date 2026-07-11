import { Suspense, createElement, lazy } from 'react';

const LazyProviderConfigCenter = lazy(async () => {
  const module = await import('./ProviderConfigCenter.tsx');
  return { default: module.ProviderConfigCenter };
});

export function ProviderConfigCenter() {
  return createElement(Suspense, { fallback: null }, createElement(LazyProviderConfigCenter));
}
