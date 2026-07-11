import React, { useEffect, useMemo, useState } from 'react';
import { Book, Cpu, DownloadCloud, Package, Terminal, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ArchitectureDoc } from './content/ArchitectureDoc';
import { CliDoc } from './content/CliDoc';
import { InstallDoc } from './content/InstallDoc';
import { IntroDoc } from './content/IntroDoc';
import { QuickstartDoc } from './content/QuickstartDoc';
import { SkillsDoc } from './content/SkillsDoc';

type DocId = 'intro' | 'quickstart' | 'install' | 'architecture' | 'skills' | 'cli';

export function Docs() {
  const { t } = useTranslation();
  const [activeDoc, setActiveDoc] = useState<DocId>('intro');
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      setActiveDoc('install');
    }
  }, [location]);

  const navGroups = useMemo(
    () => [
      {
        section: t('docs.nav.gettingStarted'),
        items: [
          { id: 'intro' as const, title: t('docs.nav.items.introduction'), icon: Book },
          { id: 'quickstart' as const, title: t('docs.nav.items.quickStart'), icon: Zap },
          { id: 'install' as const, title: t('docs.nav.items.installation'), icon: DownloadCloud },
        ],
      },
      {
        section: t('docs.nav.coreConcepts'),
        items: [
          { id: 'architecture' as const, title: t('docs.nav.items.architecture'), icon: Cpu },
          { id: 'skills' as const, title: t('docs.nav.items.skillsAndPacks'), icon: Package },
        ],
      },
      {
        section: t('docs.nav.apiReference'),
        items: [{ id: 'cli' as const, title: t('docs.nav.items.cliCommands'), icon: Terminal }],
      },
    ],
    [t],
  );

  const onThisPageItems = useMemo<Record<DocId, string[]>>(
    () => ({
      intro: [
        t('docs.sidebar.sections.overview'),
        t('docs.sidebar.sections.keyFeatures'),
        t('docs.sidebar.sections.howItWorks'),
      ],
      quickstart: [
        t('docs.sidebar.sections.overview'),
        t('docs.sidebar.sections.installGateway'),
        t('docs.sidebar.sections.registerDevice'),
        t('docs.sidebar.sections.installSkill'),
      ],
      install: [
        t('docs.sidebar.sections.installerScript'),
        t('docs.sidebar.sections.dockerGateway'),
        t('docs.sidebar.sections.packageManagers'),
        t('docs.sidebar.sections.cloudDeploy'),
        t('docs.sidebar.sections.fromSource'),
      ],
      architecture: [
        t('docs.sidebar.sections.overview'),
        t('docs.sidebar.sections.architectureDiagram'),
        t('docs.sidebar.sections.securityModel'),
      ],
      skills: [
        t('docs.sidebar.sections.overview'),
        t('docs.sidebar.sections.whatIsSkill'),
        t('docs.sidebar.sections.skillPacks'),
      ],
      cli: [
        t('docs.sidebar.sections.overview'),
        t('docs.sidebar.sections.statusCommand'),
        t('docs.sidebar.sections.installCommand'),
      ],
    }),
    [t],
  );

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950">
      <div className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="p-6 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('docs.page.title')}
          </h1>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                {group.section}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeDoc === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveDoc(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                        isActive
                          ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-500/10 dark:text-primary-400'
                          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${
                          isActive
                            ? 'text-primary-500 dark:text-primary-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-8 md:p-12 lg:px-16">
          <motion.div
            key={activeDoc}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="prose prose-zinc prose-primary max-w-none dark:prose-invert"
          >
            {activeDoc === 'intro' && <IntroDoc />}
            {activeDoc === 'quickstart' && <QuickstartDoc />}
            {activeDoc === 'install' && <InstallDoc />}
            {activeDoc === 'architecture' && <ArchitectureDoc />}
            {activeDoc === 'skills' && <SkillsDoc />}
            {activeDoc === 'cli' && <CliDoc />}
          </motion.div>
        </div>
      </div>

      <div className="hidden w-64 shrink-0 border-l border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 xl:block">
        <div className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t('docs.sidebar.onThisPage')}
        </div>
        <nav className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
          {onThisPageItems[activeDoc].map((item) => (
            <span key={item} className="block transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              {item}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
