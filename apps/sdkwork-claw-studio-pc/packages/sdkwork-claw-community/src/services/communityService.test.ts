import assert from 'node:assert/strict';
import { createCommunityService } from './communityService.ts';

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

await runTest(
  'communityService maps feed, category, and comment sdk payloads into classifieds entries',
  async () => {
    const service = createCommunityService({
      getClient: () =>
        ({
          category: {
            listCategories: async () => ({
              code: '2000',
              data: [
                { id: 11, code: 'legal-services', name: 'Legal Services' },
                { id: 12, code: 'platform-news', name: 'Platform News' },
              ],
            }),
          },
          feed: {
            getFeedList: async () => ({
              code: '2000',
              data: [
                {
                  id: 101,
                  categoryId: 11,
                  title: 'Remote legal contract review for AI startups',
                  content:
                    '<!-- claw-community-meta {\"publisherType\":\"company\",\"location\":\"Remote\",\"compensation\":\"From 899 CNY\",\"company\":\"Claw Legal Desk\",\"serviceLine\":\"legal\",\"deliveryMode\":\"online\",\"turnaround\":\"48 hours\",\"contactPreference\":\"Book through OpenClaw\"} -->\n\n# Service scope\n\nContract review and compliance support.',
                  tags: ['legal', 'contracts', 'remote'],
                  author: {
                    name: 'Claw Legal Desk',
                    avatar: 'https://cdn.sdkwork.test/legal.png',
                    bio: 'Remote legal counsel for AI teams.',
                  },
                  viewCount: 120,
                  likeCount: 8,
                  commentCount: 2,
                  shareCount: 3,
                  isRecommended: true,
                  createdAt: '2026-03-24T09:00:00Z',
                },
                {
                  id: 102,
                  categoryId: 12,
                  title: 'Platform weekly update',
                  content: 'This week in OpenClaw.',
                  tags: ['news'],
                  author: {
                    name: 'OpenClaw Official',
                  },
                  createdAt: '2026-03-23T09:00:00Z',
                },
              ],
            }),
            getFeedDetail: async (id: string | number) => {
              assert.equal(id, '101');
              return {
                code: '2000',
                data: {
                  id: 101,
                  categoryId: 11,
                  title: 'Remote legal contract review for AI startups',
                  content:
                    '<!-- claw-community-meta {\"publisherType\":\"company\",\"location\":\"Remote\",\"compensation\":\"From 899 CNY\",\"company\":\"Claw Legal Desk\",\"serviceLine\":\"legal\",\"deliveryMode\":\"online\",\"turnaround\":\"48 hours\",\"contactPreference\":\"Book through OpenClaw\"} -->\n\n# Service scope\n\nContract review and compliance support.',
                  tags: ['legal', 'contracts', 'remote'],
                  author: {
                    name: 'Claw Legal Desk',
                    avatar: 'https://cdn.sdkwork.test/legal.png',
                    bio: 'Remote legal counsel for AI teams.',
                  },
                  viewCount: 120,
                  likeCount: 8,
                  commentCount: 2,
                  shareCount: 3,
                  isRecommended: true,
                  createdAt: '2026-03-24T09:00:00Z',
                },
              };
            },
          },
          comment: {
            getComments: async () => ({
              code: '2000',
              data: {
                content: [
                  {
                    commentId: 'c-1',
                    content: 'Can you review contractor agreements as well?',
                    createdAt: '2026-03-24T10:00:00Z',
                    likes: 4,
                    author: {
                      name: 'Alice',
                      avatar: 'https://cdn.sdkwork.test/alice.png',
                    },
                  },
                ],
              },
            }),
          },
        }) as any,
    });

    const serviceEntries = await service.getPosts('services');
    const newsEntries = await service.getPosts('news');
    const detail = await service.getPost('101');
    const comments = await service.getComments('101');

    assert.equal(serviceEntries.length, 1);
    assert.equal(serviceEntries[0]?.category, 'services');
    assert.equal(serviceEntries[0]?.company, 'Claw Legal Desk');
    assert.equal(serviceEntries[0]?.serviceLine, 'legal');
    assert.equal(serviceEntries[0]?.deliveryMode, 'online');
    assert.equal(serviceEntries[0]?.turnaround, '48 hours');
    assert.equal(serviceEntries[0]?.author.role, 'Service Partner');
    assert.equal(serviceEntries[0]?.stats.likes, 8);
    assert.equal(serviceEntries[0]?.content.includes('claw-community-meta'), false);

    assert.equal(newsEntries.length, 1);
    assert.equal(newsEntries[0]?.category, 'news');
    assert.equal(newsEntries[0]?.publisherType, 'official');

    assert.equal(detail.category, 'services');
    assert.equal(detail.location, 'Remote');
    assert.equal(detail.compensation, 'From 899 CNY');
    assert.equal(detail.contactPreference, 'Book through OpenClaw');

    assert.equal(comments.length, 1);
    assert.equal(comments[0]?.author.name, 'Alice');
    assert.equal(comments[0]?.likes, 4);
  },
);

await runTest(
  'communityService creates feeds through the app sdk and persists classifieds metadata inside feed content',
  async () => {
    const capturedPayloads: Record<string, unknown>[] = [];

    const service = createCommunityService({
      getClient: () =>
        ({
          category: {
            listCategories: async () => ({
              code: '2000',
              data: [
                { id: 11, code: 'services', name: 'Services' },
                { id: 12, code: 'job-seeking', name: 'Job Seeking' },
              ],
            }),
          },
          feed: {
            getFeedList: async () => ({
              code: '2000',
              data: [],
            }),
            create: async (body: Record<string, unknown>) => {
              capturedPayloads.push(body);
              return {
                code: '2000',
                data: {
                  id: 201,
                  categoryId: 11,
                  title: body.title,
                  content: body.content,
                  tags: body.tags,
                  coverImage: 'https://cdn.sdkwork.test/service-cover.png',
                  author: {
                    name: 'FlowForge Studio',
                    bio: 'Automation delivery partner.',
                  },
                  viewCount: 0,
                  likeCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                  createdAt: '2026-03-24T11:00:00Z',
                },
              };
            },
          },
          comment: {
            getComments: async () => ({
              code: '2000',
              data: { content: [] },
            }),
          },
        }) as any,
    });

    const created = await service.create({
      title: 'Automation landing page sprint',
      content: 'Build a launch-ready landing page and workflow automation.',
      category: 'services',
      publisherType: 'company',
      company: 'FlowForge Studio',
      location: 'Remote',
      compensation: 'From 8k CNY',
      serviceLine: 'development',
      deliveryMode: 'online',
      turnaround: '7 days',
      contactPreference: 'Route leads through OpenClaw',
      tags: ['automation', 'landing-page'],
      coverImage: 'https://cdn.sdkwork.test/service-cover.png',
    });

    const capturedPayload = capturedPayloads[0];
    assert.ok(capturedPayload);
    assert.equal(capturedPayload['categoryId'], 11);
    assert.deepEqual(capturedPayload['tags'], ['automation', 'landing-page']);
    assert.deepEqual(capturedPayload['images'], ['https://cdn.sdkwork.test/service-cover.png']);
    assert.equal(capturedPayload['source'], 'claw-studio-community');
    assert.equal(typeof capturedPayload['content'], 'string');
    assert.match(String(capturedPayload['content']), /claw-community-meta/);
    assert.match(String(capturedPayload['content']), /"serviceLine":"development"/);
    assert.match(String(capturedPayload['content']), /"deliveryMode":"online"/);

    assert.equal(created.id, '201');
    assert.equal(created.category, 'services');
    assert.equal(created.company, 'FlowForge Studio');
    assert.equal(created.serviceLine, 'development');
    assert.equal(created.deliveryMode, 'online');
    assert.equal(created.turnaround, '7 days');
    assert.equal(created.coverImage, 'https://cdn.sdkwork.test/service-cover.png');
  },
);
