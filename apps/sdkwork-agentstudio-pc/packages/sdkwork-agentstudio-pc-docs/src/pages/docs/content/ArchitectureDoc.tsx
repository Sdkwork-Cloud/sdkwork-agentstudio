import React from 'react';
import { useTranslation } from 'react-i18next';

export function ArchitectureDoc() {
  const { t } = useTranslation();

  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.architecture.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">
        {t('docs.architecture.description')}
      </p>
      <p>{t('docs.architecture.overview')}</p>
      <div className="my-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center italic text-zinc-500">
        {t('docs.architecture.diagramPlaceholder')}
      </div>
      <h3>{t('docs.architecture.security.title')}</h3>
      <p>{t('docs.architecture.security.description')}</p>
    </>
  );
}
