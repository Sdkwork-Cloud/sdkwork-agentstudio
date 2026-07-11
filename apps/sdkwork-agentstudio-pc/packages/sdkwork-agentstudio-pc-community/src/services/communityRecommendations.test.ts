import assert from 'node:assert/strict';
import { buildCommunityRecommendations } from './communityRecommendations.ts';
import type { CommunityPost } from './communityService.ts';

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

function createPost(overrides: Partial<CommunityPost> & Pick<CommunityPost, 'id' | 'title' | 'category'>): CommunityPost {
  return {
    id: overrides.id,
    title: overrides.title,
    content: overrides.content ?? overrides.title,
    author: overrides.author ?? {
      name: 'SDKWork',
      avatar: '',
      role: 'Member',
    },
    category: overrides.category,
    publisherType: overrides.publisherType ?? 'personal',
    tags: overrides.tags ?? [],
    stats: overrides.stats ?? {
      likes: 0,
      comments: 0,
      views: 0,
    },
    createdAt: overrides.createdAt ?? '2026-03-24T09:00:00Z',
    coverImage: overrides.coverImage,
    location: overrides.location,
    compensation: overrides.compensation,
    company: overrides.company,
    employmentType: overrides.employmentType,
    contactPreference: overrides.contactPreference,
    serviceLine: overrides.serviceLine,
    deliveryMode: overrides.deliveryMode,
    turnaround: overrides.turnaround,
    isFeatured: overrides.isFeatured,
    assistantActions: overrides.assistantActions,
  };
}

const fixtures: CommunityPost[] = [
  createPost({
    id: 'current-service',
    title: 'Remote legal contract review',
    category: 'services',
    publisherType: 'company',
    company: 'Claw Legal Desk',
    author: {
      name: 'Claw Legal Desk',
      avatar: '',
      role: 'Service Partner',
      bio: 'Remote legal counsel.',
    },
    tags: ['legal', 'contracts', 'remote'],
    serviceLine: 'legal',
    deliveryMode: 'online',
    location: 'Remote',
    compensation: 'From 899 CNY',
    turnaround: '48 hours',
    stats: {
      likes: 120,
      comments: 12,
      views: 1800,
    },
    isFeatured: true,
  }),
  createPost({
    id: 'same-line',
    title: 'Trademark risk review',
    category: 'services',
    publisherType: 'company',
    company: 'Claw IP Counsel',
    author: {
      name: 'Claw IP Counsel',
      avatar: '',
      role: 'Service Partner',
      bio: 'IP and trademark counsel.',
    },
    tags: ['legal', 'trademark', 'remote'],
    serviceLine: 'legal',
    deliveryMode: 'online',
    location: 'Remote',
    compensation: 'From 1299 CNY',
    turnaround: '72 hours',
    stats: {
      likes: 90,
      comments: 8,
      views: 1400,
    },
  }),
  createPost({
    id: 'hr-service',
    title: 'Recruiting operations enablement',
    category: 'services',
    publisherType: 'company',
    company: 'Talent Sprint',
    author: {
      name: 'Talent Sprint',
      avatar: '',
      role: 'Service Partner',
      bio: 'Hiring operations studio.',
    },
    tags: ['hr', 'recruitment', 'remote'],
    serviceLine: 'hr',
    deliveryMode: 'online',
    location: 'Remote',
    stats: {
      likes: 70,
      comments: 6,
      views: 1200,
    },
  }),
  createPost({
    id: 'recruitment',
    title: 'Hiring frontend engineer',
    category: 'recruitment',
    publisherType: 'company',
    company: 'OpenClaw',
    author: {
      name: 'OpenClaw Talent',
      avatar: '',
      role: 'Company',
      bio: 'Hiring for AI products.',
    },
    tags: ['react', 'typescript', 'ai-product'],
    location: 'Shanghai / Remote',
    compensation: '30k-45k',
    stats: {
      likes: 140,
      comments: 11,
      views: 2200,
    },
    isFeatured: true,
  }),
  createPost({
    id: 'openclaw-news',
    title: 'OpenClaw marketplace update',
    category: 'news',
    publisherType: 'official',
    company: 'OpenClaw',
    author: {
      name: 'OpenClaw Official',
      avatar: '',
      role: 'Official',
      bio: 'Official product updates.',
    },
    tags: ['news', 'product-update'],
    location: 'Platform',
    stats: {
      likes: 60,
      comments: 5,
      views: 900,
    },
  }),
];

await runTest('related services prioritize same service line matches for service listings', () => {
  const current = fixtures[0];
  const recommendations = buildCommunityRecommendations(current, fixtures);

  assert.ok(recommendations.relatedServices.length >= 2);
  assert.equal(recommendations.relatedServices[0]?.post.id, 'same-line');
  assert.ok(recommendations.relatedServices[0]?.reasons.includes('same-service-line'));
  assert.ok(recommendations.relatedServices[0]?.reasons.includes('shared-tag'));
  assert.ok(recommendations.relatedServices.every((item) => item.post.id !== current.id));
});

await runTest('recruitment entries surface hr services and related company recommendations', () => {
  const current = fixtures.find((item) => item.id === 'recruitment');
  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, fixtures);

  assert.ok(recommendations.relatedServices.some((item) => item.post.serviceLine === 'hr'));
  assert.equal(recommendations.relatedCompanies[0]?.company, 'OpenClaw');
  assert.ok(recommendations.relatedCompanies[0]?.reasons.includes('same-company'));
  assert.ok(recommendations.relatedCompanies[0]?.reasons.includes('multi-listing'));
});

await runTest('news entries keep only company recommendations with explicit match reasons', () => {
  const current = fixtures.find((item) => item.id === 'openclaw-news');
  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, fixtures);

  assert.ok(recommendations.relatedCompanies.length >= 1);
  assert.ok(recommendations.relatedCompanies.every((item) => item.reasons.length > 0));
});
