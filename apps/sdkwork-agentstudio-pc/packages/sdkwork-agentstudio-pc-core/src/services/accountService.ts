import { uuid } from '@sdkwork/utils/id';
import { unwrapAppSdkResponse, type AppSdkEnvelope } from '../sdk/appSdkResult.ts';

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'recharge' | 'withdraw';
  amount: number;
  desc: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface AccountSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface AccountService {
  getSummary(): Promise<AccountSummary>;
  getTransactions(filter?: 'all' | 'income' | 'expense'): Promise<Transaction[]>;
  recharge(amount: number, method: string): Promise<Transaction>;
  withdraw(amount: number, destination: string): Promise<Transaction>;
}

interface AccountSdkClient {
  account: {
    getAccountSummary(): Promise<AppSdkEnvelope<AccountSummaryPayload> | AccountSummaryPayload>;
    getCash(): Promise<AppSdkEnvelope<AccountCashPayload> | AccountCashPayload>;
    getHistoryCash(): Promise<AppSdkEnvelope<AccountHistoryPayload> | AccountHistoryPayload>;
    recharge(body: {
      amount: number;
      paymentMethod: string;
      remarks: string;
    }): Promise<AppSdkEnvelope<AccountTransactionMutationPayload> | AccountTransactionMutationPayload>;
    withdraw(body: {
      amount: number;
      withdrawMethod: string;
      remarks: string;
    }): Promise<AppSdkEnvelope<AccountTransactionMutationPayload> | AccountTransactionMutationPayload>;
  };
}

export interface CreateAccountServiceOptions {
  getClient?: () => AccountSdkClient | Promise<AccountSdkClient>;
}

interface AccountSummaryPayload {
  cashAvailable?: number | string;
}

interface AccountCashPayload {
  availableBalance?: number | string;
  totalRecharged?: number | string;
  totalSpent?: number | string;
  totalWithdrawn?: number | string;
}

interface AccountHistoryItemPayload {
  historyId?: string;
  transactionId?: string;
  transactionType?: string;
  transactionTypeName?: string;
  amount?: number | string;
  remarks?: string;
  createdAt?: string;
  status?: string;
}

interface AccountHistoryPayload {
  content?: AccountHistoryItemPayload[];
}

interface AccountTransactionMutationPayload {
  transactionId?: string;
  status?: string;
}

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function resolveTransactionType(transactionType?: string): Transaction['type'] {
  const normalized = transactionType?.toUpperCase() || '';
  if (normalized.includes('RECHARGE') || normalized.includes('TOPUP')) {
    return 'recharge';
  }
  if (normalized.includes('WITHDRAW')) {
    return 'withdraw';
  }
  if (normalized.includes('PAY') || normalized.includes('EXPENSE') || normalized.includes('CONSUME')) {
    return 'expense';
  }
  return 'income';
}

function resolveTransactionStatus(status?: string): Transaction['status'] {
  const normalized = status?.toUpperCase() || '';
  if (normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    return 'completed';
  }
  if (normalized === 'FAILED') {
    return 'failed';
  }
  return 'pending';
}

function createTransactionId() {
  return uuid();
}

async function getDefaultAccountClient(): Promise<AccountSdkClient> {
  const { getagentstudioAppClientWithSession } = await import('../sdk/useAppSdkClient.ts');
  return getagentstudioAppClientWithSession() as unknown as AccountSdkClient;
}

export function createAccountService(
  options: CreateAccountServiceOptions = {},
): AccountService {
  const getClient = options.getClient ?? getDefaultAccountClient;

  return {
    async getSummary() {
      const client = await getClient();
      const [summaryResponse, cashAccountResponse] = await Promise.all([
        client.account.getAccountSummary(),
        client.account.getCash(),
      ]);
      const summary = unwrapAppSdkResponse<AccountSummaryPayload>(summaryResponse);
      const cashAccount = unwrapAppSdkResponse<AccountCashPayload>(cashAccountResponse);

      return {
        balance: toNumber(cashAccount.availableBalance, toNumber(summary.cashAvailable)),
        totalIncome: toNumber(cashAccount.totalRecharged),
        totalExpense: toNumber(cashAccount.totalSpent, toNumber(cashAccount.totalWithdrawn)),
      };
    },

    async getTransactions(filter = 'all') {
      const client = await getClient();
      const history = unwrapAppSdkResponse<AccountHistoryPayload>(
        await client.account.getHistoryCash(),
      );
      const items = (history.content ?? []).map((item) => ({
        id: item.historyId || item.transactionId || createTransactionId(),
        type: resolveTransactionType(item.transactionType),
        amount: Math.abs(toNumber(item.amount)),
        desc: item.remarks || item.transactionTypeName || item.transactionType || 'Transaction',
        date: item.createdAt || new Date().toISOString(),
        status: resolveTransactionStatus(item.status),
      }));

      return items.filter((item) => {
        if (filter === 'income') {
          return item.type === 'income' || item.type === 'recharge';
        }
        if (filter === 'expense') {
          return item.type === 'expense' || item.type === 'withdraw';
        }
        return true;
      });
    },

    async recharge(amount, method) {
      const client = await getClient();
      const result = unwrapAppSdkResponse<AccountTransactionMutationPayload>(
        await client.account.recharge({
        amount,
        paymentMethod: method,
        remarks: `Wallet Top-up via ${method}`,
        }),
      );

      return {
        id: result.transactionId || createTransactionId(),
        type: 'recharge',
        amount,
        desc: `Wallet Top-up via ${method}`,
        date: new Date().toISOString(),
        status: resolveTransactionStatus(result.status),
      };
    },

    async withdraw(amount, destination) {
      const client = await getClient();
      const result = unwrapAppSdkResponse<AccountTransactionMutationPayload>(
        await client.account.withdraw({
        amount,
        withdrawMethod: destination,
        remarks: `Withdrawal to ${destination}`,
        }),
      );

      return {
        id: result.transactionId || createTransactionId(),
        type: 'withdraw',
        amount,
        desc: `Withdrawal to ${destination}`,
        date: new Date().toISOString(),
        status: resolveTransactionStatus(result.status),
      };
    },
  };
}

export const accountService = createAccountService();
