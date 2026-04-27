import assert from 'node:assert/strict';
import { createClient } from '@sdkwork/app-sdk';
import { createClawHubService } from './clawHubService.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
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
  'clawHubService maps generated app sdk skill payloads into ClawHub domain objects',
  async () => {
    const service = createClawHubService({
      getSessionTokens: () => ({
        authToken: 'auth-token',
      }),
      getClient: () =>
        ({
          skill: {
            listCategories: async () => ({
              code: '2000',
              data: [
                {
                  id: 1,
                  code: 'development',
                  name: 'Development',
                },
              ],
            }),
            list: async (params?: Record<string, unknown>) => {
              assert.equal(params?.categoryId, '1');
              assert.equal(params?.keyword, 'github');
              return {
              code: '2000',
              data: {
                content: [
                  {
                    skillId: 7,
                    skillKey: 'github-pr-assistant',
                    name: 'GitHub PR Assistant',
                    summary: 'Review pull requests faster.',
                    description: 'Review pull requests faster.',
                    categoryName: 'Development',
                    authorName: 'SDKWork',
                    provider: 'sdkwork',
                    version: '1.2.0',
                    installCount: 3200,
                    ratingAvg: 4.8,
                    ratingCount: 128,
                    repositoryUrl: 'https://github.com/sdkwork/github-pr-assistant',
                    homepageUrl: 'https://clawhub.sdkwork.com/skills/github-pr-assistant',
                    documentationUrl: 'https://docs.sdkwork.com/skills/github-pr-assistant',
                    updatedAt: '2026-03-24T09:00:00Z',
                  },
                ],
              },
              };
            },
            detail: async (skillId: string | number) => {
              assert.equal(skillId, '7');
              return {
                code: '2000',
                data: {
                  skillId: 7,
                  skillKey: 'github-pr-assistant',
                  name: 'GitHub PR Assistant',
                  summary: 'Review pull requests faster.',
                  description: 'Review pull requests faster.',
                  categoryName: 'Development',
                  authorName: 'SDKWork',
                  version: '1.2.0',
                  installCount: 3200,
                  ratingAvg: 4.8,
                  ratingCount: 128,
                  repositoryUrl: 'https://github.com/sdkwork/github-pr-assistant',
                  homepageUrl: 'https://clawhub.sdkwork.com/skills/github-pr-assistant',
                  documentationUrl: 'https://docs.sdkwork.com/skills/github-pr-assistant',
                  updatedAt: '2026-03-24T09:00:00Z',
                  descriptionMd: '# GitHub PR Assistant',
                },
              };
            },
            listPackages: async (...args: unknown[]) => {
              assert.equal(args.length, 0);
              return {
              code: '2000',
              data: [
                {
                  packageId: 11,
                  packageKey: 'developer-pack',
                  name: 'Developer Pack',
                  description: 'A curated pack for developers.',
                  categoryId: 1,
                  categoryName: 'Development',
                  authorName: 'SDKWork',
                  installCount: 5600,
                  ratingAvg: 4.9,
                  skills: [
                    {
                      skillId: 7,
                      skillKey: 'github-pr-assistant',
                      name: 'GitHub PR Assistant',
                      description: 'Review pull requests faster.',
                      categoryName: 'Development',
                      authorName: 'SDKWork',
                      installCount: 3200,
                      ratingAvg: 4.8,
                    },
                  ],
                },
                {
                  packageId: 12,
                  packageKey: 'marketing-pack',
                  name: 'Marketing Pack',
                  description: 'A curated pack for growth.',
                  categoryId: 2,
                  categoryName: 'Marketing',
                  authorName: 'SDKWork',
                  installCount: 1800,
                  ratingAvg: 4.4,
                  skills: [],
                },
              ],
              };
            },
            detailPackage: async (packageId: string | number) => {
              assert.equal(packageId, '11');
              return {
                code: '2000',
                data: {
                  packageId: 11,
                  packageKey: 'developer-pack',
                  name: 'Developer Pack',
                  description: 'A curated pack for developers.',
                  categoryName: 'Development',
                  authorName: 'SDKWork',
                  installCount: 5600,
                  ratingAvg: 4.9,
                  skills: [
                    {
                      skillId: 7,
                      skillKey: 'github-pr-assistant',
                      name: 'GitHub PR Assistant',
                      description: 'Review pull requests faster.',
                      categoryName: 'Development',
                      authorName: 'SDKWork',
                      installCount: 3200,
                      ratingAvg: 4.8,
                    },
                  ],
                },
              };
            },
            listReviews: async (skillId: string | number) => {
              assert.equal(skillId, '7');
              return {
                code: '2000',
                data: [
                  {
                    reviewId: 'review-1',
                    userId: 99,
                    userName: 'OpenClaw',
                    rating: 5,
                    comment: 'Excellent skill.',
                    createdAt: '2026-03-24T10:00:00Z',
                  },
                ],
              };
            },
          },
        }) as any,
    });

    const categories = await service.listCategories();
    const skills = await service.listSkills({ categoryId: '1', keyword: 'github' });
    const skill = await service.getSkill('7');
    const packages = await service.listPackages({ categoryId: '1', keyword: 'developer' });
    const skillPackage = await service.getPackage('11');
    const reviews = await service.listReviews('7');

    assert.deepEqual(categories.map((item) => item.name), ['Development']);
    assert.equal(skills[0]?.id, '7');
    assert.equal(skills[0]?.skillKey, 'github-pr-assistant');
    assert.equal(skills[0]?.author, 'SDKWork');
    assert.equal(skills[0]?.downloads, 3200);
    assert.equal(skills[0]?.ratingCount, 128);
    assert.equal(skill.readme, '# GitHub PR Assistant');
    assert.equal(skill.repositoryUrl, 'https://github.com/sdkwork/github-pr-assistant');
    assert.equal(packages.length, 1);
    assert.equal(packages[0]?.packageKey, 'developer-pack');
    assert.equal(packages[0]?.skills[0]?.skillKey, 'github-pr-assistant');
    assert.equal(skillPackage.skills[0]?.id, '7');
    assert.equal(reviews[0]?.user_name, 'OpenClaw');
  },
);

await runTest(
  'clawHubService issues generated app sdk HTTP requests for ClawHub resources when auth exists',
  async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });

      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl);

      if (url.pathname === '/app/v3/api/skills/categories') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/skills/packages') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/skills/packages/11') {
        return new Response(JSON.stringify({ code: '2000', data: { packageId: 11, skills: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/skills/7/reviews') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/skills/7') {
        return new Response(JSON.stringify({ code: '2000', data: { skillId: 7 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          code: '2000',
          data: {
            content: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const service = createClawHubService({
        getSessionTokens: () => ({
          authToken: 'session-auth-token',
        }),
        getClient: () =>
          createClient({
            baseUrl: 'https://api.sdkwork.test',
            accessToken: 'access-token',
          }) as any,
      });

      await service.listCategories();
      await service.listSkills({ categoryId: '1', keyword: 'github' });
      await service.listPackages({ categoryId: '1', keyword: 'developer' });
      await service.getPackage('11');
      await service.getSkill('7');
      await service.listReviews('7');
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 6);

    const urls = fetchCalls.map(({ input }) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return new URL(rawUrl);
    });

    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/skills/categories'));
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/skills' &&
          url.searchParams.get('categoryId') === '1' &&
          url.searchParams.get('keyword') === 'github',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/skills/packages' &&
          !url.searchParams.get('categoryId') &&
          !url.searchParams.get('keyword'),
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/skills/packages/11'));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/skills/7'));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/skills/7/reviews'));
  },
);

await runTest(
  'clawHubService fails fast when skill pagination never reaches a terminal page',
  async () => {
    let pageCalls = 0;
    const service = createClawHubService({
      getSessionTokens: () => ({
        authToken: 'auth-token',
      }),
      getClient: () =>
        ({
          skill: {
            list: async (params?: Record<string, unknown>) => {
              pageCalls += 1;
              assert.equal(params?.pageSize, 100);

              if (pageCalls > 25) {
                throw new Error('ClawHub pagination should stop before requesting page 26.');
              }

              return {
                code: '2000',
                data: {
                  content: Array.from({ length: 100 }, (_, index) => ({
                    skillId: `${pageCalls}-${index}`,
                    name: `Skill ${pageCalls}-${index}`,
                  })),
                },
              };
            },
          },
        }) as any,
    });

    await assert.rejects(
      () => service.listSkills(),
      /ClawHub skills pagination exceeded 25 pages/,
    );
    assert.equal(pageCalls, 25);
  },
);
