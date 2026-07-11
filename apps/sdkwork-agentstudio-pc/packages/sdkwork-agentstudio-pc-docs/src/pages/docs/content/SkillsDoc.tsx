import React from 'react';
import { useTranslation } from 'react-i18next';

const SKILL_MANIFEST_EXAMPLE = `{
  "name": "weather-fetcher",
  "version": "1.0.0",
  "description": "Fetches local weather data",
  "permissions": ["network", "location"]
}`;

export function SkillsDoc() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.skills.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">
        {t('docs.skills.description')}
      </p>
      <h2>{t('docs.skills.whatIsSkill.title')}</h2>
      <p>{t('docs.skills.whatIsSkill.description')}</p>
      <h2>{t('docs.skills.packs.title')}</h2>
      <p>{t('docs.skills.packs.description')}</p>
      <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-zinc-50">
        <code>{SKILL_MANIFEST_EXAMPLE}</code>
      </pre>
    </>
  );
}
