import { lazy } from 'react';

const CommunityPage = lazy(() =>
  import('./pages/community/Community').then((module) => ({
    default: module.Community,
  })),
);

export function Community() {
  return <CommunityPage />;
}
