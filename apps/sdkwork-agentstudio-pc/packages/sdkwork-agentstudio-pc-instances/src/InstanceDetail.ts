import { createElement, lazy } from 'react';
import type { InstanceDetailPageEntryProps } from './pages/InstanceDetail.tsx';

const InstanceDetailPage = lazy(() =>
  import('./pages/InstanceDetail').then((module) => ({
    default: module.InstanceDetail,
  })),
);

export function InstanceDetail({
  onOpenAgentMarketModal,
}: InstanceDetailPageEntryProps) {
  return createElement(InstanceDetailPage, {
    onOpenAgentMarketModal,
  });
}
