import React from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_COMMAND = 'oc status';
const INSTALL_COMMAND = 'oc install <skill_id>';

export function CliDoc() {
  const { t } = useTranslation();
  const statusOutput = `$ ${STATUS_COMMAND}
${t('docs.cli.examples.status.gateway')}
${t('docs.cli.examples.status.uptime')}
${t('docs.cli.examples.status.connectedDevices')}`;
  const installOutput = `$ oc install weather-pro
${t('docs.cli.examples.install.downloading')}
${t('docs.cli.examples.install.installingDependencies')}
${t('docs.cli.examples.install.success')}`;

  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.cli.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">{t('docs.cli.description')}</p>

      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-lg font-bold text-zinc-900">
            <code>{STATUS_COMMAND}</code>
          </h3>
          <p className="mb-2">{t('docs.cli.status.description')}</p>
          <pre className="rounded-xl bg-zinc-900 p-4 text-zinc-50">
            <code>{statusOutput}</code>
          </pre>
        </div>

        <div>
          <h3 className="mb-2 text-lg font-bold text-zinc-900">
            <code>{INSTALL_COMMAND}</code>
          </h3>
          <p className="mb-2">{t('docs.cli.install.description')}</p>
          <pre className="rounded-xl bg-zinc-900 p-4 text-zinc-50">
            <code>{installOutput}</code>
          </pre>
        </div>
      </div>
    </>
  );
}
