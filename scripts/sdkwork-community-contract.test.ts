import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return [next, ...flattenKeys(nested, next)];
  });
}

function extractCommunityTranslationKeys() {
  const files = [
    'packages/sdkwork-clawstudio-community/src/pages/community/Community.tsx',
    'packages/sdkwork-clawstudio-community/src/pages/community/CommunityPostDetail.tsx',
    'packages/sdkwork-clawstudio-community/src/pages/community/NewPost.tsx',
    'packages/sdkwork-clawstudio-community/src/pages/community/NewPostWorkspace.tsx',
  ];
  const pattern = /community\.[A-Za-z0-9_.]+/g;
  const matches = new Set<string>();

  for (const file of files) {
    for (const match of read(file).match(pattern) ?? []) {
      if (!match.endsWith('.')) {
        matches.add(match);
      }
    }
  }

  for (const dynamicKey of [
    'community.newPost.publisherTypes.personal',
    'community.newPost.publisherTypes.company',
    'community.newPost.publisherTypes.official',
    'community.newPost.serviceLines.legal',
    'community.newPost.serviceLines.tax',
    'community.newPost.serviceLines.design',
    'community.newPost.serviceLines.development',
    'community.newPost.serviceLines.marketing',
    'community.newPost.serviceLines.translation',
    'community.newPost.serviceLines.operations',
    'community.newPost.serviceLines.training',
    'community.newPost.serviceLines.consulting',
    'community.newPost.serviceLines.content',
    'community.newPost.serviceLines.data',
    'community.newPost.serviceLines.hr',
    'community.newPost.deliveryModes.online',
    'community.newPost.deliveryModes.hybrid',
    'community.newPost.deliveryModes.onsite',
    'community.postDetail.listingMeta.publisherTypes.personal',
    'community.postDetail.listingMeta.publisherTypes.company',
    'community.postDetail.listingMeta.publisherTypes.official',
    'community.postDetail.listingMeta.serviceLines.legal',
    'community.postDetail.listingMeta.serviceLines.tax',
    'community.postDetail.listingMeta.serviceLines.design',
    'community.postDetail.listingMeta.serviceLines.development',
    'community.postDetail.listingMeta.serviceLines.marketing',
    'community.postDetail.listingMeta.serviceLines.translation',
    'community.postDetail.listingMeta.serviceLines.operations',
    'community.postDetail.listingMeta.serviceLines.training',
    'community.postDetail.listingMeta.serviceLines.consulting',
    'community.postDetail.listingMeta.serviceLines.content',
    'community.postDetail.listingMeta.serviceLines.data',
    'community.postDetail.listingMeta.serviceLines.hr',
    'community.postDetail.listingMeta.deliveryModes.online',
    'community.postDetail.listingMeta.deliveryModes.hybrid',
    'community.postDetail.listingMeta.deliveryModes.onsite',
  ]) {
    matches.add(dynamicKey);
  }

  return [...matches].sort();
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-clawstudio-community keeps the V5 community package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-clawstudio-community/package.json',
  );
  const indexSource = read('packages/sdkwork-clawstudio-community/src/index.ts');
  const communityEntrySource = read('packages/sdkwork-clawstudio-community/src/Community.tsx');
  const detailEntrySource = read('packages/sdkwork-clawstudio-community/src/CommunityPostDetail.tsx');
  const newPostEntrySource = read('packages/sdkwork-clawstudio-community/src/NewPost.tsx');

  assert.ok(exists('packages/sdkwork-clawstudio-community/src/Community.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-community/src/CommunityPostDetail.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-community/src/NewPost.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-community/src/pages/community/Community.tsx'));
  assert.ok(exists('packages/sdkwork-clawstudio-community/src/services/communityService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/clawstudio-studio-community']);
  assert.ok(!pkg.dependencies?.['@google/genai']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-community/);
  assert.match(communityEntrySource, /lazy\(\(\) =>/);
  assert.match(communityEntrySource, /\.\/pages\/community\/Community/);
  assert.match(detailEntrySource, /lazy\(\(\) =>/);
  assert.match(detailEntrySource, /\.\/pages\/community\/CommunityPostDetail/);
  assert.match(newPostEntrySource, /lazy\(\(\) =>/);
  assert.match(newPostEntrySource, /\.\/pages\/community\/NewPost/);
});

runTest(
  'sdkwork-clawstudio-community exposes a classified-information landing instead of the old article community',
  () => {
    const pageSource = read('packages/sdkwork-clawstudio-community/src/pages/community/Community.tsx');

    assert.match(pageSource, /useTranslation/);
    assert.match(pageSource, /id: 'job-seeking'/);
    assert.match(pageSource, /id: 'recruitment'/);
    assert.match(pageSource, /id: 'services'/);
    assert.match(pageSource, /id: 'news'/);
    assert.match(pageSource, /t\('community\.page\.title'\)/);
    assert.match(pageSource, /t\('community\.page\.subtitle'\)/);
    assert.match(pageSource, /t\('community\.page\.searchPlaceholder'\)/);
    assert.match(pageSource, /t\('community\.page\.newPost'\)/);
    assert.match(pageSource, /community\.page\.feedEyebrow/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.legal\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.consulting\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.content\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.data\.title/);
    assert.match(pageSource, /community\.page\.serviceCatalog\.items\.hr\.title/);
    assert.match(pageSource, /community\.page\.rails\.urgentRecruitment/);
    assert.match(pageSource, /community\.page\.rails\.onlineServices/);
    assert.match(pageSource, /community\.page\.rails\.platformNews/);
    assert.match(pageSource, /xl:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
    assert.match(pageSource, /xl:sticky xl:top-6 xl:self-start/);
    assert.doesNotMatch(pageSource, /community\.page\.hero\./);
    assert.doesNotMatch(pageSource, /community\.page\.assistantWorkbench\./);
    assert.doesNotMatch(pageSource, /community\.page\.revenueServices\./);
    assert.doesNotMatch(pageSource, /community\.page\.latestClaw/);
    assert.doesNotMatch(pageSource, /community\.page\.onlineClaw/);
    assert.doesNotMatch(pageSource, /community\.page\.hottestClaw/);
  },
);

runTest('sdkwork-clawstudio-community routes classifieds through the shared app sdk instead of local mock data', () => {
  const serviceSource = read('packages/sdkwork-clawstudio-community/src/services/communityService.ts');
  const coreServiceSource = read('packages/sdkwork-clawstudio-core/src/services/communityService.ts');
  const recommendationSource = read(
    'packages/sdkwork-clawstudio-community/src/services/communityRecommendations.ts',
  );
  const newPostSource = read('packages/sdkwork-clawstudio-community/src/pages/community/NewPostWorkspace.tsx');
  const llmServiceSource = read('packages/sdkwork-clawstudio-community/src/services/llmService.ts');
  const detailSource = read('packages/sdkwork-clawstudio-community/src/pages/community/CommunityPostDetail.tsx');

  assert.match(serviceSource, /@sdkwork\/claw-core/);
  assert.match(serviceSource, /communityService/);
  assert.doesNotMatch(serviceSource, /getAppSdkClientWithSession/);
  assert.doesNotMatch(serviceSource, /unwrapAppSdkResponse/);
  assert.doesNotMatch(serviceSource, /client\.feed\.getFeedList/);
  assert.doesNotMatch(serviceSource, /client\.feed\.getFeedDetail/);
  assert.doesNotMatch(serviceSource, /client\.feed\.create/);
  assert.doesNotMatch(serviceSource, /client\.comment\.getComments/);
  assert.doesNotMatch(serviceSource, /client\.comment\.createComment/);
  assert.doesNotMatch(serviceSource, /client\.category\.listCategories/);
  assert.match(coreServiceSource, /createCommunityService/);
  assert.match(coreServiceSource, /getClawStudioAppClientWithSession/);
  assert.doesNotMatch(coreServiceSource, /getAppSdkClientWithSession/);
  assert.match(coreServiceSource, /unwrapAppSdkResponse/);
  assert.match(coreServiceSource, /client\.feed\.getFeedList/);
  assert.match(coreServiceSource, /client\.feed\.getFeedDetail/);
  assert.match(coreServiceSource, /client\.feed\.create/);
  assert.match(coreServiceSource, /client\.comment\.getComments/);
  assert.match(coreServiceSource, /client\.comment\.createComment/);
  assert.match(coreServiceSource, /client\.category\.listCategories/);
  assert.match(coreServiceSource, /claw-community-meta/);
  assert.doesNotMatch(serviceSource, /const postsData:\s*CommunityPost\[]/);
  assert.doesNotMatch(serviceSource, /const commentsData:/);
  assert.doesNotMatch(serviceSource, /i\.pravatar\.cc/);
  assert.doesNotMatch(serviceSource, /picsum\.photos/);
  assert.doesNotMatch(serviceSource, /delay\(/);
  assert.match(llmServiceSource, /@sdkwork\/claw-core/);
  assert.doesNotMatch(llmServiceSource, /@google\/genai/);
  assert.doesNotMatch(llmServiceSource, /GoogleGenAI/);
  assert.doesNotMatch(llmServiceSource, /VITE_GEMINI_API_KEY/);
  assert.match(newPostSource, /community\.newPost\.entryTypes\.jobSeeking/);
  assert.match(newPostSource, /community\.newPost\.entryTypes\.recruitment/);
  assert.match(newPostSource, /community\.newPost\.fields\.location/);
  assert.match(newPostSource, /community\.newPost\.fields\.compensation/);
  assert.match(newPostSource, /community\.newPost\.fields\.publisherType/);
  assert.match(newPostSource, /community\.newPost\.fields\.serviceLine/);
  assert.match(newPostSource, /community\.newPost\.fields\.deliveryMode/);
  assert.match(newPostSource, /community\.newPost\.fields\.turnaround/);
  assert.match(newPostSource, /community\.newPost\.assistantPanel\.title/);
  assert.match(newPostSource, /community\.newPost\.assistantCards\.recruitment/);
  assert.match(newPostSource, /llmService\.generateContent/);
  assert.match(recommendationSource, /buildCommunityRecommendations/);
  assert.match(recommendationSource, /relatedServices/);
  assert.match(recommendationSource, /relatedCompanies/);
  assert.match(recommendationSource, /reasons:/);
  assert.match(detailSource, /community\.postDetail\.assistantCta/);
  assert.match(detailSource, /community\.postDetail\.listingMeta/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.location/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.compensation/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.publisherType/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.serviceLine/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.deliveryMode/);
  assert.match(detailSource, /community\.postDetail\.listingMeta\.turnaround/);
  assert.match(detailSource, /community\.postDetail\.recommendations\.relatedServicesTitle/);
  assert.match(detailSource, /community\.postDetail\.recommendations\.relatedCompaniesTitle/);
  assert.match(detailSource, /community\.postDetail\.recommendations\.reasonLabels\.sameServiceLine/);
  assert.match(detailSource, /post\.tags\.map/);
  assert.match(detailSource, /community\.postDetail\.publisherPanelTitle/);
  assert.match(detailSource, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.doesNotMatch(detailSource, /relative h-64 w-full md:h-96/);
  assert.doesNotMatch(detailSource, /-mt-20/);
});

runTest('sdkwork-clawstudio-community keeps the NewPost route shell separate from the heavy tiptap editor workspace', () => {
  const newPostRouteSource = read('packages/sdkwork-clawstudio-community/src/pages/community/NewPost.tsx');

  assert.ok(exists('packages/sdkwork-clawstudio-community/src/pages/community/NewPostWorkspace.tsx'));
  assert.match(newPostRouteSource, /Suspense/);
  assert.match(newPostRouteSource, /lazy\(\(\) =>/);
  assert.match(newPostRouteSource, /\.\/NewPostWorkspace/);
  assert.doesNotMatch(newPostRouteSource, /@tiptap\/react/);
  assert.doesNotMatch(newPostRouteSource, /@tiptap\/extension-/);
  assert.doesNotMatch(newPostRouteSource, /EditorContent/);
  assert.doesNotMatch(newPostRouteSource, /useEditor/);
});

runTest('sdkwork-clawstudio-community keeps the route surface and locale coverage aligned with the final classifieds UI', () => {
  const routesSource = read('packages/sdkwork-clawstudio-shell/src/application/router/AppRoutes.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-clawstudio-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-clawstudio-i18n/src/locales/zh.json');
  const requiredKeys = extractCommunityTranslationKeys();
  const availableEn = new Set(flattenKeys(enLocale));
  const availableZh = new Set(flattenKeys(zhLocale));
  const missingEn = requiredKeys.filter((key) => !availableEn.has(key));
  const missingZh = requiredKeys.filter((key) => !availableZh.has(key));

  assert.match(routesSource, /path="\/community"/);
  assert.equal((enLocale.sidebar as Record<string, string>).community, 'Classifieds');
  assert.equal((zhLocale.sidebar as Record<string, string>).community, '分类信息');
  assert.deepEqual(missingEn, []);
  assert.deepEqual(missingZh, []);
});
