import React, { useEffect } from 'react';
import { AlertCircle, Cloud, GitBranch, Package, Server, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const SCRIPT_MAC_COMMAND = 'curl -fsSL https://openclaw.ai/install.sh | bash';
const SCRIPT_WINDOWS_COMMAND = 'iwr -useb https://openclaw.ai/install.ps1 | iex';
const DOCKER_DOWNLOAD_COMMAND =
  'curl -O https://raw.githubusercontent.com/openclaw/openclaw/main/docker-setup.sh\nchmod +x docker-setup.sh';
const DOCKER_RUN_COMMAND = './docker-setup.sh';
const NPM_COMMAND = 'npm install -g openclaw@latest\nopenclaw onboard --install-daemon';
const PNPM_COMMAND =
  'pnpm add -g openclaw@latest\npnpm approve-builds -g\nopenclaw onboard --install-daemon';
const CLOUD_SSH_COMMAND = 'ssh root@your_server_ip';
const CLOUD_INSTALL_COMMAND = 'curl -fsSL https://openclaw.ai/install.sh | bash';
const SOURCE_BUILD_COMMAND =
  'git clone https://github.com/openclaw/openclaw.git\ncd openclaw\npnpm install\npnpm ui:build\npnpm build';
const SOURCE_RUN_COMMAND = 'pnpm link --global\nopenclaw onboard --install-daemon';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  return (
    <div className="group relative mb-6 mt-3">
      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
          <span className="text-xs font-mono text-zinc-400">{language}</span>
        </div>
        <div className="overflow-x-auto p-4">
          <pre className="text-sm font-mono text-zinc-300">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export function InstallDoc() {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location]);

  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-900">
        {t('docs.install.title')}
      </h1>
      <p className="mb-8 text-lg leading-relaxed text-zinc-600">{t('docs.install.description')}</p>

      <div id="script" className="mb-16 scroll-mt-8 border-t border-zinc-200 pt-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50">
            <Terminal className="h-6 w-6 text-primary-500" />
          </div>
          <h2 className="m-0 text-2xl font-bold text-zinc-900">
            {t('docs.install.sections.script.title')}
          </h2>
        </div>
        <p className="mb-6">{t('docs.install.sections.script.description')}</p>

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.platforms.macosLinuxWsl')}
        </h3>
        <CodeBlock code={SCRIPT_MAC_COMMAND} />

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.platforms.windowsPowerShell')}
        </h3>
        <CodeBlock code={SCRIPT_WINDOWS_COMMAND} language="powershell" />
      </div>

      <div id="docker" className="mb-16 scroll-mt-8 border-t border-zinc-200 pt-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
            <Server className="h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="m-0 text-2xl font-bold text-zinc-900">
            {t('docs.install.sections.docker.title')}
          </h2>
        </div>
        <p className="mb-6">{t('docs.install.sections.docker.description')}</p>

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.docker.downloadTitle')}
        </h3>
        <CodeBlock code={DOCKER_DOWNLOAD_COMMAND} />

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.docker.runTitle')}
        </h3>
        <CodeBlock code={DOCKER_RUN_COMMAND} />
      </div>

      <div id="npm" className="mb-16 scroll-mt-8 border-t border-zinc-200 pt-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50">
            <Package className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="m-0 text-2xl font-bold text-zinc-900">
            {t('docs.install.sections.npm.title')}
          </h2>
        </div>
        <p className="mb-6">{t('docs.install.sections.npm.description')}</p>

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.npm.usingNpm')}
        </h3>
        <CodeBlock code={NPM_COMMAND} />

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.npm.usingPnpm')}
        </h3>
        <CodeBlock code={PNPM_COMMAND} />
      </div>

      <div id="cloud" className="mb-16 scroll-mt-8 border-t border-zinc-200 pt-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-100 bg-purple-50">
            <Cloud className="h-6 w-6 text-purple-500" />
          </div>
          <h2 className="m-0 text-2xl font-bold text-zinc-900">
            {t('docs.install.sections.cloud.title')}
          </h2>
        </div>
        <p className="mb-6">{t('docs.install.sections.cloud.description')}</p>

        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{t('docs.install.sections.cloud.warning')}</p>
        </div>

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.cloud.sshTitle')}
        </h3>
        <CodeBlock code={CLOUD_SSH_COMMAND} />

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.cloud.runInstallerTitle')}
        </h3>
        <CodeBlock code={CLOUD_INSTALL_COMMAND} />
      </div>

      <div id="source" className="mb-16 scroll-mt-8 border-t border-zinc-200 pt-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100">
            <GitBranch className="h-6 w-6 text-zinc-700" />
          </div>
          <h2 className="m-0 text-2xl font-bold text-zinc-900">
            {t('docs.install.sections.source.title')}
          </h2>
        </div>
        <p className="mb-6">{t('docs.install.sections.source.description')}</p>

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.source.cloneAndBuildTitle')}
        </h3>
        <CodeBlock code={SOURCE_BUILD_COMMAND} />

        <h3 className="mb-2 mt-6 text-lg font-bold text-zinc-900">
          {t('docs.install.sections.source.linkAndRunTitle')}
        </h3>
        <CodeBlock code={SOURCE_RUN_COMMAND} />
      </div>
    </>
  );
}
