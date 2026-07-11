import { createElement, lazy } from 'react';

const NodesPage = lazy(() =>
  import('./pages/Nodes').then((module) => ({
    default: module.Nodes,
  })),
);

export function Nodes() {
  return createElement(NodesPage);
}
