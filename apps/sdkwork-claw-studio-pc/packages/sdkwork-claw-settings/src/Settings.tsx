import { useState } from 'react';
import {
  Bell,
  Database,
  Key,
  MessageSquare,
  Monitor,
  Receipt,
  Search,
  Shield,
  User,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Account } from '@sdkwork/claw-account';
import { Input } from '@sdkwork/claw-ui';
import { AccountSettings } from './AccountSettings';
import { ApiSettings } from './ApiSettings';
import { BillingSettings } from './BillingSettings';
import { DataPrivacySettings } from './DataPrivacySettings';
import { FeedbackSettings } from './FeedbackSettings';
import { GeneralSettings } from './GeneralSettings';
import { NotificationSettings } from './NotificationSettings';
import { SecuritySettings } from './SecuritySettings';
import { resolveSettingsContentShellClassName } from './settingsLayout';

export function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const settingsTabs = [
    { id: 'general', label: t('settings.tabs.general'), icon: Monitor },
    { id: 'billing', label: t('settings.tabs.billing'), icon: Receipt },
    { id: 'wallet', label: t('settings.tabs.wallet'), icon: Wallet },
    { id: 'account', label: t('settings.tabs.account'), icon: User },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
    { id: 'feedback', label: t('settings.tabs.feedback'), icon: MessageSquare },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'api', label: t('settings.tabs.api'), icon: Key },
    { id: 'data', label: t('settings.tabs.data'), icon: Database },
  ];

  const requestedTab = searchParams.get('tab');
  const activeTab = settingsTabs.some((tab) => tab.id === requestedTab) ? requestedTab || 'general' : 'general';

  const filteredTabs = settingsTabs.filter((tab) =>
    tab.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="p-6 pb-4">
          <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t('settings.page.title')}
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              type="text"
              placeholder={t('settings.page.searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="py-2.5 pl-9 pr-4 text-[13px]"
            />
          </div>
        </div>
        <nav className="scrollbar-hide flex-1 space-y-1.5 overflow-y-auto px-4 pb-6">
          {filteredTabs.length > 0 ? (
            filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    const nextSearchParams = new URLSearchParams(searchParams);
                    if (tab.id === 'general') {
                      nextSearchParams.delete('tab');
                    } else {
                      nextSearchParams.set('tab', tab.id);
                    }
                    setSearchParams(nextSearchParams, { replace: true });
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'border-zinc-200/50 bg-white text-primary-600 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-primary-400'
                      : 'border-transparent text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
                  }`}
                >
                  <tab.icon
                    className={`h-4 w-4 ${
                      isActive
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  />
                  {tab.label}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('settings.page.empty')}
            </div>
          )}
        </nav>
      </div>

      <div className="scrollbar-hide flex-1 overflow-x-hidden overflow-y-auto">
        <div className={resolveSettingsContentShellClassName(activeTab)}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'billing' && <BillingSettings />}
            {activeTab === 'wallet' && <Account />}
            {activeTab === 'account' && <AccountSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'feedback' && <FeedbackSettings />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'api' && <ApiSettings />}
            {activeTab === 'data' && <DataPrivacySettings />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
