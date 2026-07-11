import React from 'react';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QUICKSTART_INSTALL_COMMAND = 'curl -fsSL https://openclaw.dev/install.sh | bash';

export function QuickstartDoc() {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-4 flex items-center gap-2 font-medium text-primary-600">
        <Zap className="h-5 w-5" />
        <span>{t('docs.quickstart.badge')}</span>
      </div>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.quickstart.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">
        {t('docs.quickstart.description')}
      </p>

      <h2 className="mb-4 mt-10 text-2xl font-bold text-zinc-900">
        {t('docs.quickstart.steps.installGateway.title')}
      </h2>
      <p>{t('docs.quickstart.steps.installGateway.description')}</p>
      <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-4 text-zinc-50">
        <code>{QUICKSTART_INSTALL_COMMAND}</code>
      </pre>

      <h2 className="mb-4 mt-10 text-2xl font-bold text-zinc-900">
        {t('docs.quickstart.steps.registerDevice.title')}
      </h2>
      <p>{t('docs.quickstart.steps.registerDevice.description')}</p>

      <h2 className="mb-4 mt-10 text-2xl font-bold text-zinc-900">
        {t('docs.quickstart.steps.installSkill.title')}
      </h2>
      <p>{t('docs.quickstart.steps.installSkill.description')}</p>
    </>
  );
}
