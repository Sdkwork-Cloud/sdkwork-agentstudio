import assert from 'node:assert/strict';
import type { CommunityComment, CommunityPost } from './communityService.ts';

function runTest(name: string, callback: () => Promise<void> | void) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createPost(overrides: Partial<CommunityPost> = {}): CommunityPost {
  return {
    id: overrides.id ?? 'post-1',
    title: overrides.title ?? 'Remote legal contract review',
    content: overrides.content ?? 'Contract review for AI teams.',
    author: overrides.author ?? {
      name: 'OpenClaw Legal Desk',
      avatar: '',
      role: 'Service Partner',
    },
    category: overrides.category ?? 'services',
    publisherType: overrides.publisherType ?? 'company',
    tags: overrides.tags ?? ['legal', 'contracts'],
    stats: overrides.stats ?? {
      likes: 8,
      comments: 2,
      views: 120,
    },
    createdAt: overrides.createdAt ?? '2026-03-24T09:00:00Z',
    company: overrides.company ?? 'OpenClaw Legal Desk',
    location: overrides.location ?? 'Remote',
    compensation: overrides.compensation ?? 'From 899 CNY',
    isBookmarked: overrides.isBookmarked ?? false,
    coverImage: overrides.coverImage,
    employmentType: overrides.employmentType,
    contactPreference: overrides.contactPreference,
    serviceLine: overrides.serviceLine,
    deliveryMode: overrides.deliveryMode,
    turnaround: overrides.turnaround,
    isFeatured: overrides.isFeatured,
    assistantActions: overrides.assistantActions,
    isLiked: overrides.isLiked,
    backendCategoryId: overrides.backendCategoryId,
    backendCategoryCode: overrides.backendCategoryCode,
    backendCategoryName: overrides.backendCategoryName,
  };
}

function createComment(overrides: Partial<CommunityComment> = {}): CommunityComment {
  return {
    id: overrides.id ?? 'comment-1',
    author: overrides.author ?? {
      name: 'Alice',
      avatar: '',
    },
    content: overrides.content ?? 'Can you review contractor agreements too?',
    createdAt: overrides.createdAt ?? '2026-03-24T11:00:00Z',
    likes: overrides.likes ?? 0,
  };
}

const {
  buildCommunitySharePayload,
  mergeCommunityComments,
  toggleCommunityPostBookmark,
} = await import('./communityPostDetailPresentation.ts');

await runTest('mergeCommunityComments prepends new comments and removes duplicates by id', () => {
  const existing = [
    createComment({
      id: 'comment-1',
      createdAt: '2026-03-24T10:00:00Z',
      content: 'First comment',
    }),
    createComment({
      id: 'comment-2',
      createdAt: '2026-03-24T09:00:00Z',
      content: 'Older comment',
    }),
  ];
  const created = createComment({
    id: 'comment-1',
    createdAt: '2026-03-24T11:30:00Z',
    content: 'Updated first comment',
  });

  const next = mergeCommunityComments(existing, created);

  assert.deepEqual(
    next.map((comment) => comment.id),
    ['comment-1', 'comment-2'],
  );
  assert.equal(next[0]?.content, 'Updated first comment');
  assert.equal(next[0]?.createdAt, '2026-03-24T11:30:00Z');
});

await runTest('toggleCommunityPostBookmark flips the bookmarked state without mutating the original post', () => {
  const original = createPost({
    isBookmarked: false,
  });

  const next = toggleCommunityPostBookmark(original);

  assert.equal(original.isBookmarked, false);
  assert.equal(next.isBookmarked, true);
  assert.equal(next.id, original.id);
  assert.equal(next.title, original.title);
});

await runTest('buildCommunitySharePayload creates a readable share summary from classifieds metadata', () => {
  const post = createPost({
    title: 'Remote legal contract review',
    company: 'OpenClaw Legal Desk',
    location: 'Remote',
    compensation: 'From 899 CNY',
    tags: ['legal', 'contracts', 'ai'],
  });

  const payload = buildCommunitySharePayload(
    post,
    'https://studio.local/community/post-1',
  );

  assert.equal(payload.title, 'Remote legal contract review');
  assert.equal(payload.url, 'https://studio.local/community/post-1');
  assert.equal(
    payload.text,
    'Remote legal contract review\nOpenClaw Legal Desk / Remote / From 899 CNY\n#legal #contracts #ai',
  );
});
