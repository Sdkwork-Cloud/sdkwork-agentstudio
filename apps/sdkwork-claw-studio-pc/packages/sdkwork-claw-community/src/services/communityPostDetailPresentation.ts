import type { CommunityComment, CommunityPost } from './communityService.ts';

export interface CommunitySharePayload {
  title: string;
  text: string;
  url: string;
}

export function mergeCommunityComments(
  comments: CommunityComment[],
  nextComment: CommunityComment,
): CommunityComment[] {
  return [
    nextComment,
    ...comments.filter((comment) => comment.id !== nextComment.id),
  ];
}

export function toggleCommunityPostBookmark(post: CommunityPost): CommunityPost {
  return {
    ...post,
    isBookmarked: !post.isBookmarked,
  };
}

export function buildCommunitySharePayload(
  post: CommunityPost,
  url: string,
): CommunitySharePayload {
  const metaLine = [
    post.company || post.author.name,
    post.location,
    post.compensation,
  ]
    .filter(Boolean)
    .join(' / ');
  const tagLine = post.tags.slice(0, 3).map((tag) => `#${tag}`).join(' ');

  return {
    title: post.title,
    text: [post.title, metaLine, tagLine].filter(Boolean).join('\n'),
    url,
  };
}
