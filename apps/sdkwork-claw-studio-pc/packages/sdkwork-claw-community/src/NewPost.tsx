import { lazy } from 'react';

const NewPostPage = lazy(() =>
  import('./pages/community/NewPost').then((module) => ({
    default: module.NewPost,
  })),
);

export function NewPost() {
  return <NewPostPage />;
}
