import { Suspense, createElement, lazy } from 'react';

const LazyKernelCenter = lazy(async () => {
  const module = await import('./KernelCenter.tsx');
  return { default: module.KernelCenter };
});

export function KernelCenter() {
  return createElement(Suspense, { fallback: null }, createElement(LazyKernelCenter));
}
