import { createElement, lazy } from 'react';

const InstancesPage = lazy(() =>
  import('./pages/Instances').then((module) => ({
    default: module.Instances,
  })),
);

export function Instances() {
  return createElement(InstancesPage);
}
