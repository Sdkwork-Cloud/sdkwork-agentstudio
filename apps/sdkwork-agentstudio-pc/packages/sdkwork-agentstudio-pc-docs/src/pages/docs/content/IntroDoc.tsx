import React from 'react';
import { Book, Cpu, Package, Terminal, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function IntroDoc() {
  const { t } = useTranslation();

  const features = [
    {
      key: 'localFirst',
      icon: Cpu,
    },
    {
      key: 'extensibleSkills',
      icon: Package,
    },
    {
      key: 'aiPowered',
      icon: Zap,
    },
    {
      key: 'developerFriendly',
      icon: Terminal,
    },
  ];

  const components = [
    {
      label: t('docs.intro.components.manager.label'),
      description: t('docs.intro.components.manager.description'),
    },
    {
      label: t('docs.intro.components.gateway.label'),
      description: t('docs.intro.components.gateway.description'),
    },
    {
      label: t('docs.intro.components.devices.label'),
      description: t('docs.intro.components.devices.description'),
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2 font-medium text-primary-600">
        <Book className="h-5 w-5" />
        <span>{t('docs.intro.badge')}</span>
      </div>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.intro.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">{t('docs.intro.description')}</p>

      <h2 className="mb-4 mt-12 text-2xl font-bold text-zinc-900">
        {t('docs.intro.features.title')}
      </h2>
      <div className="not-prose mb-8 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <feature.icon className="mb-3 h-6 w-6 text-primary-500" />
            <h3 className="mb-1 font-bold text-zinc-900">
              {t(`docs.intro.features.items.${feature.key}.title`)}
            </h3>
            <p className="text-sm text-zinc-600">
              {t(`docs.intro.features.items.${feature.key}.description`)}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-12 text-2xl font-bold text-zinc-900">
        {t('docs.intro.howItWorks.title')}
      </h2>
      <p>{t('docs.intro.howItWorks.description')}</p>
      <ul>
        {components.map((component) => (
          <li key={component.label}>
            <strong>{component.label}</strong>: {component.description}
          </li>
        ))}
      </ul>
    </>
  );
}
