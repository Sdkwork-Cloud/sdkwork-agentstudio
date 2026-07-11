import { lazy } from 'react';

const CommunityPostDetailPage = lazy(() =>
  import('./pages/community/CommunityPostDetail').then((module) => ({
    default: module.CommunityPostDetail,
  })),
);

export function CommunityPostDetail() {
  return <CommunityPostDetailPage />;
}
