import assert from 'node:assert/strict';
import { ensureI18n } from './index.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const introFeatureKeys = [
  'docs.intro.features.items.localFirst.title',
  'docs.intro.features.items.localFirst.description',
  'docs.intro.features.items.extensibleSkills.title',
  'docs.intro.features.items.extensibleSkills.description',
  'docs.intro.features.items.aiPowered.title',
  'docs.intro.features.items.aiPowered.description',
  'docs.intro.features.items.developerFriendly.title',
  'docs.intro.features.items.developerFriendly.description',
] as const;

async function resolveTranslations(language: 'en' | 'zh') {
  const instance = await ensureI18n(language);
  return Object.fromEntries(
    introFeatureKeys.map((key) => [key, instance.t(key)]),
  ) as Record<(typeof introFeatureKeys)[number], string>;
}

await runTest('documentation intro feature cards resolve concrete locale copy in english and chinese', async () => {
  const english = await resolveTranslations('en');
  const chinese = await resolveTranslations('zh');

  for (const key of introFeatureKeys) {
    const englishCopy = english[key];
    const chineseCopy = chinese[key];

    assert.notEqual(englishCopy, key, `english docs locale is missing ${key}`);
    assert.notEqual(chineseCopy, key, `chinese docs locale is missing ${key}`);
    assert.match(englishCopy, /[A-Za-z]/u, `english docs locale should provide readable copy for ${key}`);
    assert.match(chineseCopy, /[\p{Script=Han}]/u, `chinese docs locale should provide Chinese copy for ${key}`);
  }
});
