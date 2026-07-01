import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  History,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatDate } from '@sdkwork/claw-i18n';
import {
  Button,
  Input,
  Label,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';
import {
  accountService,
  type AccountSummary,
  type Transaction,
} from './services';

export function Account() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  const amountPlaceholder = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(0);
  const monthlyChange = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  }).format(12.5);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [summaryData, transactionData] = await Promise.all([
        accountService.getSummary(),
        accountService.getTransactions(activeTab),
      ]);
      setSummary(summaryData);
      setTransactions(transactionData);
    } catch {
      toast.error(t('account.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, [activeTab]);

  async function handleRecharge(event: FormEvent) {
    event.preventDefault();

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error(t('account.invalidAmount'));
      return;
    }

    setIsProcessing(true);
    try {
      await accountService.recharge(Number(amount), method);
      toast.success(t('account.rechargeSuccess'));
      setIsRechargeModalOpen(false);
      setAmount('');
      await fetchData();
    } catch {
      toast.error(t('account.rechargeFailed'));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleWithdraw(event: FormEvent) {
    event.preventDefault();

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error(t('account.invalidAmount'));
      return;
    }
    if (summary && Number(amount) > summary.balance) {
      toast.error(t('account.insufficientBalance'));
      return;
    }

    setIsProcessing(true);
    try {
      await accountService.withdraw(Number(amount), method);
      toast.success(t('account.withdrawSuccess'));
      setIsWithdrawModalOpen(false);
      setAmount('');
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('account.withdrawFailed'),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            <Wallet className="h-8 w-8 text-primary-500" />
            {t('account.title')}
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {t('account.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-4 -mt-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-medium text-primary-100">
                  {t('account.totalBalance')}
                </span>
                <DollarSign className="h-5 w-5 text-primary-200" />
              </div>
              <div className="mb-8 text-4xl font-black tracking-tight">
                {formatCurrency(summary?.balance ?? 0)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 font-bold text-primary-700 shadow-sm transition-colors hover:bg-primary-50"
                >
                  <Plus className="h-4 w-4" /> {t('account.recharge')}
                </button>
                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary-500/30 bg-primary-700 py-2.5 font-bold text-white transition-colors hover:bg-primary-900"
                >
                  <Download className="h-4 w-4" /> {t('account.withdraw')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {t('account.monthlyIncome')}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              +{formatCurrency(summary?.totalIncome ?? 0)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" /> +{monthlyChange}% {t('account.vsLastMonth')}
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                <ArrowDownRight className="h-5 w-5" />
              </div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {t('account.monthlyExpense')}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              -{formatCurrency(summary?.totalExpense ?? 0)}
            </div>
            <div className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('account.mostlyApiFees')}
            </div>
          </div>
        </div>

        <div className="flex min-h-[400px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 p-6 dark:border-zinc-800 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white">
              <History className="h-5 w-5 text-zinc-400" />
              {t('account.transactionHistory')}
            </h2>

            <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['all', 'income', 'expense'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {t(`account.${tab}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        transaction.type === 'income' || transaction.type === 'recharge'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}
                    >
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'expense' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'recharge' ? (
                        <CreditCard className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'withdraw' ? (
                        <Download className="h-5 w-5" />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {transaction.desc}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                        <span>
                          {formatDate(transaction.date, i18n.language, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {transaction.status === 'completed' ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />{' '}
                            {t('account.completed')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> {t('account.pending')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`whitespace-nowrap text-right font-bold ${
                      transaction.type === 'income' || transaction.type === 'recharge'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {transaction.type === 'income' || transaction.type === 'recharge'
                      ? '+'
                      : '-'}
                    {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-500">
                {t('account.noTransactions')}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        title={t('account.recharge')}
      >
        <form onSubmit={handleRecharge} className="space-y-4">
          <div>
            <Label className="mb-1 block text-zinc-700 dark:text-zinc-300">
              {t('account.amount')}
            </Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={amountPlaceholder}
              required
            />
          </div>
          <div>
            <Label className="mb-1 block text-zinc-700 dark:text-zinc-300">
              {t('account.paymentMethod')}
            </Label>
            <Select
              value={method}
              onValueChange={setMethod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">{t('account.creditCard')}</SelectItem>
                <SelectItem value="paypal">{t('account.paypal')}</SelectItem>
                <SelectItem value="crypto">{t('account.crypto')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRechargeModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {t('account.confirmRecharge')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title={t('account.withdraw')}
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-primary-50 p-3 text-sm font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            <span>{t('account.availableBalance')}:</span>
            <span className="font-bold">{formatCurrency(summary?.balance ?? 0)}</span>
          </div>
          <div>
            <Label className="mb-1 block text-zinc-700 dark:text-zinc-300">
              {t('account.amount')}
            </Label>
            <Input
              type="number"
              min="1"
              max={summary?.balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={amountPlaceholder}
              required
            />
          </div>
          <div>
            <Label className="mb-1 block text-zinc-700 dark:text-zinc-300">
              {t('account.withdrawDestination')}
            </Label>
            <Select
              value={method}
              onValueChange={setMethod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_account">{t('account.bankAccount')}</SelectItem>
                <SelectItem value="paypal">{t('account.paypal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsWithdrawModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {t('account.confirmWithdraw')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
