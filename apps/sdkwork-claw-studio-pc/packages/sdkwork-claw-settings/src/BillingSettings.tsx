import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  Download,
  Server,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '@sdkwork/claw-i18n';
import { Section } from './Shared';

export function BillingSettings() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices'>('overview');
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const usageData = [
    {
      name: 'GPT-4o',
      type: t('settings.billing.usageTypes.llmApi'),
      tokens: 2400000,
      costUsd: 24.5,
      icon: Sparkles,
    },
    {
      name: 'Claude 3.5 Sonnet',
      type: t('settings.billing.usageTypes.llmApi'),
      tokens: 1100000,
      costUsd: 3.3,
      icon: Sparkles,
    },
    {
      name: t('settings.billing.usageNames.productionNode'),
      type: t('settings.billing.usageTypes.instance'),
      uptimeHours: 720,
      costUsd: 14.4,
      icon: Server,
    },
    {
      name: t('settings.billing.usageNames.devNode'),
      type: t('settings.billing.usageTypes.instance'),
      uptimeHours: 120,
      costUsd: 0,
      icon: Server,
    },
  ];

  const invoices = [
    {
      id: 'INV-2026-003',
      date: '2026-03-01T00:00:00.000Z',
      amountUsd: 42.2,
      status: t('settings.billing.status.paid'),
    },
    {
      id: 'INV-2026-002',
      date: '2026-02-01T00:00:00.000Z',
      amountUsd: 38.5,
      status: t('settings.billing.status.paid'),
    },
    {
      id: 'INV-2026-001',
      date: '2026-01-01T00:00:00.000Z',
      amountUsd: 12,
      status: t('settings.billing.status.paid'),
    },
  ];

  const monthlyChange = formatNumber(12.5, language, { maximumFractionDigits: 1 });
  const compactTokenTotal = formatNumber(3500000, language, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const formatUsage = (item: (typeof usageData)[number]) => {
    if ('tokens' in item) {
      const compactTokens = formatNumber(item.tokens ?? 0, language, {
        notation: 'compact',
        maximumFractionDigits: 1,
      });

      return t('settings.billing.usageMetrics.tokens', { value: compactTokens });
    }

    const hours = formatNumber(item.uptimeHours, language);
    return t('settings.billing.usageMetrics.hours', { value: hours });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t('settings.billing.title')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('settings.billing.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {t('settings.billing.thisMonth')}
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t('settings.billing.currentUsage')}
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(42.2, language)}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-500">+{monthlyChange}%</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {t('settings.billing.vsLastMonth')}
            </span>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {t('settings.billing.apiCosts')}
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t('settings.billing.totalTokens')}
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {compactTokenTotal}
          </div>
          <div className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t('settings.billing.estimatedCost')}{' '}
            <span className="text-zinc-900 dark:text-zinc-100">
              {formatCurrency(27.8, language)}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-zinc-400" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {t('settings.billing.paymentMethod')}
              </span>
            </div>
            <div className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('settings.billing.paymentMethodValue')}
            </div>
          </div>
          <button className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
            {t('settings.billing.updatePaymentMethod')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          {t('settings.billing.tabs.overview')}
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          {t('settings.billing.tabs.invoices')}
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <Section
              title={t('settings.billing.costBreakdownTitle')}
            >
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">
                        {t('settings.billing.table.resource')}
                      </th>
                      <th className="px-6 py-4 font-medium">
                        {t('settings.billing.table.type')}
                      </th>
                      <th className="px-6 py-4 font-medium">
                        {t('settings.billing.table.usage')}
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        {t('settings.billing.table.cost')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {usageData.map((item) => (
                      <tr
                        key={item.name}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <item.icon className="h-4 w-4 text-zinc-500" />
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {item.type}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {formatUsage(item)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(item.costUsd, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-4 text-right font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        {t('settings.billing.table.totalEstimatedCost')}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(42.2, language)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>

            <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              <div>
                <h4 className="mb-1 text-sm font-bold text-amber-900 dark:text-amber-400">
                  {t('settings.billing.spendingLimitTitle')}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-500/80">
                  {t('settings.billing.spendingLimitDescription', {
                    limit: formatCurrency(50, language),
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Section title={t('settings.billing.historyTitle')}>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">
                      {t('settings.billing.invoiceTable.invoice')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {t('settings.billing.invoiceTable.date')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {t('settings.billing.invoiceTable.amount')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {t('settings.billing.invoiceTable.status')}
                    </th>
                    <th className="px-6 py-4 text-right font-medium">
                      {t('settings.billing.invoiceTable.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {invoice.id}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                        {formatDate(invoice.date, language, { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(invoice.amountUsd, language)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          title={t('settings.billing.downloadInvoice')}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </motion.div>
    </div>
  );
}
